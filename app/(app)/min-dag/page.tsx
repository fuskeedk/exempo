import Link from "next/link";
import { addDays, addWeeks, format } from "date-fns";
import {
  createAbsenceAction,
  createExtraWorkAction,
  startTimerAction,
  stopTimerAction,
} from "@/app/actions/field";
import { addCatalogMaterialAction, addMaterialByBarcodeAction } from "@/app/actions/products";
import { AoProductSearch } from "@/components/AoProductSearch";
import { takeFromVanAction } from "@/app/actions/van";
import { uploadDocumentAction } from "@/app/actions/documents";
import { Flash } from "@/components/Flash";
import { MapButton, PhoneLink } from "@/components/ContactActions";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, Select } from "@/components/ui";
import { TimesheetWeek, type TimesheetJob } from "@/components/TimesheetWeek";
import { canManageOffice, requireSession } from "@/lib/auth";
import { isTimeLocked, TIME_LOCKED_MESSAGE } from "@/lib/fsm";
import { ABSENCE_TYPE_LABELS, ABSENCE_TYPES, TRADE_LABELS, absenceLabel, activityBookingTone, isAbsenceKind, isAbsenceType, isTrade } from "@/lib/catalog";
import {
  dayBounds,
  formatLongDay,
  formatSlot,
  formatTime,
  isoWeekNumber,
  isSameDay,
  expectedHoursForDay,
  parseDayParam,
  toDateInput,
  weekDays,
  weekStart,
} from "@/lib/dates";
import { uniqueTimeEntries, uniqueTimesheetJobs } from "@/lib/timesheets";
import { scheduledCaseWhere, calendarActivityWhere, registeredCaseDays, isPlannedCoveredByRegistered, isPlannedSlotCovered } from "@/lib/calendar-query";
import { formatPlace } from "@/lib/geo";
import { buildCalendarDays } from "@/lib/holidays";
import { prisma } from "@/lib/prisma";
import { getSettings, productCatalogEnabled, vanStockEnabled } from "@/lib/settings";

function toJob(
  sag: {
    id: string;
    caseNumber: string;
    title: string;
    customerName: string;
    customerAddress: string;
    customerCity: string;
    customerPhone?: string;
    insuranceCompany: string;
    state: string;
    assignedToId: string | null;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
  },
  color: string,
): TimesheetJob {
  return {
    id: sag.id,
    caseNumber: sag.caseNumber,
    title: sag.title,
    customerName: sag.customerName,
    customerAddress: sag.customerAddress,
    customerCity: sag.customerCity,
    customerPhone: sag.customerPhone ?? "",
    insuranceCompany: sag.insuranceCompany,
    state: sag.state,
    assignedToId: sag.assignedToId,
    scheduledStart: sag.scheduledStart?.toISOString() ?? null,
    scheduledEnd: sag.scheduledEnd?.toISOString() ?? null,
    color,
    source: "case",
    tone: "case-planned",
  };
}

