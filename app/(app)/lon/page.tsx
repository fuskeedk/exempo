import Link from "next/link";
import { decideTimesheetAction, reopenTimesheetAction } from "@/app/actions/payroll";
import { AdminTabs } from "@/components/AdminTabs";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, PageHeader } from "@/components/ui";
import { canSeePayroll, requireRole } from "@/lib/auth";
import { formatDate, formatHoursDa, parseDayParam } from "@/lib/dates";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  TIMESHEET_PERIOD_LABELS,
  TIMESHEET_STATUS_LABELS,
  isTimesheetPeriod,
  isTimesheetStatus,
} from "@/lib/timesheets";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; fra?: string; til?: string; besked?: string }>;
}) {
  const session = await requireRole(["ADMIN", "PL"]);
  const showPay = canSeePayroll(session.role);
  const params = await searchParams;
  const from = params.fra ? parseDayParam(params.fra) : undefined;
  const to = params.til ? parseDayParam(params.til) : undefined;
  const status = params.status === "alle" ? undefined : params.status || "AFLEVERET";

  const sheets = await prisma.timesheet.findMany({
    where: {
      status: status || undefined,
      start: from || to ? { gte: from, lt: to ? new Date(to.getTime() + 86400000) : undefined } : undefined,
      ...(session.role === "PL"
        ? { user: { OR: [{ managerId: session.id }, { managerId: null }, { id: session.id }] } }
        : {}),
    },
    include: { user: true, approvedBy: true },
    orderBy: [{ status: "asc" }, { start: "desc" }],
  });

  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.fra) query.set("fra", params.fra);
  if (params.til) query.set("til", params.til);
  const exportQs = query.toString();

  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Løn"
        description="Godkend afleverede timesedler og eksportér til Excel, Danløn eller Dataløn."
        actions={
          showPay ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/api/lon/eksport?format=excel&${exportQs}`}
                className="inline-flex items-center rounded-full bg-rust px-4 py-2.5 text-sm font-semibold text-white"
              >
                Excel
              </Link>
              <Link
                href={`/api/lon/eksport?format=danlon&${exportQs}`}
                className="inline-flex items-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold"
              >
                Danløn CSV
              </Link>
              <Link
                href={`/api/lon/eksport?format=dataloen&${exportQs}`}
                className="inline-flex items-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold"
              >
                Dataløn CSV
              </Link>
            </div>
          ) : undefined
        }
      />
      <AdminTabs />
      <Flash message={params.besked} />
      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3" action="/lon">
          <label className="text-sm">
            Status
            <select name="status" defaultValue={params.status || "AFLEVERET"} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2">
              <option value="AFLEVERET">Afleveret</option>
              <option value="GODKENDT">Godkendt</option>
              <option value="AFVIST">Afvist</option>
              <option value="alle">Alle</option>
            </select>
          </label>
          <label className="text-sm">
            Fra
            <input type="date" name="fra" defaultValue={params.fra ?? ""} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            Til
            <input type="date" name="til" defaultValue={params.til ?? ""} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2" />
          </label>
          <button className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">Filtrér</button>
          {showPay ? (
            <Link href="/overenskomster" className="text-sm text-pine-2">
              Overenskomster
            </Link>
          ) : null}
        </form>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Medarbejder</th>
              <th className="px-5 py-3">Periode</th>
              <th className="px-5 py-3">Timer</th>
              {showPay ? <th className="px-5 py-3">AG-omkostning</th> : null}
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => (
              <tr key={sheet.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <p className="font-medium">{sheet.user.name}</p>
                  {showPay ? <p className="text-muted">{sheet.agreementName}</p> : null}
                </td>
                <td className="px-5 py-3">
                  {isTimesheetPeriod(sheet.period) ? TIMESHEET_PERIOD_LABELS[sheet.period] : sheet.period}
                  <span className="block text-muted">
                    {formatDate(sheet.start)} – {formatDate(sheet.end)}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {sheet.payType === "FUNKTIONAER" ? (
                    <>
                      Månedsløn
                      <span className="block text-muted">{formatKr(sheet.monthlySalary || sheet.normalOre, true)}</span>
                    </>
                  ) : (
                    <>
                      {formatHoursDa(sheet.normalHours + sheet.overtime50Hours + sheet.overtime100Hours + sheet.sickHours + sheet.childSickHours)} t
                      <span className="block text-muted">
                        {[
                          sheet.overtime50Hours + sheet.overtime100Hours > 0
                            ? `${formatHoursDa(sheet.overtime50Hours + sheet.overtime100Hours)} overtid`
                            : "",
                          sheet.sickHours + sheet.childSickHours > 0
                            ? `${formatHoursDa(sheet.sickHours + sheet.childSickHours)} sygdom`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </>
                  )}
                </td>
                {showPay ? <td className="px-5 py-3">{formatKr(sheet.employerCostOre, true)}</td> : null}
                <td className="px-5 py-3">
                  {isTimesheetStatus(sheet.status) ? TIMESHEET_STATUS_LABELS[sheet.status] : sheet.status}
                  {sheet.rejectNote ? <span className="block text-xs text-[#7c2f2a]">{sheet.rejectNote}</span> : null}
                </td>
                <td className="px-5 py-3 text-right">
                  {sheet.status === "AFLEVERET" ? (
                    <div className="flex justify-end gap-2">
                      <form action={decideTimesheetAction}>
                        <input type="hidden" name="id" value={sheet.id} />
                        <input type="hidden" name="decision" value="godkend" />
                        <SubmitButton>Godkend</SubmitButton>
                      </form>
                      <form action={decideTimesheetAction} className="flex gap-2">
                        <input type="hidden" name="id" value={sheet.id} />
                        <input type="hidden" name="decision" value="afvis" />
                        <input name="rejectNote" placeholder="Årsag" className="w-32 rounded-xl border border-line px-2 py-1 text-sm" />
                        <SubmitButton variant="secondary">Afvis</SubmitButton>
                      </form>
                    </div>
                  ) : null}
                  {sheet.status === "GODKENDT" && session.role === "ADMIN" ? (
                    <form action={reopenTimesheetAction}>
                      <input type="hidden" name="id" value={sheet.id} />
                      <SubmitButton variant="ghost">Åbn igen</SubmitButton>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sheets.length === 0 ? <p className="px-5 py-8 text-sm text-muted">Ingen timesedler matcher filteret.</p> : null}
      </Card>
    </>
  );
}
