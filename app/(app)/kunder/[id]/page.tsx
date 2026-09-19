import Link from "next/link";
import { notFound } from "next/navigation";
import { addAddressAction } from "@/app/actions/customers";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: true,
      cases: { orderBy: { createdAt: "desc" } },
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { issuedAt: "desc" } },
      agreements: true,
    },
  });
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <PageHeader kicker="Kunde" title={customer.name} description={`${customer.phone} · ${customer.email}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-xl">Adresser</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {customer.addresses.map((address) => (
              <li key={address.id}>
                <span className="font-medium">{address.label}:</span> {address.street}, {address.postal} {address.city}
              </li>
            ))}
          </ul>
          <form action={addAddressAction} className="mt-4 grid gap-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <Field label="Label">
              <Input name="label" defaultValue="Adresse" />
            </Field>
            <Field label="Vej">
              <Input name="street" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Postnr.">
                <Input name="postal" />
              </Field>
              <Field label="By">
                <Input name="city" />
              </Field>
            </div>
            <SubmitButton variant="secondary">Tilføj adresse</SubmitButton>
          </form>
        </Card>
        <Card>
          <h2 className="font-serif text-xl">Tilbud og arbejdssedler</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {customer.quotes.map((quote) => (
              <li key={quote.id}>
                <Link className="hover:underline" href={`/tilbud/${quote.id}`}>
                  {quote.quoteNumber} · {quote.title}
                </Link>
              </li>
            ))}
            {customer.cases.map((sag) => (
              <li key={sag.id} className="flex items-center justify-between gap-2">
                <Link className="hover:underline" href={`/sager/${sag.id}`}>
                  {sag.caseNumber} · {sag.title}
                </Link>
                <StatusBadge state={sag.state} />
              </li>
            ))}
            {customer.agreements.map((agreement) => (
              <li key={agreement.id} className="text-muted">
                Serviceaftale: {agreement.title}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
