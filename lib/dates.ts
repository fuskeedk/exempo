import { startOfWeek, addDays, format } from "date-fns";
import { da } from "date-fns/locale";

export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function formatDay(date: Date): string {
  return format(date, "EEE d. MMM", { locale: da });
}

export function formatDate(date: Date): string {
  return format(date, "d. MMM yyyy", { locale: da });
}

export function formatDateTime(date: Date): string {
  return format(date, "d. MMM yyyy 'kl.' HH:mm", { locale: da });
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
