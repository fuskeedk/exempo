import { invoiceDocumentTitle } from "@/lib/catalog";
import { formatDate } from "@/lib/dates";
import { formatKr, VAT_RATE } from "@/lib/money";
import { invoiceNet } from "@/lib/coverage";

export type InvoicePreviewLine = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceCompany = {
  name: string;
  cvr: string;
  address: string;
  postal: string;
  city: string;
  phone: string;
  email: string;
  bankName?: string;
  bankReg?: string;
  bankAccount?: string;
  bankIban?: string;
  bankSwift?: string;
  logoUrl?: string;
};

function companyBankRows(company: InvoiceCompany) {
  return [
    company.bankName?.trim() ? ["Bank", company.bankName.trim()] : null,
    company.bankReg?.trim() ? ["Reg.nr.", company.bankReg.trim()] : null,
    company.bankAccount?.trim() ? ["Kontonr.", company.bankAccount.trim()] : null,
    company.bankIban?.trim() ? ["IBAN", company.bankIban.trim()] : null,
    company.bankSwift?.trim() ? ["SWIFT/BIC", company.bankSwift.trim()] : null,
  ].filter((row): row is [string, string] => Boolean(row));
}

export type InvoiceCustomer = {
  name: string;
  address: string;
  postal: string;
  city: string;
  vatNumber?: string;
};

export function InvoiceDocument({
  invoiceNumber,
  kind,
  status,
  issuedAt,
  dueAt,
  notes,
  caseNumber,
  caseTitle,
  insuranceCompany,
  claimNumber,
  company,
  customer,
  lines,
}: {
  invoiceNumber: string;
  kind: string;
  status: string;
  issuedAt: Date | string;
  dueAt?: Date | string | null;
  notes?: string;
  caseNumber: string;
  caseTitle: string;
  insuranceCompany?: string;
  claimNumber?: string;
  company: InvoiceCompany;
  customer: InvoiceCustomer;
  lines: InvoicePreviewLine[];
}) {
  const issued = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
  const due = dueAt ? (dueAt instanceof Date ? dueAt : new Date(dueAt)) : null;
  const visible = lines.filter((line) => line.description.trim() || line.unitPrice || line.quantity);
  const net = invoiceNet(visible);
  const vat = Math.round(net * VAT_RATE);
  const gross = net + vat;
  const title = invoiceDocumentTitle(kind);
  const bankRows = companyBankRows(company);

  return (
    <article className="inv-paper" aria-label={`${title} ${invoiceNumber}`}>
      <header className="inv-paper-head">
        <div>
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.name || "Logo"} className="inv-logo" />
          ) : null}
          <p className="inv-brand">{company.name || "Exempo"}</p>
          <p>{company.address}</p>
          <p>
            {company.postal} {company.city}
          </p>
          {company.cvr ? <p>CVR {company.cvr}</p> : null}
          {company.phone ? <p>Tlf. {company.phone}</p> : null}
          {company.email ? <p>{company.email}</p> : null}
        </div>
        <div className="inv-paper-meta">
          <p className="inv-doctype">{title}</p>
          <p className="inv-number">{invoiceNumber}</p>
          {status === "KLADDE" ? <p className="inv-draft-mark">Kladde — ikke sendt</p> : null}
        </div>
      </header>

      <section className="inv-paper-grid">
        <div>
          <p className="inv-kicker">Kunde</p>
          <p className="inv-strong">{customer.name}</p>
          <p>{customer.address}</p>
          <p>
            {customer.postal} {customer.city}
          </p>
          {customer.vatNumber ? <p>CVR {customer.vatNumber}</p> : null}
        </div>
        <div>
          <p className="inv-kicker">Detaljer</p>
          <p>Sag {caseNumber}</p>
          <p>{caseTitle}</p>
          <p>Dato {formatDate(issued)}</p>
          {due ? <p>Forfald {formatDate(due)}</p> : null}
          {insuranceCompany ? (
            <p>
              {insuranceCompany}
              {claimNumber ? ` · ${claimNumber}` : ""}
            </p>
          ) : null}
        </div>
      </section>

      <table className="inv-paper-table">
        <thead>
          <tr>
            <th>Beskrivelse</th>
            <th>Antal</th>
            <th>Pris</th>
            <th>Beløb</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={4} className="inv-empty">
                Ingen linjer endnu
              </td>
            </tr>
          ) : (
            visible.map((line, index) => (
              <tr key={line.id ?? `${line.description}-${index}`}>
                <td>{line.description || "—"}</td>
                <td>{String(line.quantity).replace(".", ",")}</td>
                <td>{formatKr(line.unitPrice, true)}</td>
                <td>{formatKr(Math.round(line.quantity * line.unitPrice), true)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <dl className="inv-paper-totals">
        <div>
          <dt>Netto</dt>
          <dd>{formatKr(net, true)}</dd>
        </div>
        <div>
          <dt>Moms 25%</dt>
          <dd>{formatKr(vat, true)}</dd>
        </div>
        <div className="inv-total">
          <dt>I alt</dt>
          <dd>{formatKr(gross, true)}</dd>
        </div>
      </dl>

      {notes?.trim() ? <p className="inv-notes">{notes}</p> : null}
      {kind === "ACONTO" ? (
        <p className="inv-notes">Acontofaktura. Beløbet modregnes på den endelige faktura.</p>
      ) : null}
      {bankRows.length ? (
        <section className="inv-bank">
          <p className="inv-kicker">Betaling</p>
          {bankRows.map(([label, value]) => (
            <p key={label}>
              <span>{label}</span> {value}
            </p>
          ))}
        </section>
      ) : null}
    </article>
  );
}
