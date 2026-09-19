import Link from "next/link";
import { notFound } from "next/navigation";
import { setInvoiceStatusAction } from "@/app/actions/invoices";
import { InvoiceBadge } from "@/components/StatusBadge";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { invoiceNet } from "@/lib/coverage";
import { formatDate } from "@/lib/dates";
import { formatKr, VAT_RATE } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "PL"]);
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { case: true, createdBy: true, lines: true },
  });
  if (!invoice) notFound();

  const net = invoiceNet(invoice.lines);
  const vat = Math.round(net * VAT_RATE);
  const gross = net + vat;

  return (
    <>
      <PageHeader
        kicker="Faktura"
        title={invoice.invoiceNumber}
        description={invoice.case.title}
        actions={
          <Link href={`/sager/${invoice.caseId}`} className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold">
            Åbn sag
          </Link>
        }
      />
      <Card className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-3xl">Exempo</p>
            <p className="text-sm text-muted">Sagshåndtering · CVR demo</p>
          </div>
          <InvoiceBadge status={invoice.status} />
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Kunde</p>
            <p className="mt-1 font-medium">{invoice.case.customerName}</p>
            <p>{invoice.case.customerAddress}</p>
            <p>
              {invoice.case.customerPostal} {invoice.case.customerCity}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Detaljer</p>
            <p className="mt-1">Sag {invoice.case.caseNumber}</p>
            <p>Dato {formatDate(invoice.issuedAt)}</p>
            {invoice.dueAt ? <p>Forfald {formatDate(invoice.dueAt)}</p> : null}
            {invoice.case.insuranceCompany ? (
              <p>
                {invoice.case.insuranceCompany} · {invoice.case.claimNumber}
              </p>
            ) : null}
          </div>
        </div>
        <table className="mt-8 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="pb-2">Beskrivelse</th>
              <th className="pb-2">Antal</th>
              <th className="pb-2 text-right">Pris</th>
              <th className="pb-2 text-right">Beløb</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-t border-line">
                <td className="py-2">{line.description}</td>
                <td>{line.quantity}</td>
                <td className="text-right">{formatKr(line.unitPrice, true)}</td>
                <td className="text-right">{formatKr(Math.round(line.quantity * line.unitPrice), true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Netto</dt>
            <dd>{formatKr(net, true)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Moms 25%</dt>
            <dd>{formatKr(vat, true)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold">
            <dt>I alt</dt>
            <dd>{formatKr(gross, true)}</dd>
          </div>
        </dl>
        {invoice.notes ? <p className="mt-6 text-sm text-muted">{invoice.notes}</p> : null}
        <form action={setInvoiceStatusAction} className="no-print mt-8 flex flex-wrap gap-3">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          {invoice.status === "KLADDE" ? (
            <button name="status" value="SENDT" className="rounded-full bg-rust px-4 py-2.5 text-sm font-semibold text-white">
              Markér som sendt
            </button>
          ) : null}
          {invoice.status === "SENDT" ? (
            <button name="status" value="BETALT" className="rounded-full bg-pine px-4 py-2.5 text-sm font-semibold text-white">
              Markér som betalt
            </button>
          ) : null}
          {invoice.status !== "KLADDE" ? (
            <button name="status" value="KLADDE" className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold">
              Tilbage til kladde
            </button>
          ) : null}
        </form>
      </Card>
    </>
  );
}
