import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { convertQuoteToCaseAction, fetchQuoteRepliesAction, sendQuoteEmailAction, setQuoteStatusAction } from "@/app/actions/quotes";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Flash } from "@/components/Flash";
import { PrintButton } from "@/components/PrintButton";
import { QuoteDocument } from "@/components/QuoteDocument";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { PRICING_MODE_LABELS, QUOTE_STATUS_LABELS, type PricingMode, type QuoteStatus } from "@/lib/catalog";
import { quoteEconomics } from "@/lib/coverage";
import { companyLogoSrc } from "@/lib/logo";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { customerQuotePath, ensureQuoteShareToken } from "@/lib/quotes";
import { getSettings } from "@/lib/settings";

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ besked?: string }>;
}) {
  const session = await requireRole(["ADMIN", "PL"]);
  const { id } = await params;
  const { besked } = await searchParams;
  const [quote, settings] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: { customer: true, address: true, lines: true, cases: true },
    }),
    getSettings(),
  ]);
  if (!quote) notFound();
  const shareToken = await ensureQuoteShareToken(quote.id);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") || "https";
  const customerUrl = `${proto}://${host}${customerQuotePath(session.tenantSlug, shareToken)}`;
  const totals = quoteEconomics(quote.lines);
  const statusLabel = QUOTE_STATUS_LABELS[quote.status as QuoteStatus] ?? quote.status;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={quote.quoteNumber}
        title={quote.title}
        description={`${quote.customer.name} · ${PRICING_MODE_LABELS[quote.pricingMode as PricingMode] ?? quote.pricingMode}`}
        actions={<PrintButton>Udskriv tilbud</PrintButton>}
      />
      <Flash message={besked} />
      <Card className="no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Status: <strong>{statusLabel}</strong>
            {quote.approvedName ? ` · ${quote.approvedName}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {quote.status !== "KLADDE" ? <CopyLinkButton url={customerUrl} /> : null}
            <form action={setQuoteStatusAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="quoteId" value={quote.id} />
              {quote.status === "KLADDE" ? (
                <button name="status" value="SENDT" className="rounded-full bg-rust px-4 py-2 text-sm font-semibold text-white">
                  Send kundelink
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
        </div>
        {quote.status !== "KLADDE" ? (
          <p className="mt-4 break-all text-xs text-muted">Kundelink: {customerUrl}</p>
        ) : null}
        {quote.status !== "GODKENDT" && quote.status !== "AFVIST" ? (
          <form action={sendQuoteEmailAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="quoteId" value={quote.id} />
            <Field label="Send tilbudsmail">
              <Input
                name="to"
                type="email"
                required
                defaultValue={quote.emailedTo || quote.customer.email}
                placeholder="kunde@…"
              />
            </Field>
            <div className="flex items-end">
              <SubmitButton>{quote.emailedAt ? "Send igen" : "Send tilbudsmail"}</SubmitButton>
            </div>
            {quote.emailedAt ? (
              <p className="sm:col-span-2 text-xs text-muted">
                Sidst sendt til {quote.emailedTo} {quote.emailedAt.toLocaleString("da-DK")}
                {quote.repliedAt
                  ? ` · kundesvar fra ${quote.repliedFrom || "kunden"} ${quote.repliedAt.toLocaleString("da-DK")}`
                  : ""}
              </p>
            ) : (
              <p className="sm:col-span-2 text-xs text-muted">
                Kunden kan åbne kundelinket eller svare på mailen med Godkendt / Nej tak. Kræver SMTP for at sende og
                IMAP for at hente svar — begge under Indstillinger.
              </p>
            )}
          </form>
        ) : null}
        <form action={fetchQuoteRepliesAction} className="mt-3">
          <SubmitButton variant="secondary">Hent kundesvar</SubmitButton>
        </form>
        <p className="mt-4 text-sm text-muted">
          Kost / DG: {formatKr(totals.cost)}
          {totals.coverage === null ? "" : ` · ${Math.round(totals.coverage * 100)} %`}
        </p>
        {quote.status === "GODKENDT" && quote.cases.length === 0 ? (
          <form action={convertQuoteToCaseAction} className="mt-4">
            <input type="hidden" name="quoteId" value={quote.id} />
            <SubmitButton>Opret arbejdsseddel</SubmitButton>
          </form>
        ) : null}
        {quote.cases.map((sag) => (
          <p key={sag.id} className="mt-4 text-sm">
            Arbejdsseddel:{" "}
            <Link className="underline" href={`/sager/${sag.id}`}>
              {sag.caseNumber}
            </Link>
          </p>
        ))}
      </Card>

      <QuoteDocument
        quoteNumber={quote.quoteNumber}
        title={quote.title}
        description={quote.description}
        validUntil={quote.validUntil}
        customerName={quote.customer.name}
        address={quote.address}
        lines={quote.lines}
        companyName={settings.company_name}
        logoUrl={companyLogoSrc(session.tenantSlug, settings.company_logo)}
        statusLabel={statusLabel}
      />
    </div>
  );
}
