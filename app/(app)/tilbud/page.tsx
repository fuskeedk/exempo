import Link from "next/link";
import { Card, PageHeader, PrimaryLink } from "@/components/ui";
import { canManageOffice, requireSession } from "@/lib/auth";
import { PRICING_MODE_LABELS, QUOTE_STATUS_LABELS, type PricingMode, type QuoteStatus } from "@/lib/catalog";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function QuotesPage() {
  const user = await requireSession();
  const office = canManageOffice(user.role);
  const quotes = await prisma.quote.findMany({
    include: { customer: true, lines: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader
        kicker="Salg"
        title="Tilbud"
        description="Opret tilbud efter forbrug, fast pris eller kalkulation — og omdan godkendte tilbud til arbejdssedler."
        actions={office ? <PrimaryLink href="/tilbud/ny">Nyt tilbud</PrimaryLink> : null}
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Tilbud</th>
              <th className="px-5 py-3">Kunde</th>
              <th className="px-5 py-3">Prisform</th>
              <th className="px-5 py-3">Beløb</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const total = Math.round(
                quote.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
              );
              return (
                <tr key={quote.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <Link href={`/tilbud/${quote.id}`} className="font-medium hover:underline">
                      {quote.quoteNumber}
                      <span className="block font-normal text-muted">{quote.title}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3">{quote.customer.name}</td>
                  <td className="px-5 py-3">
                    {PRICING_MODE_LABELS[quote.pricingMode as PricingMode] ?? quote.pricingMode}
                  </td>
                  <td className="px-5 py-3">{formatKr(total)}</td>
                  <td className="px-5 py-3">
                    {QUOTE_STATUS_LABELS[quote.status as QuoteStatus] ?? quote.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
