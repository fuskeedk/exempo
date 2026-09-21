import Link from "next/link";
import { AdminTabs } from "@/components/AdminTabs";
import { DeleteInvoiceDraftButton } from "@/components/DeleteInvoiceDraftButton";
import { InvoiceBadge } from "@/components/StatusBadge";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { canDeleteInvoice } from "@/lib/catalog";
import { invoiceNet } from "@/lib/coverage";
import { formatDate } from "@/lib/dates";
import { formatKr, VAT_RATE } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function InvoicesPage() {
  await requireRole(["ADMIN", "PL"]);
  const invoices = await prisma.invoice.findMany({
    include: { case: true, lines: true },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Fakturaer"
        description="Fakturaer dannes fra sagen. Sendt faktura flytter FSM til Faktureret."
        tour="tour-page"
      />
      <AdminTabs />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Faktura</th>
              <th className="px-5 py-3">Sag</th>
              <th className="px-5 py-3">Dato</th>
              <th className="px-5 py-3">Netto</th>
              <th className="px-5 py-3">Incl. moms</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">
                <span className="sr-only">Handling</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const net = invoiceNet(invoice.lines);
              return (
                <tr key={invoice.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <Link className="font-medium hover:underline" href={`/fakturaer/${invoice.id}`}>
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/sager/${invoice.caseId}`} className="hover:underline">
                      {invoice.case.caseNumber}
                    </Link>
                    <p className="text-muted">{invoice.case.title}</p>
                  </td>
                  <td className="px-5 py-3">{formatDate(invoice.issuedAt)}</td>
                  <td className="px-5 py-3">{formatKr(net)}</td>
                  <td className="px-5 py-3">{formatKr(Math.round(net * (1 + VAT_RATE)))}</td>
                  <td className="px-5 py-3">
                    <InvoiceBadge status={invoice.status} kind={invoice.kind} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/fakturaer/${invoice.id}`}
                        className="inline-flex items-center justify-center rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold hover:bg-paper"
                      >
                        Vis
                      </Link>
                      {canDeleteInvoice(invoice.status) ? (
                        <DeleteInvoiceDraftButton
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.invoiceNumber}
                          kind={invoice.kind}
                          variant="compact"
                        />
                      ) : null}
                    </div>
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
