import { notFound } from "next/navigation";
import { customerDecideQuoteAction } from "@/app/actions/public-quote";
import { Flash } from "@/components/Flash";
import { QuoteDocument } from "@/components/QuoteDocument";
import { companyLogoSrc } from "@/lib/logo";
import { defaultTenantSlug, getTenant } from "@/lib/platform";
import { enterTenant, tenantPrisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export default async function CustomerQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ besked?: string }>;
}) {
  const { slug, token } = await params;
  const { besked } = await searchParams;
  const clean = slug.trim().toLowerCase();
  if (clean !== defaultTenantSlug() && !getTenant(clean)) notFound();
  enterTenant(clean);
  const db = tenantPrisma(clean);

  const [quote, settings] = await Promise.all([
    db.quote.findUnique({
      where: { shareToken: token },
      include: { customer: true, address: true, lines: true },
    }),
    getSettings(),
  ]);
  if (!quote) notFound();

  const open = quote.status === "SENDT";
  const company = settings.company_name || "Exempo";
  const statusLabel =
    quote.status === "GODKENDT"
      ? `Godkendt${quote.approvedName ? ` af ${quote.approvedName}` : ""}`
      : quote.status === "AFVIST"
        ? "Afvist"
        : open
          ? "Afventer jeres godkendelse"
          : "Ikke sendt";

  return (
    <div className="min-h-screen bg-pine px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Flash message={besked} />
        <QuoteDocument
          quoteNumber={quote.quoteNumber}
          title={quote.title}
          description={quote.description}
          validUntil={quote.validUntil}
          customerName={quote.customer.name}
          address={quote.address}
          lines={quote.lines}
          companyName={company}
          logoUrl={companyLogoSrc(clean, settings.company_logo)}
          statusLabel={statusLabel}
        >
          {open ? (
            <form action={customerDecideQuoteAction} className="mt-8 space-y-3">
              <input type="hidden" name="slug" value={clean} />
              <input type="hidden" name="token" value={token} />
              <label className="block text-sm">
                Jeres navn
                <input
                  name="name"
                  required
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
                  placeholder="Navn på den, der godkender"
                />
              </label>
              <label className="block text-sm">
                Besked (valgfri)
                <textarea name="note" rows={2} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  name="decision"
                  value="godkend"
                  className="inline-flex items-center rounded-full bg-rust px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Godkend tilbud
                </button>
                <button
                  name="decision"
                  value="afvis"
                  className="inline-flex items-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold"
                >
                  Afvis
                </button>
              </div>
            </form>
          ) : null}
        </QuoteDocument>
        <p className="mt-6 text-center text-xs text-[#d7c9a8]">Sendt med Exempo</p>
      </div>
    </div>
  );
}
