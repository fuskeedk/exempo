import { invoiceDocumentTitle } from "@/lib/catalog";
import { invoiceNet } from "@/lib/coverage";
import { formatDate } from "@/lib/dates";
import { formatKr, VAT_RATE } from "@/lib/money";
import { isEmail } from "@/lib/quote-email";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

export function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => (value ?? "").trim().toLowerCase()).filter(isEmail))];
}

export function invoiceCustomerEmail(input: { customerEmail?: string | null; caseEmail?: string | null }) {
  return uniqueEmails([input.customerEmail, input.caseEmail])[0] ?? "";
}

export function buildOfficeQuoteMail(input: {
  companyName: string;
  decision: "godkend" | "afvis";
  quoteNumber: string;
  customerName: string;
  approvedName?: string;
  note?: string;
  href: string;
}) {
  const accepted = input.decision === "godkend";
  const subject = accepted
    ? `${input.customerName} har godkendt ${input.quoteNumber}`
    : `${input.customerName} har afvist ${input.quoteNumber}`;
  const who = input.approvedName?.trim();
  const note = input.note?.trim();
  const text = [subject, who ? `Svaret er fra ${who}.` : "", note || "", input.href, input.companyName || "Exempo"]
    .filter(Boolean)
    .join("\n");
  const html = `<p><strong>${escapeHtml(subject)}</strong></p>
${who ? `<p>Svaret er fra ${escapeHtml(who)}.</p>` : ""}
${note ? `<p>${escapeHtml(note)}</p>` : ""}
<p><a href="${escapeHtml(input.href)}">${escapeHtml(input.href)}</a></p>`;
  return { subject, text, html };
}

export function buildIdleCasesMail(input: {
  companyName: string;
  items: Array<{ title: string; detail: string; href: string }>;
}) {
  const subject =
    input.items.length === 1 ? "1 sag har stået stille i 8 dage" : `${input.items.length} sager har stået stille i 8 dage`;
  const text = [
    subject,
    "",
    ...input.items.map((item) => `- ${item.title} · ${item.detail} · ${item.href}`),
    "",
    input.companyName || "Exempo",
  ].join("\n");
  const rows = input.items
    .map(
      (item) =>
        `<li style="margin:0 0 10px"><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a><br><span>${escapeHtml(item.detail)}</span></li>`,
    )
    .join("");
  const html = `<p><strong>${escapeHtml(subject)}</strong></p><ul>${rows}</ul>`;
  return { subject, text, html };
}

export type InvoiceMailLine = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function buildInvoiceEmail(input: {
  invoiceNumber: string;
  kind: string;
  customerName: string;
  address?: string;
  postal?: string;
  city?: string;
  notes?: string;
  dueAt: Date | null;
  lines: InvoiceMailLine[];
  companyName: string;
  companyEmail: string;
  bankName?: string;
  bankReg?: string;
  bankAccount?: string;
}) {
  const title = invoiceDocumentTitle(input.kind);
  const net = invoiceNet(input.lines);
  const vat = Math.round(net * VAT_RATE);
  const gross = net + vat;
  const due = input.dueAt ? formatDate(input.dueAt) : "—";
  const company = input.companyName || "Exempo";
  const subject = `${title} ${input.invoiceNumber} — ${company}`;
  const place = [input.address, [input.postal, input.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const bank = [
    input.bankName,
    input.bankReg && input.bankAccount ? `${input.bankReg} ${input.bankAccount}` : input.bankAccount,
  ]
    .filter(Boolean)
    .join(" · ");
  const text = [
    `${title} ${input.invoiceNumber}`,
    "",
    input.customerName,
    place,
    "",
    `Netto: ${formatKr(net)}`,
    `Moms 25%: ${formatKr(vat)}`,
    `I alt: ${formatKr(gross)}`,
    `Forfald: ${due}`,
    bank ? `Betaling: ${bank}` : "",
    input.notes?.trim() || "",
    "",
    company,
    input.companyEmail,
  ]
    .filter((line, index, rows) => line !== "" || rows[index - 1] !== "")
    .join("\n");

  const rows = input.lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:8px 0;border-top:1px solid #e6dfd2">${escapeHtml(line.description)}</td>
          <td style="padding:8px 8px 8px 0;border-top:1px solid #e6dfd2">${String(line.quantity).replace(".", ",")}</td>
          <td style="padding:8px 0;border-top:1px solid #e6dfd2;text-align:right">${escapeHtml(formatKr(Math.round(line.quantity * line.unitPrice)))}</td>
        </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#16382c;font-family:Georgia,serif;color:#1a1a18">
  <div style="max-width:640px;margin:0 auto">
    <p style="margin:0 0 8px;letter-spacing:.28em;text-transform:uppercase;font-size:11px;color:#d7c9a8;font-family:Arial,sans-serif">${escapeHtml(company)}</p>
    <h1 style="margin:0 0 8px;font-size:28px;color:#f4efe4">${escapeHtml(title)} ${escapeHtml(input.invoiceNumber)}</h1>
    <p style="margin:0 0 24px;color:#e4d8c0;font-family:Arial,sans-serif;font-size:14px">Forfald ${escapeHtml(due)}</p>
    <div style="background:#f3eee4;border-radius:24px;padding:28px">
      <p style="margin:0 0 16px;font-weight:600">${escapeHtml(input.customerName)}${place ? `<br><span style="font-weight:400">${escapeHtml(place)}</span>` : ""}</p>
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:16px 0 0;text-align:right;font-family:Arial,sans-serif;font-size:14px">Netto ${escapeHtml(formatKr(net))}<br>Moms 25% ${escapeHtml(formatKr(vat))}<br><strong>I alt ${escapeHtml(formatKr(gross))}</strong></p>
      ${bank ? `<p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:14px">Betaling: ${escapeHtml(bank)}</p>` : ""}
      ${input.notes?.trim() ? `<p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:13px">${escapeHtml(input.notes.trim())}</p>` : ""}
    </div>
  </div>
</body></html>`;

  return { subject, text, html };
}
