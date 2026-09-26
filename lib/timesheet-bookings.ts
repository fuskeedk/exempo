/** Shared booking helpers for Min dag / timesheets. */

export type TimesheetBookingLike = {
  scheduledStart?: string | Date | null;
  scheduledEnd?: string | Date | null;
  caseId?: string | null;
  id?: string;
  source?: string;
};

export type ActivitySlotLike = {
  start: Date;
  end: Date;
  caseId?: string | null;
};

function toMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function bookingSubject(job: TimesheetBookingLike): string {
  return job.caseId || (job.source === "case" ? job.id ?? "" : "");
}

export function slotsOverlap(
  startA: Date | string | null | undefined,
  endA: Date | string | null | undefined,
  startB: Date | string | null | undefined,
  endB: Date | string | null | undefined,
): boolean {
  const aStart = toMs(startA);
  const aEnd = toMs(endA);
  const bStart = toMs(startB);
  const bEnd = toMs(endB);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && aEnd > bStart;
}

/** The original case id to unlink when the picker is cleared or changed. */
export function unlinkCaseId(fromCaseId?: string | null, nextCaseId?: string | null): string {
  const previous = (fromCaseId ?? "").trim();
  const next = (nextCaseId ?? "").trim();
  return previous && previous !== next ? previous : "";
}

/**
 * A case board-row is covered when an activity occupies the same slot —
 * either linked to that case, or left as ikke-ordrelateret after a conversion.
 */
export function isCaseCoveredByActivity(
  job: { id: string; scheduledStart?: Date | string | null; scheduledEnd?: Date | string | null },
  activities: ActivitySlotLike[],
): boolean {
  if (!job.scheduledStart || !job.scheduledEnd) return false;
  return activities.some((activity) => {
    if (!slotsOverlap(job.scheduledStart, job.scheduledEnd, activity.start, activity.end)) {
      return false;
    }
    return !activity.caseId || activity.caseId === job.id;
  });
}

/**
 * Drop case bookings that sit under an activity on the same slot so
 * Timer does not count 7,5 + 7,5 = 15 after converting to ikke-ordrelateret.
 */
export function dropCaseJobsCoveredByActivity<T extends TimesheetBookingLike>(jobs: T[]): T[] {
  const activities = jobs.filter(
    (job) => job.source === "activity" && job.scheduledStart && job.scheduledEnd,
  );
  if (activities.length === 0) return jobs;
  return jobs.filter((job) => {
    if (job.source !== "case" || !job.scheduledStart || !job.scheduledEnd) return true;
    return !activities.some((activity) => {
      if (!slotsOverlap(job.scheduledStart, job.scheduledEnd, activity.scheduledStart, activity.scheduledEnd)) {
        return false;
      }
      const activityCase = activity.caseId || "";
      return activityCase === "" || activityCase === job.id;
    });
  });
}

export function uniqueTimesheetJobs<T extends TimesheetBookingLike>(jobs: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const job of jobs) {
    if (!job.scheduledStart || !job.scheduledEnd) {
      unique.push(job);
      continue;
    }
    const start = job.scheduledStart instanceof Date ? job.scheduledStart.toISOString() : String(job.scheduledStart);
    const end = job.scheduledEnd instanceof Date ? job.scheduledEnd.toISOString() : String(job.scheduledEnd);
    const key = `${start}|${end}|${bookingSubject(job)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }
  return dropCaseJobsCoveredByActivity(unique);
}
