import { QuoteComposer } from "@/components/QuoteComposer";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { companyLogoSrc } from "@/lib/logo";
import { peekQuoteNumber } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export default async function NewQuotePage() {
  const session = await requireRole(["ADMIN", "PL"]);
  const [customers, nextQuoteNumber, settings] = await Promise.all([
    prisma.customer.findMany({
      include: { addresses: true },
      orderBy: { name: "asc" },
    }),
    peekQuoteNumber(),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader
        kicker="Salg"
        title="Nyt tilbud"
        description="Skriv til venstre — til højre ser I tilbuddet, som kunden får det."
      />
      <QuoteComposer
        customers={customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          addresses: customer.addresses.map((address) => ({
            id: address.id,
            street: address.street,
            postal: address.postal,
            city: address.city,
          })),
        }))}
        nextQuoteNumber={nextQuoteNumber}
        companyName={settings.company_name}
        logoUrl={companyLogoSrc(session.tenantSlug, settings.company_logo)}
      />
    </>
  );
}
