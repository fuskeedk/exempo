import { createAgreementAction, spawnAgreementCaseAction } from "@/app/actions/field";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { TRADE_LABELS, CASE_TRADES } from "@/lib/catalog";
import { formatDate, toDateInput } from "@/lib/dates";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { addMonths } from "date-fns";

export default async function AgreementsPage() {
  await requireRole(["ADMIN", "PL"]);
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const agreements = await prisma.serviceAgreement.findMany({
    include: { customer: true },
    orderBy: { nextVisit: "asc" },
  });
  return (
    <>
      <PageHeader
        kicker="Gentagne ordrer"
        title="Serviceaftaler"
        description="Faste aftaler der spawner en ny arbejdsseddel ved næste besøg."
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <ul className="space-y-4">
            {agreements.map((agreement) => (
              <li key={agreement.id} className="rounded-xl border border-line p-4">
                <p className="font-medium">{agreement.title}</p>
                <p className="text-sm text-muted">
                  {agreement.customer.name} · næste {formatDate(agreement.nextVisit)} · hver {agreement.intervalMonths}. md ·{" "}
                  {formatKr(agreement.estimatedRevenue)}
                </p>
                <form action={spawnAgreementCaseAction} className="mt-3">
                  <input type="hidden" name="agreementId" value={agreement.id} />
                  <SubmitButton variant="secondary">Opret besøg nu</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-serif text-xl">Ny aftale</h2>
          <form action={createAgreementAction} className="mt-4 grid gap-3">
            <Field label="Kunde">
              <Select name="customerId" required>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Titel">
              <Input name="title" required placeholder="Årligt serviceeftersyn" />
            </Field>
            <Field label="Fag">
              <Select name="trade" defaultValue="VVS">
                {CASE_TRADES.map((trade) => (
                  <option key={trade} value={trade}>
                    {TRADE_LABELS[trade]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Interval, måneder">
              <Input name="intervalMonths" defaultValue="12" />
            </Field>
            <Field label="Næste besøg">
              <Input type="date" name="nextVisit" defaultValue={toDateInput(addMonths(new Date(), 1))} />
            </Field>
            <Field label="Estimeret omsætning, kr.">
              <Input name="estimatedRevenue" />
            </Field>
            <Field label="Beskrivelse">
              <Textarea name="description" rows={3} />
            </Field>
            <SubmitButton>Opret aftale</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
