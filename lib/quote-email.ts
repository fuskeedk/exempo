import { quoteEconomics } from "@/lib/coverage";
import { formatKr, VAT_RATE } from "@/lib/money";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type QuoteMailInput = {
  quoteNumber: string;
  title: string;
  description: string;
  validUntil: Date | null;
  customerName: string;
  address?: { street?: string | null; postal?: string | null; city?: string | null } | null;
  lines: { description: string; quantity: number; unitPrice: number }[];
  companyName: string;
  companyEmail: string;
  approveUrl: string;
  logoUrl?: string;
};

export function buildQuoteEmail(input: QuoteMailInput) {
  const totals = quoteEconomics(input.lines.map((line) => ({ ...line, costPrice: 0 })));
  const vat = Math.round(totals.sale * VAT_RATE);
  const gross = totals.sale + vat;
  const valid = input.validUntil ? input.validUntil.toLocaleDateString("da-DK") : "—";
  const company = input.companyName || "Exempo";
  const subject = `Tilbud ${input.quoteNumber} — ${company}`;
  const text = [
    `Tilbud ${input.quoteNumber}`,
    "",
    `Kære ${input.customerName},`,
    "",
    `Her er tilbud på ${input.title}.`,
    input.description ? `${input.description}` : "",
    "",
    `Netto: ${formatKr(totals.sale)}`,
    `Moms 25%: ${formatKr(vat)}`,
    `I alt: ${formatKr(gross)}`,
    `Gyldigt til: ${valid}`,
    "",
    "I kan svare på to måder:",
    `1) Åbn kundelinket og godkend eller afvis: ${input.approveUrl}`,
    `2) Svar på denne mail med Godkendt eller Nej tak (angiv ${input.quoteNumber}).`,
    "",
    "Med venlig hilsen",
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
  const place = [input.address?.street, [input.address?.postal, input.address?.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .map((part) => escapeHtml(part as string))
    .join("<br>");

  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#16382c;font-family:Georgia,serif;color:#1a1a18">
  <div style="max-width:640px;margin:0 auto">
    ${input.logoUrl ? `<p style="margin:0 0 12px"><img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(company)}" height="48" style="max-height:48px;max-width:180px;object-fit:contain"></p>` : ""}
    <p style="margin:0 0 8px;letter-spacing:.28em;text-transform:uppercase;font-size:11px;color:#d7c9a8;font-family:Arial,sans-serif">${escapeHtml(company)}</p>
    <h1 style="margin:0 0 8px;font-size:28px;color:#f4efe4">${escapeHtml(input.title)}</h1>
    <p style="margin:0 0 24px;color:#e4d8c0;font-family:Arial,sans-serif;font-size:14px">Tilbud ${escapeHtml(input.quoteNumber)} · gyldigt til ${escapeHtml(valid)}</p>
    <div style="background:#f3eee4;border-radius:24px;padding:28px">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6b6560;font-family:Arial,sans-serif">Kunde</p>
      <p style="margin:0 0 16px;font-weight:600">${escapeHtml(input.customerName)}${place ? `<br><span style="font-weight:400">${place}</span>` : ""}</p>
      ${input.description ? `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(input.description)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b6560;padding-bottom:8px">Ydelse</th>
            <th style="text-align:left;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b6560;padding-bottom:8px">Antal</th>
            <th style="text-align:right;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b6560;padding-bottom:8px">Pris</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:16px 0 4px;text-align:right;font-family:Arial,sans-serif;font-size:14px">Netto ${escapeHtml(formatKr(totals.sale))}<br>Moms 25% ${escapeHtml(formatKr(vat))}<br><strong>I alt ${escapeHtml(formatKr(gross))}</strong></p>
      <p style="margin:24px 0 0;text-align:center">
        <a href="${escapeHtml(input.approveUrl)}" style="display:inline-block;background:#b85c38;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-family:Arial,sans-serif;font-weight:700;font-size:14px">Se og godkend tilbud</a>
      </p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#3f3c38;font-family:Arial,sans-serif">
        <strong>To måder at svare på</strong><br>
        1. Åbn linket og godkend eller afvis tilbuddet.<br>
        2. Svar på denne e-mail med <strong>Godkendt</strong> eller <strong>Nej tak</strong>.
        Angiv gerne tilbudsnummer <strong>${escapeHtml(input.quoteNumber)}</strong>.
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#6b6560;font-family:Arial,sans-serif;word-break:break-all">${escapeHtml(input.approveUrl)}</p>
    </div>
    <p style="margin:20px 0 0;text-align:center;color:#d7c9a8;font-size:12px;font-family:Arial,sans-serif">Sendt med Exempo</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

export function quoteEmailMessageId(quoteId: string, fromEmail: string) {
  const domain = fromEmail.split("@")[1]?.replace(/[^a-z0-9.-]/gi, "") || "exempo.dk";
  return `<exempo-quote-${quoteId}.${Date.now()}@${domain}>`;
}
