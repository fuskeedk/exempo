import { startOfWeek, addDays, format, getISOWeek } from "date-fns";
import { da } from "date-fns/locale";

export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function dayBounds(date: Date): { start: Date; end: Date } {
  const start = startOfDay(date);
  return { start, end: addDays(start, 1) };
}

export function overlapsDay(start: Date, end: Date, day: Date): boolean {
  const { start: from, end: to } = dayBounds(day);
  return start < to && end > from;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function parseDayParam(value?: string): Date {
  if (!value) return startOfDay(new Date());
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

export function formatDay(date: Date): string {
  return format(date, "EEE d. MMM", { locale: da });
}

export function formatDate(date: Date): string {
  return format(date, "d. MMM yyyy", { locale: da });
}

export function formatNumericDate(date: Date): string {
  return format(date, "dd-MM-yyyy");
}

export function formatCompactDate(date: Date): string {
  return format(date, "d/M");
}

export function formatNumericDateTime(date: Date): string {
  return format(date, "dd-MM-yyyy HH:mm");
}

export function formatDateTime(date: Date): string {
  return format(date, "d. MMM yyyy 'kl.' HH:mm", { locale: da });
}

export function formatTime(date: Date): string {
  return format(date, "HH:mm");
}

export function formatLongDay(date: Date): string {
  return format(date, "EEEE d. MMMM", { locale: da });
}

export function formatSlot(start: Date, end: Date): string {
  if (isSameDay(start, end)) {
    return `kl. ${formatTime(start)}–${formatTime(end)}`;
  }
  return `${formatDay(start)} ${formatTime(start)} → ${formatDay(end)} ${formatTime(end)}`;
}

export function toDateInput(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function toDateTimeInput(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Move a booked slot so it still starts on `toDay`, keeping clock time and duration. */
export function shiftScheduleToDay(
  start: Date,
  end: Date,
  fromDay: Date,
  toDay: Date,
): { start: Date; end: Date } {
  const delta = startOfDay(toDay).getTime() - startOfDay(fromDay).getTime();
  return {
    start: new Date(start.getTime() + delta),
    end: new Date(end.getTime() + delta),
  };
}

/** Hel dag: 07:00–15:00 minus ½ t pause = 7,5 time. Fredag 07:00–14:30 = 7,0 time. */
export const FULL_DAY_START_HOUR = 7;
export const FULL_DAY_START_MINUTE = 0;
export const FULL_DAY_END_HOUR = 15;
export const FULL_DAY_END_MINUTE = 0;
export const FULL_DAY_CLOCK_HOURS = 8;
export const FULL_DAY_HOURS = 7.5;
export const FULL_DAY_PAUSE_HOURS = 0.5;
export const FRIDAY_FULL_DAY_HOURS = 7;
export const FRIDAY_FULL_DAY_END_HOUR = 14;
export const FRIDAY_FULL_DAY_END_MINUTE = 30;
export const WEEK_EXPECTED_HOURS = 37;

export function isFriday(date: Date): boolean {
  return date.getDay() === 5;
}

export function expectedHoursForDay(date: Date): number {
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return 0;
  return weekday === 5 ? FRIDAY_FULL_DAY_HOURS : FULL_DAY_HOURS;
}

export function expectedHoursForDays(days: Date[]): number {
  return days.reduce((sum, day) => sum + expectedHoursForDay(day), 0);
}

export function clockHours(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  return endHour + endMinute / 60 - (startHour + startMinute / 60);
}

export function looksLikeFullDay(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  return clockHours(startHour, startMinute, endHour, endMinute) >= FULL_DAY_HOURS;
}

export function isFullDaySlot(start: Date, end: Date): boolean {
  const startHour = start.getHours();
  const startMinute = start.getMinutes();
  const endHour = end.getHours();
  const endMinute = end.getMinutes();
  if (startHour !== FULL_DAY_START_HOUR || startMinute !== FULL_DAY_START_MINUTE) return false;
  if (endHour === FULL_DAY_END_HOUR && endMinute === FULL_DAY_END_MINUTE) return true;
  return endHour === FRIDAY_FULL_DAY_END_HOUR && endMinute === FRIDAY_FULL_DAY_END_MINUTE;
}

export function billedHours(start: Date, end: Date, allDay = false): number {
  if (allDay || isFullDaySlot(start, end)) {
    return isFriday(start) ? FRIDAY_FULL_DAY_HOURS : FULL_DAY_HOURS;
  }
  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 4) / 4);
}

export function fullDaySlot(day: Date): { start: Date; end: Date } {
  if (isFriday(day)) {
    return {
      start: atTimeOnDay(day, FULL_DAY_START_HOUR, FULL_DAY_START_MINUTE),
      end: atTimeOnDay(day, FRIDAY_FULL_DAY_END_HOUR, FRIDAY_FULL_DAY_END_MINUTE),
    };
  }
  return {
    start: atTimeOnDay(day, FULL_DAY_START_HOUR, FULL_DAY_START_MINUTE),
    end: atTimeOnDay(day, FULL_DAY_END_HOUR, FULL_DAY_END_MINUTE),
  };
}

export function defaultSlotOnDay(day: Date): { start: Date; end: Date } {
  return fullDaySlot(day);
}

export function hoursOfDay(): number[] {
  return Array.from({ length: 24 }, (_, index) => index);
}

/** Visible hours on Minuba-style timesheet (07:00–21:00). */
export function timesheetHours(): number[] {
  return Array.from({ length: 15 }, (_, index) => index + 7);
}

export function isoWeekNumber(date: Date): number {
  return getISOWeek(date);
}

export function formatHoursDa(hours: number): string {
  return hours.toLocaleString("da-DK", { maximumFractionDigits: 1 });
}

export function atTimeOnDay(day: Date, hour: number, minute = 0): Date {
  const next = startOfDay(day);
  next.setHours(Math.min(23, Math.max(0, hour)), Math.min(59, Math.max(0, minute)), 0, 0);
  return next;
}

export function endOfClockDay(day: Date): Date {
  const next = startOfDay(day);
  next.setHours(23, 59, 0, 0);
  return next;
}

export function dayDateTimeBounds(day: Date): { min: string; max: string } {
  const iso = toDateInput(day);
  return { min: `${iso}T00:00`, max: `${iso}T23:59` };
}

export function minutesOnDay(date: Date, day: Date): number {
  const start = startOfDay(day);
  const next = addDays(start, 1);
  if (date <= start) return 0;
  if (date >= next) return 24 * 60;
  return date.getHours() * 60 + date.getMinutes();
}

export function slotAtHour(
  day: Date,
  hour: number,
  durationMs = 2 * 60 * 60 * 1000,
  minute = 0,
): { start: Date; end: Date } {
  const start = atTimeOnDay(day, hour, minute);
  let end = new Date(start.getTime() + Math.max(15 * 60 * 1000, durationMs));
  const cap = endOfClockDay(day);
  if (end > cap && start < cap) end = cap;
  if (end <= start) end = cap;
  return { start, end };
}

/** Portrait phone: one day with swipe. Landscape/desktop: whole week. */
export const MIN_DAG_SWIPE_MEDIA = "(max-width: 900px) and (orientation: portrait)";

export function isMinDagSwipeLayout(width: number, height: number, maxWidth = 900) {
  return width <= maxWidth && height > width;
}

export function shiftDayParam(iso: string, days: number): string {
  return toDateInput(addDays(parseDayParam(iso), days));
}
