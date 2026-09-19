import Link from "next/link";
import { notFound } from "next/navigation";
import { convertQuoteToCaseAction, setQuoteStatusAction } from "@/app/actions/quotes";
import { PrintButton } from "@/components/PrintButton";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { PRICING_MODE_LABELS, QUOTE_STATUS_LABELS, type PricingMode, type QuoteStatus } from "@/lib/catalog";
import { quoteEconomics } from "@/lib/coverage";
import { formatKr, VAT_RATE } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, address: true, lines: true, cases: true },
  });
  if (!quote) notFound();
  const totals = quoteEconomics(quote.lines);
  const vat = Math.round(totals.sale * VAT_RATE);
  const gross = totals.sale + vat;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={quote.quoteNumber}
        title={quote.title}
        description={`${quote.customer.name} · ${PRICING_MODE_LABELS[quote.pricingMode as PricingMode] ?? quote.pricingMode}`}
        actions={<PrintButton>Udskriv tilbud</PrintButton>}
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Status: <strong>{QUOTE_STATUS_LABELS[quote.status as QuoteStatus] ?? quote.status}</strong>
          </p>
          <form action={setQuoteStatusAction} className="no-print flex flex-wrap gap-2">
            <input type="hidden" name="quoteId" value={quote.id} />
            {quote.status === "KLADDE" ? (
              <button name="status" value="SENDT" className="rounded-full bg-rust px-4 py-2 text-sm font-semibold text-white">
                Send til kunden
              </button>
            ) : null}
            {quote.status === "SENDT" ? (
              <>
                <button name="status" value="GODKENDT" className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white">
                  Kunden har godkendt
                </button>
                <button name="status" value="AFVIST" className="rounded-full border border-line px-4 py-2 text-sm font-semibold">
                  Afvist
                </button>
              </>
            ) : null}
          </form>
        </div>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Kunde</p>
            <p className="mt-1 font-medium">{quote.customer.name}</p>
            <p>{quote.address?.street}</p>
            <p>
              {quote.address?.postal} {quote.address?.city}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Gyldig til</p>
            <p className="mt-1">{quote.validUntil ? quote.validUntil.toLocaleDateString("da-DK") : "—"}</p>
          </div>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="pb-2">Linje</th>
              <th>Antal</th>
              <th className="text-right">Salgspris</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id} className="border-t border-line">
                <td className="py-2">{line.description}</td>
                <td>{line.quantity}</td>
                <td className="text-right">{formatKr(Math.round(line.quantity * line.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Netto</dt>
            <dd>{formatKr(totals.sale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Moms 25%</dt>
            <dd>{formatKr(vat)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold">
            <dt>I alt</dt>
            <dd>{formatKr(gross)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Kost / DG</dt>
            <dd>
              {formatKr(totals.cost)}
              {totals.coverage === null ? "" : ` · ${Math.round(totals.coverage * 100)} %`}
            </dd>
          </div>
        </dl>
        {quote.status === "GODKENDT" && quote.cases.length === 0 ? (
          <form action={convertQuoteToCaseAction} className="no-print mt-6">
            <input type="hidden" name="quoteId" value={quote.id} />
            <SubmitButton>Opret arbejdsseddel</SubmitButton>
          </form>
        ) : null}
        {quote.cases.map((sag) => (
          <p key={sag.id} className="mt-4 text-sm">
            Arbejdsseddel: <Link className="underline" href={`/sager/${sag.id}`}>{sag.caseNumber}</Link>
          </p>
        ))}
      </Card>
    </div>
  );
}