export default async function MyDayPage({
  searchParams,
}: {
  searchParams: Promise<{ dato?: string; medarbejder?: string; vis?: string; besked?: string }>;
}) {
  const user = await requireSession();
  const office = canManageOffice(user.role);
  const settings = await getSettings();
  const catalogOn = productCatalogEnabled(settings);
  const vanOn = vanStockEnabled(settings);
  const { dato, medarbejder, vis: visParam, besked } = await searchParams;
  const view = visParam === "dag" ? "dag" : "uge";
  const selected = parseDayParam(dato);
  const today = parseDayParam();
  const { start: dayStart, end: dayEnd } = dayBounds(selected);
  const weekFrom = weekStart(selected);
  const weekTo = addDays(weekFrom, 7);
  const calendarDays = buildCalendarDays(weekDays(weekFrom), selected);

  const staff = office
    ? await prisma.user.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      })
    : [];
  const viewedId =
    office && medarbejder && staff.some((item) => item.id === medarbejder) ? medarbejder : user.id;
  const worker =
    viewedId === user.id
      ? (await prisma.user.findUnique({ where: { id: user.id } }))
      : (staff.find((item) => item.id === viewedId) ?? null);
  const color = worker?.color ?? "#215744";
  const tradeLabel = worker && isTrade(worker.trade) ? TRADE_LABELS[worker.trade] : worker?.trade ?? "";
  const viewingSelf = viewedId === user.id;
  const workerQuery = office ? viewedId : user.id;

  const caseScope = office
    ? {}
    : {
        OR: [{ assignedToId: user.id }, { assignedToId: null }, { projectLeaderId: user.id }],
      };

  const [weekJobs, bookable, weekAbsences, timeEntries, activities, pickerCases] = await Promise.all([
    prisma.case.findMany({
      where: scheduledCaseWhere(weekFrom, weekTo, workerQuery),
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.case.findMany({
      where: {
        state: { notIn: ["AFSLUTTET", "ANNULLERET"] },
        OR: [
          { assignedToId: workerQuery, scheduledStart: null },
          { assignedToId: workerQuery, scheduledEnd: null },
          { assignedToId: null },
        ],
      },
      orderBy: { caseNumber: "desc" },
    }),
    prisma.absence.findMany({
      where: { userId: workerQuery, date: { gte: weekFrom, lt: weekTo } },
      orderBy: { date: "asc" },
    }),
    prisma.timeEntry.findMany({
      where: { userId: workerQuery, date: { gte: weekFrom, lt: weekTo } },
    }),
    prisma.calendarActivity.findMany({
      where: calendarActivityWhere(weekFrom, weekTo, workerQuery),
      include: {
        case: {
          select: {
            caseNumber: true,
            title: true,
            customerName: true,
            customerAddress: true,
            customerCity: true,
            customerPhone: true,
            insuranceCompany: true,
          },
        },
      },
      orderBy: { start: "asc" },
    }),
    prisma.case.findMany({
      where: {
        state: { notIn: ["AFSLUTTET", "ANNULLERET"] },
        ...caseScope,
      },
      select: {
        id: true,
        caseNumber: true,
        title: true,
        customerName: true,
        customerAddress: true,
        customerCity: true,
        claimNumber: true,
      },
      orderBy: { caseNumber: "desc" },
      take: 400,
    }),
  ]);

  const jobs = weekJobs.filter(
    (job) => job.scheduledStart && job.scheduledEnd && job.scheduledStart < dayEnd && job.scheduledEnd > dayStart,
  );
  const absences = weekAbsences.filter((absence) => absence.date >= dayStart && absence.date < dayEnd);
  const resources = jobs.length
    ? await prisma.resourceBooking.findMany({
        where: {
          caseId: { in: jobs.map((job) => job.id) },
          start: { lt: dayEnd },
          end: { gt: dayStart },
        },
        include: { resource: true },
        orderBy: { start: "asc" },
      })
    : [];
  const products = catalogOn
    ? await prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } })
    : [];
  const vanItems = vanOn
    ? await prisma.vanStock.findMany({
        where: { userId: workerQuery, quantity: { gt: 0 } },
        include: { product: true },
      })
    : [];
  const timerCase =
    viewingSelf && worker?.timerCaseId
      ? jobs.find((job) => job.id === worker.timerCaseId) ??
        (await prisma.case.findUnique({ where: { id: worker.timerCaseId } }))
      : null;

  const registeredDays = registeredCaseDays(activities);
  const registeredActs = activities.filter((activity) => activity.status === "REGISTRERET");
  const boardJobs = weekJobs
    .filter((job) => !isPlannedCoveredByRegistered(job.id, job.scheduledStart, registeredDays))
    .map((job) => toJob(job, color));
  const activityJobs: TimesheetJob[] = activities
    .filter(
      (activity) =>
        activity.status === "REGISTRERET" ||
        (!isPlannedCoveredByRegistered(activity.caseId, activity.start, registeredDays) &&
          !isPlannedSlotCovered(activity, registeredActs)),
    )
    .map((activity) => {
    const absence = isAbsenceKind(activity.kind);
    const tone = activityBookingTone(activity.kind, activity.status, activity.caseId);
    const sag = activity.case;
    const label = absence
      ? absenceLabel(activity.kind)
      : sag
        ? sag.caseNumber
        : "Tid";
    const title = activity.note
      || (absence
        ? `${activity.status === "REGISTRERET" ? "Registreret" : "Planlagt"} · ${absenceLabel(activity.kind)}`
        : sag
          ? sag.title
          : "Ikke ordrerelateret");
    return {
      id: activity.id,
      caseNumber: label,
      title,
      customerName: sag?.customerName ?? "",
      customerAddress: sag?.customerAddress ?? "",
      customerCity: sag?.customerCity ?? "",
      customerPhone: sag?.customerPhone ?? "",
      insuranceCompany: sag?.insuranceCompany ?? "",
      state: "",
      assignedToId: workerQuery,
      scheduledStart: activity.start.toISOString(),
      scheduledEnd: activity.end.toISOString(),
      color: "",
      source: "activity" as const,
      tone,
      caseId: activity.caseId ?? undefined,
      absenceType: absence && isAbsenceType(activity.kind) ? activity.kind : undefined,
      note: activity.note,
    };
  });
  const waiting = bookable.map((job) => toJob(job, color));
  const caseOptions = pickerCases;
  const dateParam = toDateInput(selected);
  const workerParam = office ? viewedId : undefined;
  const href = (day: string, nextView = view) => {
    const search = new URLSearchParams({ dato: day, vis: nextView });
    if (workerParam) search.set("medarbejder", workerParam);
    return `/min-dag?${search}`;
  };
  const hoursDays = view === "dag" ? calendarDays.filter((day) => day.isSelected) : calendarDays;
  const expectedHours = hoursDays.reduce((sum, day) => {
    if (day.isWeekend || day.holiday) return sum;
    return sum + expectedHoursForDay(parseDayParam(day.iso));
  }, 0);
  const registeredHours = uniqueTimeEntries(
    timeEntries.filter((entry) => (view === "dag" ? entry.date >= dayStart && entry.date < dayEnd : true)),
  ).reduce((sum, entry) => sum + entry.hours, 0);
  const absenceHours = weekAbsences
    .filter((absence) => (view === "dag" ? absence.date >= dayStart && absence.date < dayEnd : true))
    .reduce((sum, absence) => sum + absence.hours, 0);
  const prevDate = toDateInput(view === "dag" ? addDays(selected, -1) : addWeeks(weekFrom, -1));
  const nextDate = toDateInput(view === "dag" ? addDays(selected, 1) : addWeeks(weekFrom, 1));
  const dayPrevHref = href(toDateInput(addDays(selected, -1)));
  const dayNextHref = href(toDateInput(addDays(selected, 1)));

  return (
    <>
      <Flash message={besked} />
      <TimesheetWeek
        days={calendarDays}
        jobs={uniqueTimesheetJobs([...boardJobs, ...activityJobs])}
        unassigned={waiting}
        cases={caseOptions}
        workerName={worker?.name ?? user.name}
        tradeLabel={tradeLabel}
        workerId={viewedId}
        dateParam={dateParam}
        workers={staff.map((item) => ({
          id: item.id,
          name: item.name,
          tradeLabel: isTrade(item.trade) ? TRADE_LABELS[item.trade] : item.trade,
        }))}
        expectedHours={expectedHours}
        registeredHours={registeredHours}
        absenceHours={absenceHours}
        weekLabel={format(view === "dag" ? selected : weekFrom, "dd-MM-yyyy")}
        weekNumber={isoWeekNumber(weekFrom)}
        prevHref={href(prevDate)}
        todayHref={href(toDateInput(today))}
        nextHref={href(nextDate)}
        dayPrevHref={dayPrevHref}
        dayNextHref={dayNextHref}
        view={view}
        absences={weekAbsences.map((absence) => ({
          id: absence.id,
          userId: absence.userId,
          date: toDateInput(absence.date),
          label: `${absenceLabel(absence.type)}${
            absence.note ? ` · ${absence.note}` : ""
          }`,
        }))}
      />

      {timerCase ? (
        <Card className="mb-6 mt-6 border-pine">
          <p className="text-sm text-muted">Timer kører på</p>
          <p className="font-serif text-2xl">{timerCase.title}</p>
          <form action={stopTimerAction} className="mt-3">
            <SubmitButton>Stop og registrér tid</SubmitButton>
          </form>
        </Card>
      ) : null}

      {absences.length > 0 ? (
        <Card className="mb-6 mt-6 bg-[#ece7dc]">
          <h2 className="font-serif text-xl">Fravær i dag</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {absences.map((absence) => (
              <li key={absence.id}>
                {absenceLabel(absence.type)}
                {` · ${absence.hours.toString().replace(".", ",")} t`}
                {absence.note ? ` · ${absence.note}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-6 space-y-4">
        {jobs.map((job) => {
          const bookings = resources.filter((booking) => booking.caseId === job.id);
          return (
            <Card key={job.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-pine-2">
                    {job.scheduledStart && job.scheduledEnd
                      ? formatSlot(job.scheduledStart, job.scheduledEnd)
                      : "Ikke tidsat"}
                  </p>
                  <Link href={`/sager/${job.id}`} className="font-serif text-xl hover:underline">
                    {job.caseNumber} · {job.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {job.customerName}
                    {job.customerAddress || job.customerCity
                      ? ` · ${[job.customerAddress, job.customerCity].filter(Boolean).join(", ")}`
                      : ""}
                  </p>
                  {job.customerPhone ? (
                    <p className="text-sm">
                      <PhoneLink phone={job.customerPhone} className="text-pine hover:underline" />
                    </p>
                  ) : null}
                  <MapButton address={formatPlace([job.customerAddress, job.customerCity])} />
                  {bookings.length > 0 ? (
                    <p className="mt-1 text-sm text-muted">
                      Ressourcer:{" "}
                      {bookings
                        .map(
                          (booking) =>
                            `${booking.resource.name} ${formatTime(booking.start)}–${formatTime(booking.end)}`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <StatusBadge state={job.state} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {viewingSelf && !isTimeLocked(job.state) ? (
                  <form action={startTimerAction}>
                    <input type="hidden" name="caseId" value={job.id} />
                    <SubmitButton variant="secondary">Start tid</SubmitButton>
                  </form>
                ) : null}
                {isTimeLocked(job.state) ? (
                  <p className="text-sm text-muted">{TIME_LOCKED_MESSAGE}</p>
                ) : null}
                <Link
                  href={`/sager/${job.id}`}
                  className="inline-flex items-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold"
                >
                  Åbn arbejdsseddel
                </Link>
              </div>
              {catalogOn && products.length > 0 ? (
              <form action={addCatalogMaterialAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_100px_auto]">
                <input type="hidden" name="caseId" value={job.id} />
                <Select name="productId" required>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </option>
                  ))}
                </Select>
                <Input name="quantity" defaultValue="1" />
                <SubmitButton variant="secondary">Materiale</SubmitButton>
              </form>
              ) : null}
              <form action={addMaterialByBarcodeAction} className="mt-2 grid gap-2 sm:grid-cols-[1fr_100px_auto]">
                <input type="hidden" name="caseId" value={job.id} />
                <Input name="barcode" placeholder="Stregkode eller varenr." required />
                <Input name="quantity" defaultValue="1" />
                <SubmitButton variant="secondary">Scan</SubmitButton>
              </form>
              <div className="mt-2">
                <AoProductSearch caseId={job.id} />
              </div>
              <form action={uploadDocumentAction} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="caseId" value={job.id} />
                <input type="hidden" name="category" value="FØR" />
                <Input type="file" name="file" accept="image/*" required />
                <SubmitButton variant="secondary">Før-foto</SubmitButton>
              </form>
              <form action={uploadDocumentAction} className="mt-2 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="caseId" value={job.id} />
                <input type="hidden" name="category" value="EFTER" />
                <Input type="file" name="file" accept="image/*" required />
                <SubmitButton variant="secondary">Efter-foto</SubmitButton>
              </form>
              {vanOn && vanItems.length > 0 ? (
                <form action={takeFromVanAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_80px_auto]">
                  <input type="hidden" name="caseId" value={job.id} />
                  <input type="hidden" name="next" value="/min-dag" />
                  <Select name="productId" required>
                    {vanItems.map((item) => (
                      <option key={item.productId} value={item.productId}>
                        {item.product.sku} · {item.product.name} ({String(item.quantity).replace(".", ",")})
                      </option>
                    ))}
                  </Select>
                  <Input name="quantity" defaultValue="1" />
                  <SubmitButton variant="secondary">Fra vogn</SubmitButton>
                </form>
              ) : null}
              <form action={createExtraWorkAction} className="mt-3 grid gap-2 sm:grid-cols-3">
                <input type="hidden" name="caseId" value={job.id} />
                <Input name="title" placeholder="Ekstraarbejde" required />
                <Input name="amount" placeholder="Beløb, kr." />
                <SubmitButton variant="secondary">Send ekstra</SubmitButton>
              </form>
            </Card>
          );
        })}
        {jobs.length === 0 ? (
          <p className="text-sm text-muted">
            Ingen job {isSameDay(selected, today) ? "i dag" : formatLongDay(selected)}. Klik en dag i
            kalenderen, eller træk en sag ind på et tidspunkt.
            {office ? " På Planlægning kan du lægge sager på hele holdet." : ""}
          </p>
        ) : null}
      </div>

      <Card className="mt-8">
        <h2 className="font-serif text-xl">Fravær</h2>
        <form action={createAbsenceAction} className="mt-4 grid gap-3 sm:grid-cols-4">
          {office ? <input type="hidden" name="userId" value={viewedId} /> : null}
          <Field label="Dato">
            <Input type="date" name="date" defaultValue={toDateInput(selected)} required />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue="FERIE">
              {ABSENCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ABSENCE_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Timer">
            <Input name="hours" defaultValue={String(expectedHoursForDay(selected)).replace(".", ",")} />
          </Field>
          <Field label="Note">
            <Input name="note" />
          </Field>
          <SubmitButton>Registrér fravær</SubmitButton>
        </form>
      </Card>
    </>
  );
}
