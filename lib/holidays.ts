import { addDays, format } from "date-fns";
import { da } from "date-fns/locale";
import { isSameDay, startOfDay, toDateInput } from "@/lib/dates";

/** Anonymous Gregorian computus — returns local midnight on Easter Sunday. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return startOfDay(new Date(year, month - 1, day));
}

export function danishPublicHolidays(year: number): Record<string, string> {
  const easter = easterSunday(year);
  return {
    [`${year}-01-01`]: "Nytårsdag",
    [toDateInput(addDays(easter, -3))]: "Skærtorsdag",
    [toDateInput(addDays(easter, -2))]: "Langfredag",
    [toDateInput(easter)]: "Påskedag",
    [toDateInput(addDays(easter, 1))]: "2. påskedag",
    [`${year}-06-05`]: "Grundlovsdag",
    [toDateInput(addDays(easter, 39))]: "Kristi himmelfart",
    [toDateInput(addDays(easter, 49))]: "Pinsedag",
    [toDateInput(addDays(easter, 50))]: "2. pinsedag",
    [`${year}-12-25`]: "Juledag",
    [`${year}-12-26`]: "2. juledag",
  };
}

export function holidaysInRange(start: Date, end: Date): Record<string, string> {
  const from = startOfDay(start);
  const to = startOfDay(end);
  const out: Record<string, string> = {};
  for (let year = from.getFullYear(); year <= to.getFullYear(); year += 1) {
    for (const [date, name] of Object.entries(danishPublicHolidays(year))) {
      const day = startOfDay(new Date(`${date}T12:00:00`));
      if (day >= from && day < to) out[date] = name;
    }
  }
  return out;
}

export function holidayName(date: Date | string): string | null {
  const iso = typeof date === "string" ? date : toDateInput(date);
  const year = Number.parseInt(iso.slice(0, 4), 10);
  if (!year) return null;
  return danishPublicHolidays(year)[iso] ?? null;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function buildCalendarDays(days: Date[], selected?: Date) {
  const today = new Date();
  return days.map((day) => ({
    iso: toDateInput(day),
    weekday: format(day, "EEE", { locale: da }),
    dayNumber: format(day, "d. MMM", { locale: da }),
    holiday: holidayName(day),
    isToday: isSameDay(day, today),
    isWeekend: isWeekend(day),
    isSelected: selected ? isSameDay(day, selected) : false,
  }));
}
