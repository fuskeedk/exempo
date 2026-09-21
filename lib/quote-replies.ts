import { createHash } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { mailAccountFor, isMailConnectRefused, resolveMailConnectHost } from "@/lib/mail";
import { defaultTenantSlug, readPlatform } from "@/lib/platform";
import { enterTenant, prisma } from "@/lib/prisma";
import { applyCustomerQuoteDecision } from "@/lib/quotes";
import { getSetting, setSetting } from "@/lib/settings";

export const QUOTE_APPROVE_PHRASES = ["godkendt", "jeg godkender", "vi godkender", "godkender tilbuddet", "ja tak"];
export const QUOTE_REJECT_PHRASES = ["jeg godkender ikke", "godkender ikke", "ikke godkendt", "nej tak", "afslår", "afvist"];

export function customerReplyText(body: string, subject = "") {
  let text = body.replace(/\r\n/g, "\n").trim();
  const parts: string[] = [];
  const sub = subject.trim();
  if (sub && !/^(re|sv|fwd?):\s*tilbud/i.test(sub)) parts.push(sub);

  const cut = text.search(/\n\s*(?:_{5,}|-{5,}|----- ?original|----- ?videresendt)/i);
  if (cut >= 0) text = text.slice(0, cut).trim();
  text = text.split(/\n\s*(?:Fra|From|Sendt|Sent|Den \d|On .+ wrote|Indsendt fra):/i)[0]?.trim() ?? "";

  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const trim = line.trim();
    if (/^>+/.test(trim)) break;
    if (/^(?:Fra|From|Sendt|Sent|Den \d|On .+ wrote):/i.test(trim)) break;
    lines.push(trim);
  }
  const top = lines.join("\n").trim();
  if (top) parts.push(top);
  return parts.join("\n").trim();
}

export function quoteReplyDecision(text: string): "godkend" | "afvis" | null {
  const hay = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!hay) return null;
  const rejects = [...QUOTE_REJECT_PHRASES].sort((a, b) => b.length - a.length);
  if (rejects.some((phrase) => hay.includes(phrase))) return "afvis";
  if (QUOTE_APPROVE_PHRASES.some((phrase) => hay.includes(phrase))) return "godkend";
  return null;
}

export function extractQuoteNumber(text: string, prefix = "TIL") {
  const safe = prefix.replace(/[^A-Z0-9]/gi, "") || "TIL";
  const match = text.match(new RegExp(`\\b(${safe}-\\d{4}-\\d+)\\b`, "i"));
  return match ? match[1].toUpperCase() : null;
}

export function extractQuoteIdFromHeaders(headers: string) {
  const match = headers.match(/exempo-quote-([a-z0-9]+)(?:\.|$)/i);
  return match?.[1] ?? null;
}

function hashMessage(id: string) {
  return createHash("sha256").update(id.trim().toLowerCase()).digest("hex");
}

function messageIdCandidates(value: string) {
  const raw = value.trim();
  if (!raw) return [];
  const bare = raw.replace(/^<|>$/g, "");
  return [...new Set([raw, `<${bare}>`, bare])];
}

export type QuoteReplySyncResult = {
  processed: number;
  skipped: number;
  errors: string[];
};

