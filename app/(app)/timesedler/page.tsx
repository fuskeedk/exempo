import Link from "next/link";
import { submitTimesheetAction } from "@/app/actions/payroll";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, PageHeader } from "@/components/ui";
import { canManageOffice, canSeePayroll, requireSession } from "@/lib/auth";
import { bpsLabel } from "@/lib/agreements";
import { formatDate, formatHoursDa, formatNumericDate, parseDayParam, toDateInput } from "@/lib/dates";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { previewTimesheet, timesheetBillableHours } from "@/lib/timesheet-preview";
import {
  TIMESHEET_PERIOD_LABELS,
  TIMESHEET_PERIODS,
  TIMESHEET_STATUS_LABELS,
  isTimesheetPeriod,
  isTimesheetStatus,
  payPeriodFromSettings,
  shiftPeriod,
  type TimesheetPeriod,
} from "@/lib/timesheets";

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; dato?: string; medarbejder?: string; besked?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const rawPeriod = params.periode ?? "";
  const period: TimesheetPeriod = isTimesheetPeriod(rawPeriod) ? rawPeriod : "LONPERIODE";
  const around = parseDayParam(params.dato);
  const payPeriod = payPeriodFromSettings(await getSettings());
  const office = canManageOffice(session.role);
  const showPay = canSeePayroll(session.role);
  const workers = office
    ? await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } })
    : [];
  const userId = office && params.medarbejder ? params.medarbejder : session.id;
  const preview = await previewTimesheet(userId, period, around);
  if (!preview) {
    return (
      <>
        <PageHeader
          kicker="Løn"
          title="Timesedler"
          description="Aflevér registreret tid pr. dag, uge, måned eller lønperiode. Projektlederen godkender, inden I kører løn."
        />
        <Flash message="Medarbejderen findes ikke. Vælg en medarbejder i listen." />
      </>
    );
  }
  const existing = await prisma.timesheet.findUnique({
    where: { userId_period_start: { userId, period, start: preview.start } },
  });
  const { start, end } = preview;
  const prev = toDateInput(shiftPeriod(period, around, -1, payPeriod));
  const next = toDateInput(shiftPeriod(period, around, 1, payPeriod));
  const hours = timesheetBillableHours(preview);
  const workHours = preview.normalHours + preview.overtime50Hours + preview.overtime100Hours + preview.paidAbsenceHours;
  const salaried = preview.payType === "FUNKTIONAER";
  const locked = existing?.status === "GODKENDT";

  return (
    <>
      <PageHeader
        kicker="Løn"
        title="Timesedler"
        description="Aflevér registreret tid pr. dag, uge, måned eller lønperiode. Projektlederen godkender, inden I kører løn."
      />
      <Flash message={params.besked} />
      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3" action="/timesedler">
          <label className="text-sm">
            Periode
            <select name="periode" defaultValue={period} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2">
              {TIMESHEET_PERIODS.map((item) => (
                <option key={item} value={item}>
                  {TIMESHEET_PERIOD_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Dato
            <input type="date" name="dato" defaultValue={toDateInput(around)} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2" />
          </label>
          {office ? (
            <label className="text-sm">
              Medarbejder
              <select name="medarbejder" defaultValue={userId} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2">
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">Vis</button>
          <Link href={`/timesedler?periode=${period}&dato=${prev}${office ? `&medarbejder=${userId}` : ""}`} className="text-sm text-pine-2">
            Forrige
          </Link>
          <Link href={`/timesedler?periode=${period}&dato=${next}${office ? `&medarbejder=${userId}` : ""}`} className="text-sm text-pine-2">
            Næste
          </Link>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="font-serif text-xl">
            {preview.worker.name} · {TIMESHEET_PERIOD_LABELS[period]} {formatNumericDate(start)}–{formatNumericDate(end)}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {showPay ? preview.rates.name : "Registreret tid"}
            {showPay && salaried ? " · funktionær" : ""}
            {showPay && preview.apprenticeStep ? ` · lærling ${preview.apprenticeStep}. trin` : ""}
            {existing && isTimesheetStatus(existing.status) ? ` · ${TIMESHEET_STATUS_LABELS[existing.status]}` : ""}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Normaltimer</dt>
              <dd className="font-serif text-2xl">{formatHoursDa(preview.normalHours)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Overtid 50%</dt>
              <dd className="font-serif text-2xl">{formatHoursDa(preview.overtime50Hours)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Overtid 100%</dt>
              <dd className="font-serif text-2xl">{formatHoursDa(preview.overtime100Hours)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Sygdom</dt>
              <dd className="font-serif text-2xl">{formatHoursDa(preview.paidAbsenceHours)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Øvrigt fravær</dt>
              <dd className="font-serif text-2xl">{formatHoursDa(preview.unpaidHours)}</dd>
            </div>
          </dl>
          {preview.days.length === 0 && preview.absenceHours <= 0 ? (
            <p className="mt-4 text-sm text-muted">
              {salaried
                ? "Ingen registreret tid. Funktionærer afleverer alligevel fast månedsløn for perioden."
                : "Ingen registreret tid. Registrér på Min dag først."}
            </p>
          ) : (
            <ul className="mt-4 space-y-1 text-sm">
              {preview.days.map((day) => (
                <li key={day.date.toISOString()} className="flex justify-between border-t border-line py-2">
                  <span>{formatDate(day.date)}</span>
                  <span>{formatHoursDa(day.hours)} t</span>
                </li>
              ))}
              {preview.sickHours > 0 ? (
                <li className="flex justify-between border-t border-line py-2">
                  <span>Sygdom ({preview.rates.sickPayPct} %)</span>
                  <span>{formatHoursDa(preview.sickHours)} t</span>
                </li>
              ) : null}
              {preview.childSickHours > 0 ? (
                <li className="flex justify-between border-t border-line py-2">
                  <span>Barnsyg ({preview.rates.childSickPayPct} %)</span>
                  <span>{formatHoursDa(preview.childSickHours)} t</span>
                </li>
              ) : null}
              {preview.unpaidHours > 0 ? (
                <li className="flex justify-between border-t border-line py-2 text-muted">
                  <span>Øvrigt fravær (uden løn)</span>
                  <span>{formatHoursDa(preview.unpaidHours)} t</span>
                </li>
              ) : null}
            </ul>
          )}
        </Card>
        <Card>
          {showPay ? (
            <>
              <h2 className="font-serif text-xl">Lønberegning</h2>
              <p className="mt-1 text-sm text-muted">
                {salaried
                  ? `Funktionær · månedsløn ${formatKr(preview.monthlySalary, true)} · kostpris ${formatKr(preview.worker.hourlyRate, true)}`
                  : `Timeløn ${formatKr(preview.wageOre, true)} · kostpris ${formatKr(preview.worker.hourlyRate, true)}`}
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                {salaried ? (
                  <>
                    <Row label="Månedsløn" value={formatKr(preview.normalOre, true)} />
                    <Row label={`Pension AG (${bpsLabel(preview.rates.pensionEmployerBps)})`} value={formatKr(preview.pensionEmployerOre, true)} />
                    <Row label={`Pension LN (${bpsLabel(preview.rates.pensionEmployeeBps)})`} value={formatKr(preview.pensionEmployeeOre, true)} />
                    <Row label="Arbejdsgiveromkostning" value={formatKr(preview.employerCostOre, true)} strong />
                  </>
                ) : (
                  <>
                    <Row label="Normalløn" value={formatKr(preview.normalOre, true)} />
                    <Row label="Overtid" value={formatKr(preview.overtimeOre, true)} />
                    <Row
                      label={`Sygeløn (${preview.rates.sickPayPct} %${
                        preview.childSickHours > 0 && preview.rates.childSickPayPct !== preview.rates.sickPayPct
                          ? ` / barnsyg ${preview.rates.childSickPayPct} %`
                          : ""
                      })`}
                      value={formatKr(preview.sickOre, true)}
                    />
                    <Row label={`Feriepenge (${bpsLabel(preview.rates.holidayPayBps)})`} value={formatKr(preview.holidayPayOre, true)} />
                    <Row label={`SH-opsparing (${bpsLabel(preview.rates.shBps)})`} value={formatKr(preview.shOre, true)} />
                    <Row label={`Fritvalg (${bpsLabel(preview.rates.fritvalgBps)})`} value={formatKr(preview.fritvalgOre, true)} />
                    <Row label={`Pension AG (${bpsLabel(preview.rates.pensionEmployerBps)})`} value={formatKr(preview.pensionEmployerOre, true)} />
                    <Row label={`Pension LN (${bpsLabel(preview.rates.pensionEmployeeBps)})`} value={formatKr(preview.pensionEmployeeOre, true)} />
                    <Row label="Arbejdsgiveromkostning" value={formatKr(preview.employerCostOre, true)} strong />
                  </>
                )}
              </dl>
            </>
          ) : (
            <>
              <h2 className="font-serif text-xl">Aflevér</h2>
              <p className="mt-1 text-sm text-muted">
                {hours > 0
                  ? salaried
                    ? "Fast månedsløn for perioden. Projektlederen godkender, inden lønnen køres."
                    : `${formatHoursDa(workHours)} timer i perioden${
                        preview.paidAbsenceHours > 0
                          ? `, heraf ${formatHoursDa(preview.paidAbsenceHours)} sygdom`
                          : ""
                      }. Projektlederen godkender, inden lønnen køres.`
                  : salaried
                    ? "Sæt månedsløn på medarbejderen, før timesedlen afleveres."
                    : "Registrér tid eller sygdom på Min dag, før du afleverer."}
              </p>
            </>
          )}
          {existing?.rejectNote ? <p className="mt-3 text-sm text-[#7c2f2a]">{existing.rejectNote}</p> : null}
          {locked ? (
            <p className="mt-4 text-sm text-pine-2">Godkendt {existing.approvedAt ? formatDate(existing.approvedAt) : ""}.</p>
          ) : (
            <form action={submitTimesheetAction} className="mt-5 space-y-3">
              <input type="hidden" name="period" value={period} />
              <input type="hidden" name="dato" value={toDateInput(around)} />
              <input type="hidden" name="userId" value={userId} />
              <label className="block text-sm">
                Bemærkning
                <textarea name="note" defaultValue={existing?.note ?? ""} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" rows={2} />
              </label>
              <SubmitButton>
                {hours > 0 ? "Aflevér timeseddel" : salaried ? "Sæt månedsløn først" : "Ingen timer at aflevere"}
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}
