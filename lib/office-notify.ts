import { canManageOffice } from "@/lib/auth";
import { loadInbox } from "@/lib/inbox";
import { mailAccountFor, sendMail } from "@/lib/mail";
import { buildIdleCasesMail, buildOfficeQuoteMail, uniqueEmails } from "@/lib/notify-copy";
import { appUrl, defaultTenantSlug, readPlatform } from "@/lib/platform";
import { currentTenantSlug, enterTenant, prisma, tenantPrisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export { buildIdleCasesMail, buildOfficeQuoteMail, uniqueEmails } from "@/lib/notify-copy";

export async function officeRecipientEmails() {
  const [settings, users] = await Promise.all([
    getSettings(),
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "PL"] } },
      select: { email: true, role: true },
    }),
  ]);
  return uniqueEmails([
    settings.company_email,
    ...users.filter((user) => canManageOffice(user.role)).map((user) => user.email),
  ]);
}

async function sendOfficeMail(subject: string, text: string, html: string) {
  const [profile, recipients] = await Promise.all([mailAccountFor("TILBUD"), officeRecipientEmails()]);
  if (!profile || recipients.length === 0) return { sent: 0 };
  let sent = 0;
  for (const to of recipients) {
    await sendMail({ profile, to, subject, text, html });
    sent += 1;
  }
  return { sent };
}

export async function notifyOfficeQuoteDecision(input: {
  decision: "godkend" | "afvis";
  quoteNumber: string;
  customerName: string;
  approvedName?: string;
  note?: string;
  path: string;
}) {
  const settings = await getSettings();
  const mail = buildOfficeQuoteMail({
    companyName: settings.company_name,
    decision: input.decision,
    quoteNumber: input.quoteNumber,
    customerName: input.customerName,
    approvedName: input.approvedName,
    note: input.note,
    href: `${appUrl()}${input.path}`,
  });
  return sendOfficeMail(mail.subject, mail.text, mail.html);
}

export async function notifyIdleCasesForTenant() {
  const settings = await getSettings();
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "PL"] } },
    select: { id: true, email: true, role: true },
  });
  const office = users.filter((user) => canManageOffice(user.role));
  if (office.length === 0) return { sent: 0, items: 0 };
  const items = await loadInbox(prisma, {
    id: office[0].id,
    office: true,
    tenantSlug: currentTenantSlug(),
  });
  const stale = items.filter((item) => item.kind === "case_stale");
  if (stale.length === 0) return { sent: 0, items: 0 };
  const mail = buildIdleCasesMail({
    companyName: settings.company_name,
    items: stale.map((item) => ({
      title: item.title,
      detail: item.detail,
      href: `${appUrl()}${item.href}`,
    })),
  });
  const result = await sendOfficeMail(mail.subject, mail.text, mail.html);
  return { sent: result.sent, items: stale.length };
}

export async function notifyIdleCasesAllTenants() {
  const slugs = [...new Set([defaultTenantSlug(), ...readPlatform().tenants.map((tenant) => tenant.slug)])];
  const results: Array<{ slug: string; sent: number; items: number }> = [];
  for (const slug of slugs) {
    enterTenant(slug);
    tenantPrisma(slug);
    results.push({ slug, ...(await notifyIdleCasesForTenant()) });
  }
  return results;
}
