import {
  apprenticeStepFromStart,
  calculatePayroll,
  resolveWageOre,
  splitOvertime,
  splitPaidAbsence,
} from "@/lib/agreements";
import { isAbsenceKind, isAbsenceType } from "@/lib/catalog";
import { isSalaried, salariedPayOre } from "@/lib/employees";
import { billedHours, expectedHoursForDay, startOfDay } from "@/lib/dates";
import { loadAgreement } from "@/lib/payroll-store";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  expectedHoursInRange,
  hoursFromActivities,
  hoursFromEntries,
  payPeriodFromSettings,
  periodBounds,
  type TimesheetPeriod,
} from "@/lib/timesheets";
import { getSettings } from "@/lib/settings";

function mergeAbsences(
  absences: { type: string; date: Date; hours: number }[],
  activities: { kind: string; status: string; start: Date; end: Date; allDay: boolean }[],
) {
  const rows = absences.map((row) => ({ type: row.type, date: startOfDay(row.date), hours: row.hours }));
  for (const activity of activities) {
    if (activity.status !== "REGISTRERET" || !isAbsenceKind(activity.kind)) continue;
    const type = isAbsenceType(activity.kind) ? activity.kind : "SYG";
    const day = startOfDay(activity.start);
    const already = rows.some((row) => row.type === type && row.date.getTime() === day.getTime());
    if (already) continue;
    rows.push({
      type,
      date: day,
      hours: billedHours(activity.start, activity.end, activity.allDay),
    });
  }
  return rows;
}

export async function previewTimesheet(
  userId: string,
  period: TimesheetPeriod,
  around: Date,
  db: typeof defaultPrisma = defaultPrisma,
) {
  const worker = await db.user.findUnique({ where: { id: userId } });
  if (!worker) return null;
  const payPeriod = payPeriodFromSettings(await getSettings());
  const { start, end } = periodBounds(period, around, payPeriod);
  const [activities, entries, absences, rates] = await Promise.all([
    db.calendarActivity.findMany({
      where: { userId, status: "REGISTRERET", start: { lt: end }, end: { gt: start } },
    }),
    db.timeEntry.findMany({
      where: { userId, date: { gte: start, lt: end } },
    }),
    db.absence.findMany({
      where: { userId, date: { gte: start, lt: end } },
    }),
    loadAgreement(worker.agreementCode || "NONE", db),
  ]);

  const workActivities = activities.filter((activity) => !isAbsenceKind(activity.kind));
  const workEntries = entries.filter((entry) => entry.kind === "ARBEJDE" || entry.kind === "OVERTID" || entry.kind === "TILLÆG");
  const fromCalendar = hoursFromActivities(workActivities);
  const days = fromCalendar.length > 0 ? fromCalendar : hoursFromEntries(workEntries);
  const split = splitOvertime(days, expectedHoursForDay, rates.overtimeFirstHours);
  const absenceSplit = splitPaidAbsence(mergeAbsences(absences, activities));
  let apprenticeStep = worker.apprenticeStep;
  if (worker.apprenticeStart && rates.apprentices.length > 0) {
    apprenticeStep = apprenticeStepFromStart(
      worker.apprenticeStart,
      start,
      Math.max(...rates.apprentices.map((row) => row.step)),
    );
  }
  const wageOre = resolveWageOre({
    wageRate: worker.wageRate,
    hourlyRate: worker.hourlyRate,
    apprenticeStep,
    apprentices: rates.apprentices,
  });
  const payType = isSalaried(worker.payType) ? "FUNKTIONAER" : "TIMER";
  const monthlySalary = worker.monthlySalary ?? 0;
  const salariedOre =
    payType === "FUNKTIONAER"
      ? period === "LONPERIODE" || period === "MAANED"
        ? monthlySalary
        : salariedPayOre(monthlySalary, expectedHoursInRange(start, end), rates.weekHours)
      : 0;
  const pay = calculatePayroll({
    rates,
    wageOre: payType === "FUNKTIONAER" ? monthlySalary : wageOre,
    normalHours: split.normalHours,
    overtime50Hours: split.overtime50Hours,
    overtime100Hours: split.overtime100Hours,
    sickHours: absenceSplit.sickHours,
    childSickHours: absenceSplit.childSickHours,
    payType,
    salariedOre,
  });
  return {
    worker,
    rates,
    start,
    end,
    days,
    apprenticeStep,
    payType,
    monthlySalary,
    ...absenceSplit,
    ...split,
    ...pay,
  };
}

export function timesheetBillableHours(preview: {
  payType?: string;
  normalOre?: number;
  normalHours: number;
  overtime50Hours: number;
  overtime100Hours: number;
  paidAbsenceHours: number;
}) {
  if (preview.payType === "FUNKTIONAER" && (preview.normalOre ?? 0) > 0) return 1;
  return preview.normalHours + preview.overtime50Hours + preview.overtime100Hours + preview.paidAbsenceHours;
}
