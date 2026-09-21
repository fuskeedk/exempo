import { addDays, addMonths, startOfMonth } from "date-fns";
import { billedHours, expectedHoursForDay, startOfDay, toDateInput, weekStart } from "@/lib/dates";

export const TIMESHEET_PERIODS = ["DAG", "UGE", "MAANED", "LONPERIODE"] as const;
export type TimesheetPeriod = (typeof TIMESHEET_PERIODS)[number];

export const TIMESHEET_STATUSES = ["KLADDE", "AFLEVERET", "GODKENDT", "AFVIST"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const TIMESHEET_PERIOD_LABELS: Record<TimesheetPeriod, string> = {
  DAG: "Dag",
  UGE: "Uge",
  MAANED: "Måned",
  LONPERIODE: "Lønperiode",
};

export const DEFAULT_PAY_PERIOD_START_DAY = 20;
export const DEFAULT_PAY_PERIOD_END_DAY = 21;

export type PayPeriodDays = {
  startDay: number;
  endDay: number;
};

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  KLADDE: "Kladde",
  AFLEVERET: "Afleveret",
  GODKENDT: "Godkendt",
  AFVIST: "Afvist",
};

export function isTimesheetPeriod(value: string): value is TimesheetPeriod {
  return (TIMESHEET_PERIODS as readonly string[]).includes(value);
}

export function isTimesheetStatus(value: string): value is TimesheetStatus {
  return (TIMESHEET_STATUSES as readonly string[]).includes(value);
}

export function parsePayPeriodDay(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(28, Math.round(parsed)));
}

export function payPeriodFromSettings(settings?: Record<string, string> | null): PayPeriodDays {
  return {
    startDay: parsePayPeriodDay(settings?.payroll_period_start_day, DEFAULT_PAY_PERIOD_START_DAY),
    endDay: parsePayPeriodDay(settings?.payroll_period_end_day, DEFAULT_PAY_PERIOD_END_DAY),
  };
}

function dayOnMonth(year: number, monthIndex: number, day: number) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return startOfDay(new Date(year, monthIndex, Math.min(day, last)));
}

/** From startDay this cycle to endDay next month (end exclusive, same convention as calendar month). */
export function payPeriodBounds(around: Date, spec?: Partial<PayPeriodDays>): { start: Date; end: Date } {
  const day = startOfDay(around);
  const startDay = parsePayPeriodDay(spec?.startDay, DEFAULT_PAY_PERIOD_START_DAY);
  const endDay = parsePayPeriodDay(spec?.endDay, DEFAULT_PAY_PERIOD_END_DAY);
  let start = dayOnMonth(day.getFullYear(), day.getMonth(), startDay);
  if (start > day) {
    start = dayOnMonth(day.getFullYear(), day.getMonth() - 1, startDay);
  }
  let end = dayOnMonth(start.getFullYear(), start.getMonth() + 1, endDay);
  if (end <= start) {
    end = dayOnMonth(start.getFullYear(), start.getMonth() + 2, endDay);
  }
  if (day >= end) {
    start = dayOnMonth(start.getFullYear(), start.getMonth() + 1, startDay);
    end = dayOnMonth(start.getFullYear(), start.getMonth() + 1, endDay);
    if (end <= start) {
      end = dayOnMonth(start.getFullYear(), start.getMonth() + 2, endDay);
    }
  }
  return { start, end };
}

export function periodBounds(
  period: TimesheetPeriod,
  around: Date,
  pay?: Partial<PayPeriodDays>,
): { start: Date; end: Date } {
  const day = startOfDay(around);
  if (period === "DAG") return { start: day, end: addDays(day, 1) };
  if (period === "MAANED") {
    const start = startOfMonth(day);
    return { start, end: addMonths(start, 1) };
  }
  if (period === "LONPERIODE") return payPeriodBounds(day, pay);
  const start = weekStart(day);
  return { start, end: addDays(start, 7) };
}

export function shiftPeriod(
  period: TimesheetPeriod,
  around: Date,
  direction: -1 | 1,
  pay?: Partial<PayPeriodDays>,
): Date {
  if (period === "DAG") return addDays(startOfDay(around), direction);
  if (period === "MAANED") return addMonths(startOfMonth(around), direction);
  if (period === "LONPERIODE") {
    const { start } = payPeriodBounds(around, pay);
    return payPeriodBounds(new Date(start.getFullYear(), start.getMonth() + direction, start.getDate()), pay).start;
  }
  return addDays(weekStart(around), direction * 7);
}

export function uniqueActivitiesBySlot<T extends { start: Date; end: Date; caseId?: string | null }>(
  activities: T[],
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const activity of activities) {
    const key = `${activity.start.getTime()}|${activity.end.getTime()}|${activity.caseId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(activity);
  }
  return unique;
}

export function uniqueTimeEntries<T extends { date: Date; hours: number; caseId?: string | null }>(
  entries: T[],
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const entry of entries) {
    const key = `${startOfDay(entry.date).getTime()}|${entry.hours}|${entry.caseId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

export function uniqueTimesheetJobs<T extends {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  caseId?: string | null;
  id?: string;
  source?: string;
}>(jobs: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const job of jobs) {
    if (!job.scheduledStart || !job.scheduledEnd) {
      unique.push(job);
      continue;
    }
    const subject = job.caseId || (job.source === "case" ? job.id ?? "" : "");
    const key = `${job.scheduledStart}|${job.scheduledEnd}|${subject}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }
  return unique;
}

export function hoursFromActivities(
  activities: { start: Date; end: Date; allDay: boolean; caseId?: string | null }[],
): { date: Date; hours: number }[] {
  const map = new Map<string, number>();
  for (const activity of uniqueActivitiesBySlot(activities)) {
    const day = startOfDay(activity.start);
    const key = toDateInput(day);
    map.set(key, (map.get(key) ?? 0) + billedHours(activity.start, activity.end, activity.allDay));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, hours]) => ({ date: startOfDay(new Date(`${key}T12:00:00`)), hours }));
}

export function hoursFromEntries(entries: { date: Date; hours: number; caseId?: string | null }[]): { date: Date; hours: number }[] {
  const map = new Map<string, number>();
  for (const entry of uniqueTimeEntries(entries)) {
    const key = toDateInput(startOfDay(entry.date));
    map.set(key, (map.get(key) ?? 0) + entry.hours);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, hours]) => ({ date: startOfDay(new Date(`${key}T12:00:00`)), hours }));
}

export function expectedHoursInRange(start: Date, end: Date) {
  let total = 0;
  for (let day = startOfDay(start); day < end; day = addDays(day, 1)) {
    total += expectedHoursForDay(day);
  }
  return total;
}
