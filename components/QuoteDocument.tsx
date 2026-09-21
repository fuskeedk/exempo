import type { ReactNode } from "react";
import { quoteEconomics } from "@/lib/coverage";
import { formatKr, VAT_RATE } from "@/lib/money";

export type QuotePreviewLine = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuotePreviewAddress = {
  street?: string | null;
  postal?: string | null;
  city?: string | null;
};

export function QuoteDocument({
  quoteNumber,
  title,
  description,
  validUntil,
  customerName,
  address,
  lines,
  companyName,
  logoUrl,
  statusLabel = "Kladde — som kunden vil se det",
  children,
}: {
  quoteNumber: string;
  title: string;
  description?: string;
  validUntil?: Date | string | null;
  customerName: string;
  address?: QuotePreviewAddress | null;
  lines: QuotePreviewLine[];
  companyName: string;
  logoUrl?: string;
  statusLabel?: string;
  children?: ReactNode;
}) {
  const visible = lines.filter((line) => line.description.trim());
  const totals = quoteEconomics(visible.map((line) => ({ ...line, costPrice: 0 })));
  const vat = Math.round(totals.sale * VAT_RATE);
  const gross = totals.sale + vat;
  const until =
    validUntil instanceof Date
      ? validUntil
      : validUntil
        ? new Date(validUntil)
        : null;
  const validLabel = until && !Number.isNaN(until.getTime()) ? until.toLocaleDateString("da-DK") : "—";
  const company = companyName || "Exempo";
  const place = [address?.street, [address?.postal, address?.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="quote-sheet" aria-label={`Tilbud ${quoteNumber}`}>
      <header className="quote-sheet-head">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={company} className="quote-sheet-logo" />
        ) : null}
        <p className="quote-sheet-brand">{company}</p>
        <h1>{title || "Nyt tilbud"}</h1>
        <p className="quote-sheet-meta">
          Tilbud {quoteNumber || "—"} · gyldigt til {validLabel}
        </p>
      </header>
      <div className="quote-sheet-card">
        <div className="quote-sheet-grid">
          <div>
            <p className="quote-sheet-kicker">Kunde</p>
            <p className="quote-sheet-strong">{customerName || "Vælg kunde"}</p>
            {place ? <p>{place}</p> : null}
          </div>
          <div>
            <p className="quote-sheet-kicker">Status</p>
            <p className="quote-sheet-strong">{statusLabel}</p>
          </div>
        </div>
        {description?.trim() ? <p className="quote-sheet-desc">{description}</p> : null}
        <table className="quote-sheet-table">
          <thead>
            <tr>
              <th>Ydelse</th>
              <th>Antal</th>
              <th>Pris</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={3} className="quote-sheet-empty">
                  Linjer vises her, når I skriver kalkulationen
                </td>
              </tr>
            ) : (
              visible.map((line, index) => (
                <tr key={`${line.description}-${index}`}>
                  <td>{line.description}</td>
                  <td>{String(line.quantity).replace(".", ",")}</td>
                  <td>{formatKr(Math.round(line.quantity * line.unitPrice))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <dl className="quote-sheet-totals">
          <div>
            <dt>Netto</dt>
            <dd>{formatKr(totals.sale)}</dd>
          </div>
          <div>
            <dt>Moms 25%</dt>
            <dd>{formatKr(vat)}</dd>
          </div>
          <div className="quote-sheet-total">
            <dt>I alt</dt>
            <dd>{formatKr(gross)}</dd>
          </div>
        </dl>
        {children}
      </div>
    </article>
  );
}