export async function fetchQuoteReplies(): Promise<QuoteReplySyncResult> {
  const profile = await mailAccountFor("TILBUD");
  const result: QuoteReplySyncResult = { processed: 0, skipped: 0, errors: [] };
  if (!profile?.imapHost || !profile.imapPass) {
    result.errors.push("IMAP er ikke sat op på tilbuds-mailkontoen. Udfyld IMAP under Indstillinger.");
    return result;
  }

  const prefix = ((await getSetting("quote_number_prefix")) || "TIL").toUpperCase();
  const lastUid = Number.parseInt((await getSetting("quote_imap_last_uid")) || "0", 10) || 0;
  const target = await resolveMailConnectHost(profile.imapHost);
  const clientFor = (host: string) =>
    new ImapFlow({
      host,
      port: profile.imapPort,
      secure: profile.imapPort === 993,
      auth: { user: profile.imapUser, pass: profile.imapPass },
      tls: { servername: target.servername },
      logger: false,
    });
  let client = clientFor(target.host);

  let lock: { release(): void } | undefined;
  try {
    try {
      await client.connect();
    } catch (error) {
      if (target.host === "127.0.0.1" || !isMailConnectRefused(error)) throw error;
      client = clientFor("127.0.0.1");
      await client.connect();
    }
    lock = await client.getMailboxLock(profile.imapFolder || "INBOX");
    const mailbox = client.mailbox;
    const uidNext = mailbox ? mailbox.uidNext ?? 1 : 1;
    if (lastUid > 0 && lastUid >= uidNext - 1) {
      return result;
    }

    const range = lastUid > 0 ? `${lastUid + 1}:*` : { since: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) };
    let maxUid = lastUid;
    for await (const msg of client.fetch(range, { envelope: true, source: true, uid: true })) {
      const uid = Number(msg.uid);
      if (uid > maxUid) maxUid = uid;
      const fromAddress = (msg.envelope?.from?.[0]?.address || "").toLowerCase();
      if (fromAddress && fromAddress === profile.fromEmail.toLowerCase()) {
        result.skipped += 1;
        continue;
      }
      const parsed = await simpleParser(msg.source ?? Buffer.from(""));
      const messageId = String(parsed.messageId || msg.envelope?.messageId || `uid-${uid}`);
      const existed = await prisma.quoteMailProcessed.findUnique({ where: { messageHash: hashMessage(messageId) } });
      if (existed) {
        result.skipped += 1;
        continue;
      }

      const subject = parsed.subject || msg.envelope?.subject || "";
      const body = parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ") : "");
      const inReplyTo = String(parsed.inReplyTo || "");
      const references = Array.isArray(parsed.references)
        ? parsed.references
        : parsed.references
          ? [parsed.references]
          : [];
      const headerBlob = [subject, body, inReplyTo, references.join(" ")].join("\n");
      const quoteNo = extractQuoteNumber(headerBlob, prefix);
      const headerId = extractQuoteIdFromHeaders(headerBlob);
      const messageIds = [...messageIdCandidates(inReplyTo), ...references.flatMap((id) => messageIdCandidates(String(id)))];

      const quote = quoteNo
        ? await prisma.quote.findUnique({ where: { quoteNumber: quoteNo } })
        : headerId
          ? await prisma.quote.findUnique({ where: { id: headerId } })
          : messageIds.length
            ? await prisma.quote.findFirst({ where: { emailedMessageId: { in: messageIds } } })
            : null;

      if (!quote) {
        await prisma.quoteMailProcessed.create({
          data: { messageHash: hashMessage(messageId), action: "unmatched" },
        });
        result.skipped += 1;
        continue;
      }

      const reply = customerReplyText(body, subject);
      const decision = quoteReplyDecision(reply);
      if (!decision) {
        await prisma.quoteMailProcessed.create({
          data: { messageHash: hashMessage(messageId), quoteId: quote.id, action: "no_decision" },
        });
        result.skipped += 1;
        continue;
      }

      const name = msg.envelope?.from?.[0]?.name?.trim() || fromAddress || "Kunden";
      const applied = await applyCustomerQuoteDecision(quote.id, decision, {
        name,
        note: reply.slice(0, 400),
      });
      if (!applied.ok) {
        await prisma.quoteMailProcessed.create({
          data: { messageHash: hashMessage(messageId), quoteId: quote.id, action: "ignored_status" },
        });
        result.skipped += 1;
        continue;
      }

      await prisma.quote.update({
        where: { id: quote.id },
        data: { repliedAt: new Date(), repliedFrom: fromAddress || name },
      });
      await prisma.quoteMailProcessed.create({
        data: { messageHash: hashMessage(messageId), quoteId: quote.id, action: decision },
      });
      result.processed += 1;
    }
    if (maxUid > lastUid) await setSetting("quote_imap_last_uid", String(maxUid));
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Ukendt IMAP-fejl");
  } finally {
    lock?.release();
    await client.logout().catch(() => undefined);
  }

  return result;
}

export async function fetchQuoteRepliesAllTenants() {
  const slugs = [...new Set([defaultTenantSlug(), ...readPlatform().tenants.map((tenant) => tenant.slug)])];
  const results: Array<{ slug: string } & QuoteReplySyncResult> = [];
  for (const slug of slugs) {
    enterTenant(slug);
    const result = await fetchQuoteReplies();
    results.push({ slug, ...result });
  }
  return results;
}
