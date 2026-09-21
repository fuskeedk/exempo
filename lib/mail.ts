import { lookup } from "node:dns/promises";
import { networkInterfaces } from "node:os";
import nodemailer from "nodemailer";
import { MAIL_PURPOSES, type MailPurpose } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export type MailProfile = {
  fromEmail: string;
  fromName: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  encryption: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapFolder: string;
};

function ready(account: { smtpHost: string; smtpPassword: string }) {
  return Boolean(account.smtpHost.trim() && account.smtpPassword.trim());
}

export function imapReady(account: {
  imapHost: string;
  smtpHost: string;
  imapPassword: string;
  smtpPassword: string;
}) {
  const host = account.imapHost.trim() || account.smtpHost.trim();
  const pass = account.imapPassword.trim() || account.smtpPassword.trim();
  return Boolean(host && pass);
}

type MailAccountRow = {
  address: string;
  name: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpEncryption: string;
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPassword: string;
  imapFolder: string;
};

export type MailAccountInput = {
  name: string;
  address: string;
  purpose: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpEncryption: string;
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPassword: string;
  imapFolder: string;
};

export function parseMailAccountInput(
  raw: Record<string, string>,
  existing?: { smtpPassword?: string; imapPassword?: string },
): { error: string } | { data: MailAccountInput } {
  const address = (raw.address ?? "").trim().toLowerCase();
  if (!address) return { error: "E-mailadresse er påkrævet." };
  const purposeRaw = (raw.purpose ?? "").trim();
  const purpose = MAIL_PURPOSES.includes(purposeRaw as MailPurpose) ? purposeRaw : "FAKTURA";
  return {
    data: {
      name: (raw.name ?? "").trim() || address,
      address,
      purpose,
      smtpHost: (raw.smtpHost ?? "").trim(),
      smtpPort: (raw.smtpPort ?? "").trim() || "587",
      smtpUser: (raw.smtpUser ?? "").trim() || address,
      smtpPassword: (raw.smtpPassword ?? "").trim() || existing?.smtpPassword || "",
      smtpEncryption: (raw.smtpEncryption ?? "").trim() || "tls",
      imapHost: (raw.imapHost ?? "").trim(),
      imapPort: (raw.imapPort ?? "").trim() || "993",
      imapUser: (raw.imapUser ?? "").trim() || address,
      imapPassword: (raw.imapPassword ?? "").trim() || existing?.imapPassword || "",
      imapFolder: (raw.imapFolder ?? "").trim() || "INBOX",
    },
  };
}

export function mailProfileFromAccount(
  account: MailAccountRow,
  companyName = "Exempo",
  opts?: { requireSmtp?: boolean },
): MailProfile | null {
  const requireSmtp = opts?.requireSmtp !== false;
  if (requireSmtp && !ready(account)) return null;
  if (!requireSmtp && !imapReady(account) && !ready(account)) return null;
  const fromEmail = account.address.trim() || account.smtpUser.trim();
  if (!fromEmail) return null;
  return {
    fromEmail,
    fromName: account.name.trim() || companyName || "Exempo",
    host: account.smtpHost.trim(),
    port: Number.parseInt(account.smtpPort || "587", 10) || 587,
    user: account.smtpUser.trim() || fromEmail,
    pass: account.smtpPassword,
    encryption: (account.smtpEncryption || "tls").toLowerCase(),
    imapHost: account.imapHost.trim() || account.smtpHost.trim(),
    imapPort: Number.parseInt(account.imapPort || "993", 10) || 993,
    imapUser: account.imapUser.trim() || account.smtpUser.trim() || fromEmail,
    imapPass: account.imapPassword.trim() || account.smtpPassword,
    imapFolder: account.imapFolder.trim() || "INBOX",
  };
}

