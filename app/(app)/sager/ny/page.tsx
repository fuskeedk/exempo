import { createCaseAction } from "@/app/actions/cases";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { TRADE_LABELS, TRADES } from "@/lib/catalog";

export default async function NewCasePage() {
  await requireRole(["ADMIN", "PL"]);
  return (
    <>
      <PageHeader
        kicker="Sager"
        title="Opret sag"
        description="Ny skadesag starter i status Ny og kan derefter besigtiges, planlægges og udføres."
      />
      <form action={createCaseAction} className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-serif text-xl">Sagen</h2>
          <Field label="Titel">
            <Input name="title" required placeholder="Vandskade i køkken" />
          </Field>
          <Field label="Beskrivelse">
            <Textarea name="description" rows={5} />
          </Field>
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
            <Field label="Navn">
              <Input name="customerName" required />
            </Field>
            <Field label="Adresse">
              <Input name="customerAddress" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Postnr.">
                <Input name="customerPostal" />
              </Field>
              <Field label="By">
                <Input name="customerCity" className="sm:col-span-2" />
              </Field>
              <div className="sm:col-span-3 grid gap-4 sm:grid-cols-2">
                <Field label="Telefon">
                  <Input name="customerPhone" />
                </Field>
                <Field label="E-mail">
                  <Input name="customerEmail" type="email" />
                </Field>
              </div>
            </div>
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
            <SubmitButton>Opret sag</SubmitButton>
          </Card>
        </div>
      </form>
    </>
  );
}
