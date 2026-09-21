import type { Prisma } from "@prisma/client";
import { startOfDay } from "@/lib/dates";

/** Shared booking window used by Planlægning and Min dag. */
export function scheduledCaseWhere(
  from: Date,
  to: Date,
  assignedTo: string | string[],
): Prisma.CaseWhereInput {
  return {
    assignedToId: Array.isArray(assignedTo)
      ? assignedTo.length === 1
        ? assignedTo[0]
        : { in: assignedTo }
      : assignedTo,
    scheduledStart: { not: null, lt: to },
    scheduledEnd: { not: null, gt: from },
    state: { not: "ANNULLERET" },
  };
}

export function calendarActivityWhere(
  from: Date,
  to: Date,
  userId: string | string[],
): Prisma.CalendarActivityWhereInput {
  return {
    userId: Array.isArray(userId) ? (userId.length === 1 ? userId[0] : { in: userId }) : userId,
    start: { lt: to },
    end: { gt: from },
  };
}

export function registeredCaseDayKey(caseId: string, start: Date): string {
  return `${caseId}:${startOfDay(start).getTime()}`;
}

export function registeredCaseDays(
  activities: { caseId: string | null; status: string; start: Date }[],
): Set<string> {
  const keys = new Set<string>();
  for (const activity of activities) {
    if (activity.status !== "REGISTRERET" || !activity.caseId) continue;
    keys.add(registeredCaseDayKey(activity.caseId, activity.start));
  }
  return keys;
}

export function isPlannedCoveredByRegistered(
  caseId: string | null | undefined,
  start: Date | null | undefined,
  registeredDays: Set<string>,
): boolean {
  if (!caseId || !start) return false;
  return registeredDays.has(registeredCaseDayKey(caseId, start));
}

export function isPlannedSlotCovered(
  activity: { status: string; caseId: string | null; kind: string; start: Date; end: Date },
  registered: { status: string; caseId: string | null; kind: string; start: Date; end: Date }[],
): boolean {
  if (activity.status === "REGISTRERET") return false;
  return registered.some(
    (row) =>
      row.status === "REGISTRERET" &&
      (row.caseId ?? "") === (activity.caseId ?? "") &&
      row.kind === activity.kind &&
      row.start.getTime() < activity.end.getTime() &&
      row.end.getTime() > activity.start.getTime(),
  );
}
