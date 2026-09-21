import { createHash } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type Attachment, type ParsedMail } from "mailparser";
import {
  extractPdfText,
  looksLikeInvoiceMail,
  matchPurchaseCase,
  mergeParsedInvoices,
  parseInvoiceText,
  purchaseCaseReference,
  type ParsedInvoice,
} from "@/lib/invoice-parse";
import { isMailConnectRefused, mailAccountForImap, resolveMailConnectHost } from "@/lib/mail";
import { defaultTenantSlug, readPlatform } from "@/lib/platform";
import { enterTenant, prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { ingestPurchase } from "@/lib/sproom";

export type InvoiceMailSyncResult = {
  processed: number;
  matched: number;
  skipped: number;
  errors: string[];
};

function hashMessage(id: string) {
  return createHash("sha256").update(id.trim().toLowerCase()).digest("hex");
}

function addressText(value?: AddressObject | AddressObject[]) {
  const list = !value ? [] : Array.isArray(value) ? value : [value];
  return list
    .flatMap((item) => item.value.map((entry) => `${entry.name ?? ""} ${entry.address ?? ""}`))
    .join(" ")
    .trim();
}

function attachmentName(file: Attachment) {
  return file.filename || file.contentType || "bilag";
}

function isXmlAttachment(file: Attachment) {
  const name = attachmentName(file).toLowerCase();
  const type = (file.contentType || "").toLowerCase();
  return type.includes("xml") || name.endsWith(".xml") || name.endsWith(".ubl");
}

function isPdfAttachment(file: Attachment) {
  const name = attachmentName(file).toLowerCase();
  const type = (file.contentType || "").toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

function isInvoiceAttachment(file: Attachment) {
  return isXmlAttachment(file) || isPdfAttachment(file);
}

async function parseAttachment(file: Attachment): Promise<ParsedInvoice | null> {
  const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content ?? "");
  if (!buffer.length) return null;
  const name = attachmentName(file);
  if (isXmlAttachment(file)) {
    return parseInvoiceText(buffer.toString("utf8"), name);
  }
  if (isPdfAttachment(file)) {
    const text = await extractPdfText(buffer);
    return parseInvoiceText(text, name);
  }
  return null;
}

export async function parseInvoiceMail(parsed: ParsedMail, extraText = ""): Promise<ParsedInvoice> {
  const subject = parsed.subject || "";
  const body = parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ") : "");
  const from = addressText(parsed.from);
  const attachments = (parsed.attachments ?? []).filter(isInvoiceAttachment);
  const parts = await Promise.all(attachments.map((file) => parseAttachment(file)));
  const parsedParts = parts.filter((part): part is ParsedInvoice => Boolean(part));
  const headerText = [subject, from, body, extraText].join("\n");
  const header = parseInvoiceText(headerText, attachments[0] ? attachmentName(attachments[0]) : "", {
    supplierName: parsed.from?.value?.[0]?.name || "",
    note: subject.trim(),
  });
  return mergeParsedInvoices([...parsedParts, header], {
    supplierName: header.supplierName,
    invoiceNumber: header.invoiceNumber,
    note: `Mail: ${subject}`.trim(),
    fileName: attachments[0] ? attachmentName(attachments[0]) : "",
  });
}

async function matchAndIngest(externalId: string, parsed: ParsedInvoice, searchText: string) {
  const cases = await prisma.case.findMany({
    select: {
      id: true,
      caseNumber: true,
      title: true,
      customerAddress: true,
      customerCity: true,
      requisition: true,
      projectLeaderId: true,
    },
    take: 500,
    orderBy: { createdAt: "desc" },
  });
  const matched = matchPurchaseCase(searchText, cases, { invoiceNumber: parsed.invoiceNumber });
  const before = await prisma.purchase.count({
    where: { source: "MAIL", OR: [{ externalId }, ...(parsed.invoiceNumber.length >= 4 ? [{ invoiceNumber: parsed.invoiceNumber }] : [])] },
  });
  const purchase = await ingestPurchase("MAIL", {
    externalId,
    supplierName: parsed.supplierName,
    supplierCvr: parsed.supplierCvr,
    invoiceNumber: parsed.invoiceNumber,
    orderReference: matched ? purchaseCaseReference(matched) : parsed.orderReference,
    issuedAt: parsed.issuedAt,
    dueAt: parsed.dueAt,
    netAmount: parsed.netAmount,
    vatAmount: parsed.vatAmount,
    grossAmount: parsed.grossAmount,
    note: parsed.note,
    fileName: parsed.fileName,
    caseId: matched?.id ?? null,
    responsibleUserId: matched?.projectLeaderId ?? null,
    status: "MODTAGET",
    lines: parsed.lines,
  });
  return { purchase, matched: Boolean(matched), created: before === 0 };
}

export async function fetchInvoiceMail(): Promise<InvoiceMailSyncResult> {
  const profile = await mailAccountForImap("FAKTURA");
  const result: InvoiceMailSyncResult = { processed: 0, matched: 0, skipped: 0, errors: [] };
  if (!profile?.imapHost || !profile.imapPass) {
    result.errors.push("IMAP er ikke sat op på faktura-mailkontoen. Udfyld IMAP under Indstillinger.");
    return result;
  }

  const lastUid = Number.parseInt((await getSetting("invoice_imap_last_uid")) || "0", 10) || 0;
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

    const range = lastUid > 0 ? `${lastUid + 1}:*` : "1:*";
    let maxUid = lastUid;
    for await (const msg of client.fetch(range, { envelope: true, source: true, uid: true })) {
      const uid = Number(msg.uid);
      if (uid > maxUid) maxUid = uid;
      try {
        const parsed = await simpleParser(msg.source ?? Buffer.from(""));
        const messageId = String(parsed.messageId || msg.envelope?.messageId || `uid-${uid}`);
        const attachments = parsed.attachments ?? [];
        const hasInvoiceFile = attachments.some(isInvoiceAttachment);
        const subject = parsed.subject || msg.envelope?.subject || "";
        const body = parsed.text || "";
        if (!looksLikeInvoiceMail({ subject, text: body, hasAttachment: hasInvoiceFile })) {
          result.skipped += 1;
          continue;
        }

        if (!hasInvoiceFile) {
          result.skipped += 1;
          continue;
        }
        const invoice = await parseInvoiceMail(parsed);
        const searchText = [subject, body, invoice.text, invoice.orderReference, invoice.invoiceNumber].join("\n");
        const ingested = await matchAndIngest(`mail:${hashMessage(messageId)}`, invoice, searchText);
        if (ingested.created) {
          result.processed += 1;
          if (ingested.matched) result.matched += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : `UID ${uid} kunne ikke læses`);
      }
    }
    if (maxUid > lastUid) await setSetting("invoice_imap_last_uid", String(maxUid));
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Ukendt IMAP-fejl");
  } finally {
    lock?.release();
    await client.logout().catch(() => undefined);
  }

  return result;
}

export async function fetchInvoiceMailAllTenants() {
  const slugs = [...new Set([defaultTenantSlug(), ...readPlatform().tenants.map((tenant) => tenant.slug)])];
  const results: Array<{ slug: string } & InvoiceMailSyncResult> = [];
  for (const slug of slugs) {
    enterTenant(slug);
    const result = await fetchInvoiceMail();
    results.push({ slug, ...result });
  }
  return results;
}
