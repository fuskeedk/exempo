import { createQuoteAction } from "@/app/actions/quotes";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { PRICING_MODE_LABELS, PRICING_MODES, TRADE_LABELS, TRADES } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export default async function NewQuotePage() {
  await requireRole(["ADMIN", "PL"]);
  const customers = await prisma.customer.findMany({
    include: { addresses: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        kicker="Salg"
        title="Nyt tilbud"
        description="Kalkulationslinjer bliver til materialer og fast pris, når kunden godkender."
      />
      <form action={createQuoteAction} className="space-y-6">
        <Card className="grid gap-4 lg:grid-cols-2">
          <Field label="Kunde">
            <Select name="customerId" required>
              <option value="">Vælg kunde…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Titel">
            <Input name="title" required placeholder="Udskiftning af køkkenbord" />
          </Field>
          <Field label="Adresse">
            <Select name="addressId">
              <option value="">Kundens primære adresse</option>
              {customers.flatMap((customer) =>
                customer.addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {customer.name} — {address.street}, {address.postal} {address.city}
                  </option>
                )),
              )}
            </Select>
          </Field>
          <Field label="Fag">
            <Select name="trade" defaultValue="ANDET">
              {TRADES.map((trade) => (
                <option key={trade} value={trade}>
                  {TRADE_LABELS[trade]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prisform">
            <Select name="pricingMode" defaultValue="FAST_PRIS">
              {PRICING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {PRICING_MODE_LABELS[mode]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="lg:col-span-2">
            <Field label="Beskrivelse">
              <Textarea name="description" rows={4} />
            </Field>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-serif text-xl">Kalkulation</h2>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-5">
                <Input name="lineDescription" placeholder="Beskrivelse" />
                <Select name="lineKind" defaultValue="YDELSE">
                  <option value="YDELSE">Ydelse</option>
                  <option value="MATERIALE">Materiale</option>
                  <option value="TIMER">Timer</option>
                </Select>
                <Input name="lineQuantity" placeholder="Antal" defaultValue="1" />
                <Input name="linePrice" placeholder="Salgspris kr." />
                <Input name="lineCost" placeholder="Kostpris kr." />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <SubmitButton>Gem tilbud</SubmitButton>
          </div>
        </Card>
      </form>
    </>
  );
}