export function buildMailTestMessage(input: { fromName: string; fromEmail: string; purposeLabel: string }) {
  const name = input.fromName.trim() || "Exempo";
  const subject = `Testmail fra ${name}`;
  const text = [
    `Dette er en testmail fra ${name}.`,
    `Sendt fra ${input.fromEmail} (${input.purposeLabel}).`,
    "Hvis du kan læse denne mail, virker SMTP-opsætningen.",
  ].join("\n");
  const html = `<p>Dette er en testmail fra <strong>${escapeHtml(name)}</strong>.</p>
<p>Sendt fra ${escapeHtml(input.fromEmail)} (${escapeHtml(input.purposeLabel)}).</p>
<p>Hvis du kan læse denne mail, virker SMTP-opsætningen.</p>`;
  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

export async function mailAccountFor(
  purpose: MailPurpose,
  opts?: { requireSmtp?: boolean },
): Promise<MailProfile | null> {
  const [accounts, settings] = await Promise.all([
    prisma.mailAccount.findMany({ orderBy: { createdAt: "asc" } }),
    getSettings(),
  ]);
  const requireSmtp = opts?.requireSmtp !== false;
  const usable = accounts.filter((account) => (requireSmtp ? ready(account) : imapReady(account) || ready(account)));
  const pick =
    usable.find((account) => account.purpose === purpose) ??
    usable.find((account) => account.purpose === "GENEREL") ??
    usable[0];
  if (!pick) return null;
  return mailProfileFromAccount(pick, settings.company_name, { requireSmtp });
}

export async function mailAccountForImap(purpose: MailPurpose): Promise<MailProfile | null> {
  return mailAccountFor(purpose, { requireSmtp: false });
}

export function localMailAddresses(extras: string[] = []) {
  const ips = new Set(["127.0.0.1", "::1", ...extras]);
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) ips.add(item.address);
  }
  return ips;
}

export function shouldUseLocalMailSocket(resolvedIp: string, localIps = localMailAddresses()) {
  return localIps.has(resolvedIp);
}

export function isMailConnectRefused(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
  const text = error instanceof Error ? error.message : String(error ?? "");
  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EHOSTUNREACH" ||
    /econnrefused|etimedout|ehostunreach/i.test(text)
  );
}

export async function resolveMailConnectHost(hostname: string): Promise<{ host: string; servername: string }> {
  const servername = hostname.trim() || "localhost";
  const lowered = servername.toLowerCase();
  if (lowered === "localhost" || lowered === "127.0.0.1" || lowered === "::1") {
    return { host: "127.0.0.1", servername };
  }
  try {
    const { address } = await lookup(servername);
    if (shouldUseLocalMailSocket(address)) {
      return { host: "127.0.0.1", servername };
    }
  } catch {
    return { host: servername, servername };
  }
  return { host: servername, servername };
}

async function deliverMail(
  connectHost: string,
  servername: string,
  input: {
    profile: MailProfile;
    to: string;
    subject: string;
    text: string;
    html: string;
    messageId?: string;
  },
) {
  const secure = input.profile.encryption === "ssl" || input.profile.port === 465;
  const requireTLS = !secure && (input.profile.encryption === "tls" || input.profile.port === 587);
  const transporter = nodemailer.createTransport({
    host: connectHost,
    port: input.profile.port,
    secure,
    requireTLS,
    auth: {
      user: input.profile.user,
      pass: input.profile.pass,
    },
    tls: {
      servername,
    },
  });
  const info = await transporter.sendMail({
    from: `"${input.profile.fromName.replace(/"/g, "")}" <${input.profile.fromEmail}>`,
    to: input.to,
    replyTo: input.profile.fromEmail,
    subject: input.subject,
    text: input.text,
    html: input.html,
    messageId: input.messageId,
  });
  return { messageId: String(info.messageId || input.messageId || "") };
}

export async function sendMail(input: {
  profile: MailProfile;
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId?: string;
}) {
  const target = await resolveMailConnectHost(input.profile.host);
  try {
    return await deliverMail(target.host, target.servername, input);
  } catch (error) {
    if (target.host !== "127.0.0.1" && isMailConnectRefused(error)) {
      return await deliverMail("127.0.0.1", target.servername, input);
    }
    throw error;
  }
}
