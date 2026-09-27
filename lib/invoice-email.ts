import { mailAccountFor, sendMail } from "@/lib/mail";
import { buildInvoiceEmail, invoiceCustomerEmail, type InvoiceMailLine } from "@/lib/notify-copy";
import { isEmail } from "@/lib/quote-email";
import { getSettings } from "@/lib/settings";

export { buildInvoiceEmail, invoiceCustomerEmail, type InvoiceMailLine } from "@/lib/notify-copy";

export async function sendIssuedInvoiceMail(input: {
  to: string;
  invoiceNumber: string;
  kind: string;
  customerName: string;
  address?: string;
  postal?: string;
  city?: string;
  notes?: string;
  dueAt: Date | null;
  lines: InvoiceMailLine[];
}) {
  if (!isEmail(input.to)) return { sent: false as const, reason: "Ingen e-mail på kunden." };
  const [profile, settings] = await Promise.all([mailAccountFor("FAKTURA"), getSettings()]);
  if (!profile) return { sent: false as const, reason: "Faktura-mail er ikke sat op." };
  const mail = buildInvoiceEmail({
    invoiceNumber: input.invoiceNumber,
    kind: input.kind,
    customerName: input.customerName,
    address: input.address,
    postal: input.postal,
    city: input.city,
    notes: input.notes,
    dueAt: input.dueAt,
    lines: input.lines,
    companyName: settings.company_name,
    companyEmail: settings.company_email || profile.fromEmail,
    bankName: settings.company_bank_name,
    bankReg: settings.company_bank_reg,
    bankAccount: settings.company_bank_account,
  });
  await sendMail({
    profile,
    to: input.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return { sent: true as const };
}
