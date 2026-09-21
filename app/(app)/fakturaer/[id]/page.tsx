import { createCreditNoteAction, setInvoiceStatusAction } from "@/app/actions/invoices";
import { AdminTabs } from "@/components/AdminTabs";
import { DeleteInvoiceDraftButton } from "@/components/DeleteInvoiceDraftButton";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { invoiceDocumentTitle, canDeleteInvoice } from "@/lib/catalog";
import { composeInvoiceOffer } from "@/lib/coverage";
import { toDateInput } from "@/lib/dates";
import { companyLogoSrc } from "@/lib/logo";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ linjer?: string }>;
}) {
  const session = await requireRole(["ADMIN", "PL"]);
  const { id } = await params;
  const query = await searchParams;
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        case: {
          include: {
            invoices: { include: { lines: true } },
            timeEntries: true,
            materials: true,
            extraWorks: true,
          },
        },
        createdBy: true,
        lines: true,
      },
    }),
    getSettings(),
  ]);
  if (!invoice) notFound();
  const offer = composeInvoiceOffer({
    caseNumber: invoice.case.caseNumber,
    title: invoice.case.title,
    estimatedRevenue: invoice.case.estimatedRevenue,
    pricingMode: invoice.case.pricingMode,
    invoices: invoice.case.invoices.filter((item) => item.id !== invoice.id),
    timeEntries: invoice.case.timeEntries,
    materials: invoice.case.materials,
    extras: invoice.case.extraWorks,
  });

  return (
    <>
      <div className="no-print">
      <PageHeader
        kicker="Administration"
        title={invoice.invoiceNumber}
        description={`${invoiceDocumentTitle(invoice.kind)} · ${invoice.case.title}`}
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <PrintButton>Udskriv / PDF</PrintButton>
            <Link href={`/sager/${invoice.caseId}`} className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold">
              Åbn sag
            </Link>
          </div>
        }
      />
      </div>
      <div className="no-print">
        <AdminTabs />
      </div>

      <InvoiceEditor
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        status={invoice.status}
        kind={invoice.kind}
        notes={invoice.notes}
        issuedAt={invoice.issuedAt.toISOString()}
        dueAt={invoice.dueAt ? toDateInput(invoice.dueAt) : null}
        caseNumber={invoice.case.caseNumber}
        caseTitle={invoice.case.title}
        insuranceCompany={invoice.case.insuranceCompany}
        claimNumber={invoice.case.claimNumber}
        company={{
          name: settings.company_name,
          cvr: settings.company_cvr,
          address: settings.company_address,
          postal: settings.company_postal,
          city: settings.company_city,
          phone: settings.company_phone,
          email: settings.company_email,
          bankName: settings.company_bank_name,
          bankReg: settings.company_bank_reg,
          bankAccount: settings.company_bank_account,
          bankIban: settings.company_bank_iban,
          bankSwift: settings.company_bank_swift,
          logoUrl: companyLogoSrc(session.tenantSlug, settings.company_logo),
        }}
        customer={{
          name: invoice.case.customerName,
          address: invoice.case.customerAddress,
          postal: invoice.case.customerPostal,
          city: invoice.case.customerCity,
          vatNumber: invoice.case.vatNumber,
        }}
        lines={invoice.lines.map((line) => ({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        }))}
        offer={offer}
        showComposer={invoice.status === "KLADDE" && query.linjer === "1"}
      />

      <form action={setInvoiceStatusAction} className="no-print mt-6 flex flex-wrap gap-3">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        {invoice.status === "KLADDE" ? (
          <button name="status" value="SENDT" className="rounded-full bg-rust px-4 py-2.5 text-sm font-semibold text-white">
            Markér som sendt
          </button>
        ) : null}
        {["SENDT", "RYKKET", "INKASSO"].includes(invoice.status) ? (
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
      {canDeleteInvoice(invoice.status) ? (
        <div className="no-print mt-3">
          <DeleteInvoiceDraftButton
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
            kind={invoice.kind}
          />
        </div>
      ) : null}
      {invoice.kind !== "KREDITNOTA" && ["SENDT", "BETALT", "RYKKET", "INKASSO"].includes(invoice.status) ? (
        <form action={createCreditNoteAction} className="no-print mt-3">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <button type="submit" className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold">
            Dan kreditnota
          </button>
        </form>
      ) : null}
    </>
  );
}
