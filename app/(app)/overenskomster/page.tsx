import { saveAgreementAction } from "@/app/actions/payroll";
import { AdminTabs } from "@/components/AdminTabs";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { bpsLabel } from "@/lib/agreements";
import { requireRole } from "@/lib/auth";
import { listAgreements } from "@/lib/payroll-store";

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ kode?: string; besked?: string }>;
}) {
  await requireRole(["ADMIN"]);
  const params = await searchParams;
  const agreements = await listAgreements();
  const selected = agreements.find((row) => row.code === params.kode) ?? agreements[0];

  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Overenskomster"
        description="Udgangspunkt pr. marts 2026 for Bygge og anlæg, Dansk El-Forbund, Dansk Metal og Blik- og rør. Ret satserne — også sygeløn — så de matcher jeres gældende aftale, før I kører løn."
      />
      <AdminTabs />
      <Flash message={params.besked} />
      <nav className="mb-6 flex flex-wrap gap-2">
        {agreements.map((row) => (
          <a
            key={row.code}
            href={`/overenskomster?kode=${row.code}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              selected?.code === row.code ? "border-pine bg-pine text-[#f4efe4]" : "border-line bg-white"
            }`}
          >
            {row.name}
          </a>
        ))}
      </nav>
      {selected ? (
        <Card>
          <h2 className="font-serif text-xl">{selected.name}</h2>
          <p className="mt-1 text-sm text-muted">{selected.unionName}</p>
          <form action={saveAgreementAction} className="mt-5 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="code" value={selected.code} />
            <label className="sm:col-span-2">
              <Label>Note</Label>
              <Textarea name="notes" defaultValue={selected.notes} rows={3} />
            </label>
            <Field name="pensionEmployerBps" label="Pension AG, basispoint (1100 = 11 %)" value={selected.pensionEmployerBps} hint={bpsLabel(selected.pensionEmployerBps)} />
            <Field name="pensionEmployeeBps" label="Pension LN, basispoint" value={selected.pensionEmployeeBps} hint={bpsLabel(selected.pensionEmployeeBps)} />
            <Field name="holidayPayBps" label="Feriepenge, basispoint" value={selected.holidayPayBps} hint={bpsLabel(selected.holidayPayBps)} />
            <Field name="shBps" label="SH-opsparing, basispoint" value={selected.shBps} hint={bpsLabel(selected.shBps)} />
            <Field name="fritvalgBps" label="Fritvalg / særlig opsparing, basispoint" value={selected.fritvalgBps} hint={bpsLabel(selected.fritvalgBps)} />
            <Field name="overtimeFirstHours" label="Overtid 50 %, første timer" value={selected.overtimeFirstHours} />
            <Field name="overtimeFirstPct" label="Overtid første tillæg, %" value={selected.overtimeFirstPct} />
            <Field name="overtimeRestPct" label="Overtid øvrige, %" value={selected.overtimeRestPct} />
            <label>
              <Label>Overtidstillæg første timer, kr. (0 = brug %)</Label>
              <Input name="overtimeFirstAddon" defaultValue={(selected.overtimeFirstAddonOre / 100).toLocaleString("da-DK")} />
            </label>
            <label>
              <Label>Overtidstillæg øvrige timer, kr.</Label>
              <Input name="overtimeRestAddon" defaultValue={(selected.overtimeRestAddonOre / 100).toLocaleString("da-DK")} />
            </label>
            <Field name="sickPayPct" label="Sygeløn, % af timeløn" value={selected.sickPayPct} hint="Sygdom. 100 = fuld løn, 90 = nedsat sats, 0 = uden løn." />
            <Field name="childSickPayPct" label="Barnsyg, % af timeløn" value={selected.childSickPayPct} hint="Barns første sygedag og øvrig barnsyg. Typisk 100 %." />
            {selected.apprentices.map((row) => (
              <label key={row.step}>
                <Label>Lærling {row.label}, kr./t</Label>
                <Input name={`apprentice_${row.step}`} defaultValue={(row.wageOre / 100).toLocaleString("da-DK")} />
              </label>
            ))}
            <div className="sm:col-span-2">
              <SubmitButton>Gem satser</SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}
    </>
  );
}

function Field({
  name,
  label,
  value,
  hint,
}: {
  name: string;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <label>
      <Label>{label}</Label>
      <Input name={name} defaultValue={String(value)} />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </label>
  );
}
