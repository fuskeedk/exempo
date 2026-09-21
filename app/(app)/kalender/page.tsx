import { addDays } from "date-fns";
import { bookResourceAction, createResourceAction } from "@/app/actions/resources";
import { SchedulingBoard, type ScheduleJob } from "@/components/SchedulingBoard";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, Select } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { RESOURCE_TYPE_LABELS, TRADE_LABELS, TRADES, absenceLabel, isAbsenceKind, isAbsenceType, isTrade } from "@/lib/catalog";
import {
  atTimeOnDay,
  formatDay,
  isoWeekNumber,
  overlapsDay,
  parseDayParam,
  toDateInput,
  toDateTimeInput,
} from "@/lib/dates";
import { buildCalendarDays } from "@/lib/holidays";
import { prisma } from "@/lib/prisma";
import { calendarActivityWhere, scheduledCaseWhere, registeredCaseDays, isPlannedCoveredByRegistered, isPlannedSlotCovered } from "@/lib/calendar-query";
import { uniqueTimesheetJobs } from "@/lib/timesheets";
import { parseHourParam, parseScheduleView, schedulingDays } from "@/lib/scheduling";

function toJob(
  sag: {
    id: string;
    caseNumber: string;
    title: string;
    customerName: string;
    customerAddress: string;
    customerPostal: string;
    customerCity: string;
    insuranceCompany: string;
    state: string;
    assignedToId: string | null;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    assignedTo?: { name: string; color: string } | null;
  },
  actualHours = 0,
): ScheduleJob {
  return {
    id: sag.id,
    caseNumber: sag.caseNumber,
    title: sag.title,
    customerName: sag.customerName,
    customerAddress: sag.customerAddress,
    customerPostal: sag.customerPostal,
    customerCity: sag.customerCity,
    insuranceCompany: sag.insuranceCompany,
    state: sag.state,
    assignedToId: sag.assignedToId,
    assignedName: sag.assignedTo?.name ?? "",
    scheduledStart: sag.scheduledStart?.toISOString() ?? null,
    scheduledEnd: sag.scheduledEnd?.toISOString() ?? null,
    color: sag.assignedTo?.color ?? "#215744",
    actualHours,
    source: "case",
  };
}

function scheduleHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/kalender?${query}` : "/kalender";
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{
    uge?: string;
    vis?: string;
    fra?: string;
    til?: string;
    afdeling?: string;
    sammenlign?: string;
  }>;
}) {
  const user = await requireRole(["ADMIN", "PL"]);
  const params = await searchParams;
  const view = parseScheduleView(params.vis);
  const fromHour = parseHourParam(params.fra, 8);
  const toHour = Math.max(fromHour + 1, parseHourParam(params.til, 18));
  const compare = params.sammenlign === "1";
  const trade = params.afdeling && isTrade(params.afdeling) ? params.afdeling : "";
  const anchor = params.uge ? parseDayParam(params.uge) : new Date();
  const days = schedulingDays(anchor, view);
  const start = days[0] ?? anchor;
  const end = addDays(days[days.length - 1] ?? start, 1);
  const calendarDays = buildCalendarDays(days);
  const weekParam = toDateInput(anchor);

  const employees = await prisma.user.findMany({
    where: {
      active: true,
      role: "MEDARBEJDER",
      ...(trade ? { trade } : {}),
    },
    orderBy: { name: "asc" },
  });
  const visibleIds = employees.map((item) => item.id);

  const [scheduled, active, absences, resources, bookableCases, timeEntries, activities] = await Promise.all([
    visibleIds.length
      ? prisma.case.findMany({
          where: scheduledCaseWhere(start, end, visibleIds),
          include: { assignedTo: true },
        })
      : Promise.resolve([]),
    prisma.case.findMany({
      where: {
        state: { notIn: ["AFSLUTTET", "ANNULLERET"] },
        ...(trade ? { trade } : {}),
      },
      include: { assignedTo: true },
      orderBy: { createdAt: "desc" },
    }),
    visibleIds.length
      ? prisma.absence.findMany({
          where: {
            userId: { in: visibleIds },
            date: { gte: start, lt: end },
          },
        })
      : Promise.resolve([]),
    prisma.resource.findMany({
      include: {
        bookings: {
          where: { start: { lt: end }, end: { gt: start } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.case.findMany({
      where: { state: { notIn: ["AFSLUTTET", "ANNULLERET"] } },
      orderBy: { caseNumber: "desc" },
      take: 40,
    }),
    compare && visibleIds.length
      ? prisma.timeEntry.findMany({
          where: {
            userId: { in: visibleIds },
            date: { gte: start, lt: end },
            caseId: { not: null },
          },
        })
      : Promise.resolve([]),
    visibleIds.length
      ? prisma.calendarActivity.findMany({
          where: calendarActivityWhere(start, end, visibleIds),
          include: {
            case: {
              select: {
                caseNumber: true,
                title: true,
                customerName: true,
                customerAddress: true,
                customerPostal: true,
                customerCity: true,
                insuranceCompany: true,
              },
            },
            user: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const actualByKey = new Map<string, number>();
  for (const entry of timeEntries) {
    if (!entry.caseId) continue;
    const key = `${entry.userId}:${entry.caseId}`;
    actualByKey.set(key, (actualByKey.get(key) ?? 0) + entry.hours);
  }

  const registeredDays = registeredCaseDays(activities);
  const registeredActs = activities.filter((activity) => activity.status === "REGISTRERET");
  const jobs = scheduled
    .filter((sag) => !isPlannedCoveredByRegistered(sag.id, sag.scheduledStart, registeredDays))
    .map((sag) => toJob(sag, actualByKey.get(`${sag.assignedToId}:${sag.id}`) ?? 0));
  const activityJobs: ScheduleJob[] = activities
    .filter(
      (activity) =>
        activity.status === "REGISTRERET" ||
        (!isPlannedCoveredByRegistered(activity.caseId, activity.start, registeredDays) &&
          !isPlannedSlotCovered(activity, registeredActs)),
    )
    .map((activity) => {
    const sag = activity.case;
    const absence = isAbsenceKind(activity.kind);
    return {
      id: activity.id,
      caseNumber: sag?.caseNumber ?? (absence ? absenceLabel(activity.kind) : "Tid"),
      title: activity.note || (absence ? absenceLabel(activity.kind) : sag?.title || "Ikke ordrerelateret"),
      customerName: sag?.customerName ?? "",
      customerAddress: sag?.customerAddress ?? "",
      customerPostal: sag?.customerPostal ?? "",
      customerCity: sag?.customerCity ?? "",
      insuranceCompany: sag?.insuranceCompany ?? "",
      state: "",
      assignedToId: activity.userId,
      assignedName: activity.user.name,
      scheduledStart: activity.start.toISOString(),
      scheduledEnd: activity.end.toISOString(),
      color: employees.find((item) => item.id === activity.userId)?.color ?? "#215744",
      actualHours: 0,
      source: "activity" as const,
      caseId: activity.caseId ?? undefined,
      absenceType: absence && isAbsenceType(activity.kind) ? activity.kind : undefined,
      note: activity.note,
      status: activity.status === "REGISTRERET" ? ("REGISTRERET" as const) : ("PLANLAGT" as const),
    };
  });
  const waiting = active.map((sag) => toJob(sag));

  const shared = {
    vis: view === "arbejdsdag" ? undefined : view,
    fra: fromHour === 8 ? undefined : String(fromHour),
    til: toHour === 18 ? undefined : String(toHour),
    afdeling: trade || undefined,
    sammenlign: compare ? "1" : undefined,
  };
  const step = view === "1" ? 1 : view === "3" ? 3 : 7;
  const prevHref = scheduleHref({ ...shared, uge: toDateInput(addDays(anchor, -step)) });
  const nextHref = scheduleHref({ ...shared, uge: toDateInput(addDays(anchor, step)) });
  const weekMin = `${toDateInput(start)}T00:00`;
  const weekMax = `${toDateInput(addDays(end, -1))}T23:59`;
  const defaultStart = atTimeOnDay(start, fromHour);
  const defaultEnd = atTimeOnDay(start, Math.min(16, toHour));

  return (
    <div className="sch-page">
      <SchedulingBoard
        days={calendarDays}
        jobs={uniqueTimesheetJobs([...jobs, ...activityJobs])}
        unassigned={waiting}
        cases={active.map((sag) => ({
          id: sag.id,
          caseNumber: sag.caseNumber,
          title: sag.title,
          customerName: sag.customerName,
          customerAddress: sag.customerAddress,
          customerCity: sag.customerCity,
          claimNumber: sag.claimNumber,
        }))}
        employees={employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          tradeLabel: isTrade(employee.trade) ? TRADE_LABELS[employee.trade] : employee.trade,
          color: employee.color,
        }))}
        absences={absences.map((absence) => ({
          id: absence.id,
          userId: absence.userId,
          date: toDateInput(absence.date),
          label: `${absenceLabel(absence.type)}${
            absence.note ? ` · ${absence.note}` : ""
          }`,
        }))}
        fromHour={fromHour}
        toHour={toHour}
        compare={compare}
        toolbar={{
          week: isoWeekNumber(anchor),
          date: weekParam,
          view,
          fromHour,
          toHour,
          trade,
          trades: TRADES.map((item) => ({ value: item, label: TRADE_LABELS[item] })),
          compare,
          prevHref,
          nextHref,
        }}
      />

      {resources.length > 0 ? (
        <details className="sch-extra">
          <summary>Ressourcer i perioden</summary>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper-2">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="w-48 px-4 py-3 text-xs uppercase tracking-wider text-muted">Ressource</th>
                  {days.map((day) => (
                    <th key={day.toISOString()} className="px-3 py-3 text-xs uppercase tracking-wider text-muted">
                      {formatDay(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resources.map((resource) => (
                  <tr key={resource.id} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{resource.name}</p>
                      <p className="text-xs text-muted">
                        {RESOURCE_TYPE_LABELS[resource.type as keyof typeof RESOURCE_TYPE_LABELS] ?? resource.type}
                      </p>
                    </td>
                    {days.map((day) => {
                      const items = resource.bookings.filter((booking) =>
                        overlapsDay(booking.start, booking.end, day),
                      );
                      return (
                        <td key={day.toISOString()} className="px-2 py-2">
                          <div className="min-h-16 space-y-2">
                            {items.map((booking) => (
                              <div
                                key={booking.id}
                                className="rounded-xl p-2 text-xs text-white"
                                style={{ background: resource.color }}
                              >
                                {booking.note || "Booket"}
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <details className="sch-extra">
        <summary>Manuel booking</summary>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-serif text-xl">Book ressource</h2>
            <form action={bookResourceAction} className="mt-4 space-y-3">
              <Field label="Ressource">
                <Select name="resourceId" required>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sag">
                <Select name="caseId">
                  <option value="">Uden sag</option>
                  {bookableCases.map((sag) => (
                    <option key={sag.id} value={sag.id}>
                      {sag.caseNumber} · {sag.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Start (00:00–23:59)">
                <input
                  type="datetime-local"
                  name="start"
                  required
                  min={weekMin}
                  max={weekMax}
                  step={60}
                  defaultValue={toDateTimeInput(defaultStart)}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
                />
              </Field>
              <Field label="Slut (00:00–23:59)">
                <input
                  type="datetime-local"
                  name="end"
                  required
                  min={weekMin}
                  max={weekMax}
                  step={60}
                  defaultValue={toDateTimeInput(defaultEnd)}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
                />
              </Field>
              <Field label="Note">
                <Input name="note" />
              </Field>
              <SubmitButton variant="secondary">Book</SubmitButton>
            </form>
          </Card>
          {user.role === "ADMIN" ? (
            <Card>
              <h2 className="font-serif text-xl">Ny ressource</h2>
              <form action={createResourceAction} className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="Navn">
                  <Input name="name" required placeholder="Varebil 2" />
                </Field>
                <Field label="Type">
                  <Select name="type" defaultValue="UDSTYR">
                    <option value="KØRETØJ">Køretøj</option>
                    <option value="UDSTYR">Udstyr</option>
                    <option value="VÆRKSTED">Værksted</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <SubmitButton variant="secondary">Opret</SubmitButton>
                </div>
              </form>
            </Card>
          ) : null}
        </div>
      </details>
    </div>
  );
}
