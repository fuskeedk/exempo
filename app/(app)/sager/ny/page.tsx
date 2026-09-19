import { createCaseAction } from "@/app/actions/cases";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import {
  ORDER_TYPE_LABELS,
  ORDER_TYPES,
  PRICING_MODE_LABELS,
  PRICING_MODES,
  TRADE_LABELS,
  TRADES,
} from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export default async function NewCasePage() {
  await requireRole(["ADMIN", "PL"]);
  const customers = await prisma.customer.findMany({
    include: { addresses: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        kicker="Arbejdsseddel"
        title="Opret ordre"
        description="Vælg kunde fra kartoteket, eller tast stamdata direkte. Prisform styrer, hvordan fakturaen dannes."
      />
      <form action={createCaseAction} className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-serif text-xl">Ordren</h2>
          <Field label="Titel">
            <Input name="title" required placeholder="Vandskade i køkken" />
          </Field>
          <Field label="Beskrivelse">
            <Textarea name="description" rows={5} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ordretype">
              <Select name="orderType" defaultValue="SKADE">
                {ORDER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ORDER_TYPE_LABELS[type]}
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fag">
              <Select name="trade" defaultValue="ANDET">
                {TRADES.map((trade) => (
                  <option key={trade} value={trade}>
                    {TRADE_LABELS[trade]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Forsikringsselskab">
              <Input name="insuranceCompany" placeholder="Tryg" />
            </Field>
          </div>
          <Field label="Skadenummer">
            <Input name="claimNumber" />
          </Field>
        </Card>
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="font-serif text-xl">Kunde</h2>
            <Field label="Eksisterende kunde">
              <Select name="customerId">
                <option value="">Ny / manuel…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Navn">
              <Input name="customerName" />
            </Field>
            <Field label="Adresse">
              <Input name="customerAddress" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Postnr.">
                <Input name="customerPostal" />
              </Field>
              <Field label="By">
                <Input name="customerCity" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefon">
                <Input name="customerPhone" />
              </Field>
              <Field label="E-mail">
                <Input name="customerEmail" type="email" />
              </Field>
            </div>
            <Field label="Rekvisition">
              <Input name="requisition" />
            </Field>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-serif text-xl">Økonomi (estimat)</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Forventet omsætning, kr.">
                <Input name="estimatedRevenue" placeholder="85000" />
              </Field>
              <Field label="Forventet omkostning, kr.">
                <Input name="estimatedCost" placeholder="48000" />
              </Field>
            </div>
            <SubmitButton>Opret arbejdsseddel</SubmitButton>
          </Card>
        </div>
      </form>
    </>
  );
}
