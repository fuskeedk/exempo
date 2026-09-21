import { addDays, format } from "date-fns";
import { da } from "date-fns/locale";
import { billedHours, startOfDay, weekDays, weekStart } from "@/lib/dates";

export const SCHEDULE_VIEWS = ["1", "3", "arbejdsdag", "uge"] as const;
export type ScheduleView = (typeof SCHEDULE_VIEWS)[number];

export const SCHEDULE_VIEW_LABELS: Record<ScheduleView, string> = {
  "1": "1 Dag",
  "3": "3 Dage",
  arbejdsdag: "Arbejdsdag",
  uge: "Uge",
};

export function parseScheduleView(value?: string): ScheduleView {
  if (value === "1" || value === "3" || value === "uge" || value === "arbejdsdag") return value;
  return "arbejdsdag";
}

export function schedulingDays(anchor: Date, view: ScheduleView): Date[] {
  const day = startOfDay(anchor);
  const start = weekStart(day);
  if (view === "1") return [day];
  if (view === "3") return [0, 1, 2].map((index) => addDays(day, index));
  if (view === "uge") return weekDays(start);
  return weekDays(start).slice(0, 5);
}

export function formatScheduleDay(date: Date): string {
  return format(date, "EEE d/MM", { locale: da }).replaceAll(".", "");
}

export function parseHourParam(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(23, Math.max(0, parsed));
}

export function scheduleStatus(state: string, scheduled: boolean): { work: string; plan: string } {
  const inProgress = state === "I_GANG" || state === "KLS" || state === "KLAR_TIL_FAKTURA";
  const work = inProgress ? "Igang" : state === "PLANLAGT" ? "Planlagt" : "Ny";
  return { work, plan: scheduled ? "Planlagt" : "Andet" };
}

export function shortName(name: string): string {
  const first = name.trim().split(/\s+/).filter(Boolean)[0] ?? "?";
  return first.slice(0, 4);
}

export function durationHours(start: Date, end: Date): number {
  return billedHours(start, end);
}
