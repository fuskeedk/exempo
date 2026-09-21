"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { moveCaseOnCalendar, resizeCaseOnCalendar } from "@/app/actions/cases";
import { moveTimesheetActivity, resizeTimesheetActivity } from "@/app/actions/field";
import { ActivityDialog, type ActivityCaseOption, type ActivityDraft } from "@/components/ActivityDialog";
import { BookingResizeHandle } from "@/components/BookingResizeHandle";
import { CaseOpenLink } from "@/components/CaseOpenLink";
import {
  billedHours,
  formatHoursDa,
  formatTime,
  FULL_DAY_END_HOUR,
  FULL_DAY_END_MINUTE,
  FULL_DAY_START_HOUR,
  FULL_DAY_START_MINUTE,
  minutesOnDay,
  overlapsDay,
  parseDayParam,
  timesheetHours,
  MIN_DAG_SWIPE_MEDIA,
} from "@/lib/dates";
import { BOOKING_TONES, BOOKING_TONE_LABELS, type AbsenceType, type BookingTone } from "@/lib/catalog";
import { uniqueTimesheetJobs } from "@/lib/timesheets";
import type { CalendarAbsence, CalendarDay, CalendarJob } from "@/components/WeekBoard";

const DRAG_TYPE = "application/x-exempo-case";
const PX_PER_HOUR = 52;
const START_HOUR = 7;
const END_HOUR = 22;

export type TimesheetJob = CalendarJob & {
  customerAddress?: string;
  customerPhone?: string;
  insuranceCompany?: string;
  source?: "case" | "activity";
  tone?: BookingTone;
  caseId?: string;
  absenceType?: AbsenceType;
  note?: string;
};

type DragPayload = {
  caseId?: string;
  activityId?: string;
  fromDate: string | null;
  assignedToId: string | null;
};

export function TimesheetWeek({
  days,
  jobs,
  absences,
  unassigned = [],
  cases = [],
  workerName,
  tradeLabel,
  workerId,
  workers = [],
  dateParam,
  expectedHours,
  registeredHours,
  absenceHours,
  weekNumber,
  prevHref,
  nextHref,
  dayPrevHref,
  dayNextHref,
  view = "uge",
}: {
  days: CalendarDay[];
  jobs: TimesheetJob[];
  absences: CalendarAbsence[];
  unassigned?: TimesheetJob[];
  cases?: ActivityCaseOption[];
  workerName: string;
  tradeLabel: string;
  workerId?: string;
  workers?: { id: string; name: string; tradeLabel: string }[];
  dateParam?: string;
  expectedHours: number;
  registeredHours: number;
  absenceHours: number;
  weekLabel: string;
  weekNumber: number;
  prevHref: string;
  todayHref: string;
  nextHref: string;
  dayPrevHref?: string;
  dayNextHref?: string;
  view?: "uge" | "dag";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const swipe = useMinDagSwipe();
  const swipeRef = useRef<HTMLDivElement>(null);
  const ignoreScroll = useRef(false);
  const hours = timesheetHours();
  const height = (END_HOUR - START_HOUR) * PX_PER_HOUR;
  const backHref = swipe || view === "dag" ? (dayPrevHref ?? prevHref) : prevHref;
  const forwardHref = swipe || view === "dag" ? (dayNextHref ?? nextHref) : nextHref;
  const scheduledHours = uniqueTimesheetJobs(jobs).reduce((sum, job) => {
    if (!job.scheduledStart || !job.scheduledEnd) return sum;
    return sum + billedHours(new Date(job.scheduledStart), new Date(job.scheduledEnd));
  }, 0);

  function dayHref(iso: string) {
    const search = new URLSearchParams({ dato: iso, vis: view });
    if (workers.length > 1 && workerId) search.set("medarbejder", workerId);
    return `/min-dag?${search}`;
  }

  useLayoutEffect(() => {
    const root = swipeRef.current;
    if (!root) return;
    const mobileSwipe = window.matchMedia(MIN_DAG_SWIPE_MEDIA).matches;
    if (mobileSwipe) {
      const index = Math.max(
        0,
        days.findIndex((day) => day.iso === dateParam || day.isSelected),
      );
      ignoreScroll.current = true;
      root.scrollLeft = index * root.clientWidth;
    }
    root.classList.add("is-ready");
    const timer = window.setTimeout(() => {
      ignoreScroll.current = false;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [dateParam, swipe, days]);

  useEffect(() => {
    const root = swipeRef.current;
    if (!root || !swipe) return;
    let timer = 0;
    const onScroll = () => {
      if (ignoreScroll.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const width = root.clientWidth;
        if (width <= 0) return;
        const index = Math.min(days.length - 1, Math.max(0, Math.round(root.scrollLeft / width)));
        const iso = days[index]?.iso;
        if (iso && iso !== dateParam) router.replace(dayHref(iso));
      }, 80);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener("scroll", onScroll);
    };
  }, [swipe, dateParam, days, view, workerId, workers.length, router]);

  useEffect(() => {
    const root = swipeRef.current;
    if (!root || !swipe) return;
    let startX = 0;
    let startScroll = 0;
    const onStart = (event: TouchEvent) => {
      startX = event.touches[0]?.clientX ?? 0;
      startScroll = root.scrollLeft;
    };
    const onEnd = (event: TouchEvent) => {
      const dx = (event.changedTouches[0]?.clientX ?? startX) - startX;
      const max = root.scrollWidth - root.clientWidth;
      if (startScroll <= 4 && dx > 56 && dayPrevHref) router.push(dayPrevHref);
      else if (startScroll >= max - 4 && dx < -56 && dayNextHref) router.push(dayNextHref);
    };
    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchend", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchend", onEnd);
    };
  }, [swipe, dayPrevHref, dayNextHref, router]);

  function openSlot(
    day: CalendarDay,
    hour: number,
    minute = 0,
    caseId = "",
    endHour?: number,
    endMinute?: number,
  ) {
    const startHour = hour;
    const startMinute = minute;
    let nextHour = endHour ?? hour + 1;
    let nextMinute = endMinute ?? minute;
    if (endHour == null) {
      nextHour = hour + 1;
      nextMinute = minute;
      if (nextHour > 23) {
        nextHour = 23;
        nextMinute = 59;
      }
    }
    if (nextHour < startHour || (nextHour === startHour && nextMinute <= startMinute)) {
      nextHour = startHour + 1;
      nextMinute = startMinute;
      if (nextHour > 23) {
        nextHour = 23;
        nextMinute = 59;
      }
    }
    setDraft({
      date: day.iso,
      startHour,
      startMinute,
      endHour: nextHour,
      endMinute: nextMinute,
      caseId,
    });
  }

  function openJob(day: CalendarDay, job: TimesheetJob) {
    if (!job.scheduledStart || !job.scheduledEnd) {
      openSlot(day, 8, 0, job.source === "activity" ? job.caseId ?? "" : job.id);
      return;
    }
    const start = new Date(job.scheduledStart);
    const end = new Date(job.scheduledEnd);
    const absence = Boolean(job.absenceType) || job.tone?.startsWith("absence");
    setDraft({
      date: day.iso,
      startHour: start.getHours(),
      startMinute: [0, 15, 30, 45].includes(start.getMinutes()) ? start.getMinutes() : 0,
      endHour: end.getHours(),
      endMinute: [0, 15, 30, 45].includes(end.getMinutes()) ? end.getMinutes() : 0,
      caseId: job.source === "activity" ? job.caseId ?? "" : job.id,
      activityId: job.source === "activity" ? job.id : undefined,
      source: job.source === "activity" ? "activity" : "case",
      kind: absence ? "FRAVAER" : "ARBEJDE",
      absenceType: job.absenceType,
      note: job.note ?? "",
      status: job.tone?.includes("registered") ? "REGISTRERET" : "PLANLAGT",
    });
  }

  function resizeJob(day: CalendarDay, job: TimesheetJob, endHour: number, endMinute: number) {
    const planned = job.source !== "activity" || Boolean(job.tone?.includes("-planned"));
    if (!planned) return;
    setError(null);
    startTransition(async () => {
      try {
        if (job.source === "activity") {
          await resizeTimesheetActivity({
            activityId: job.id,
            date: day.iso,
            endHour,
            endMinute,
            forUserId: workerId ?? job.assignedToId ?? undefined,
          });
        } else {
          await resizeCaseOnCalendar({
            caseId: job.id,
            date: day.iso,
            endHour,
            endMinute,
          });
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke ændre sluttid.");
      }
    });
  }

  function dropOn(day: CalendarDay, hour?: number) {
    return async (payload: DragPayload) => {
      if (day.holiday) {
        const ok = window.confirm(
          `${day.holiday} (${day.iso})\n\nDet er en helligdag. Vil du alligevel flytte tiden hertil?`,
        );
        if (!ok) return;
      }
      setError(null);
      startTransition(async () => {
        try {
          if (payload.activityId) {
            await moveTimesheetActivity({
              activityId: payload.activityId,
              date: day.iso,
              fromDate: payload.fromDate ?? undefined,
              forUserId: workerId ?? payload.assignedToId ?? undefined,
              hour,
            });
          } else if (payload.caseId) {
            await moveCaseOnCalendar({
              caseId: payload.caseId,
              date: day.iso,
              fromDate: payload.fromDate ?? undefined,
              assignedToId: workerId ?? payload.assignedToId ?? undefined,
              hour,
            });
          } else {
            return;
          }
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kunne ikke flytte tiden.");
        }
      });
    };
  }

  return (
    <div className={pending ? "opacity-70" : ""} data-tour="tour-day">
      {error ? (
        <p className="mb-3 rounded-xl bg-[#f3d7d4] px-3 py-2 text-sm text-[#7c2f2a]">{error}</p>
      ) : null}

      <form key={`${dateParam}-${view}-${workerId ?? ""}`} className="mb-3 flex flex-wrap items-center gap-2" action="/min-dag">
        <Link
          href={backHref}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-lg"
          aria-label={swipe || view === "dag" ? "Forrige dag" : "Forrige uge"}
        >
          ‹
        </Link>
        <input
          type="date"
          name="dato"
          defaultValue={dateParam}
          aria-label="Dato"
          className="h-9 rounded-md border border-line bg-white px-3 text-sm tabular-nums"
        />
        <button type="submit" className="h-9 rounded-md border border-line bg-white px-3 text-sm font-medium">
          Vis
        </button>
        <label className="sr-only" htmlFor="timesheet-view">
          Visning
        </label>
        <select
          id="timesheet-view"
          name="vis"
          defaultValue={view}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="timesheet-view-toggle h-9 rounded-md border border-line bg-white px-3 text-sm"
        >
          <option value="dag">Dag</option>
          <option value="uge">Uge</option>
        </select>
        {workers.length > 1 && dateParam ? (
          <>
            <label className="sr-only" htmlFor="timesheet-worker">
              Medarbejder
            </label>
            <select
              id="timesheet-worker"
              key={workerId}
              name="medarbejder"
              defaultValue={workerId}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="h-9 rounded-md border border-line bg-white px-3 text-sm"
            >
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                  {worker.tradeLabel ? ` (${worker.tradeLabel})` : ""}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <input type="hidden" name="medarbejder" value={workerId ?? ""} />
            <span className="inline-flex h-9 items-center rounded-md border border-line bg-white px-3 text-sm">
              {workerName}
              {tradeLabel ? ` (${tradeLabel})` : ""}
            </span>
          </>
        )}
        <Link
          href={forwardHref}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-lg"
          aria-label={swipe || view === "dag" ? "Næste dag" : "Næste uge"}
        >
          ›
        </Link>
      </form>

      <div className="grid gap-0 overflow-hidden rounded-lg border border-[#ddd] bg-white lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className={`timesheet min-w-0 overflow-x-auto ${view === "dag" ? "timesheet--day" : "timesheet--week"}`}>
          <div className="timesheet-board">
            <div className="timesheet-gutter">
              <div className="timesheet-gutter-head">UGE {weekNumber}</div>
              <div>
                {hours.map((hour) => (
                  <div key={hour} className="timesheet-gutter-hour" style={{ height: PX_PER_HOUR }}>
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>
            <div ref={swipeRef} className="timesheet-swipe">
              {days.map((day) => (
                <div
                  key={day.iso}
                  className={`timesheet-day${day.isSelected ? " is-selected" : ""}`}
                  data-day={day.iso}
                >
                  <DayHead
                    day={day}
                    hours={hoursOnDay(jobs, day)}
                    href={`/min-dag?${new URLSearchParams({
                      dato: day.iso,
                      vis: swipe ? view : "dag",
                      ...(workers.length > 1 && workerId ? { medarbejder: workerId } : {}),
                    }).toString()}`}
                  />
                  <DayColumn
                    day={day}
                    jobs={jobs}
                    absences={absences.filter((absence) => absence.date === day.iso)}
                    hours={hours}
                    height={height}
                    onDrop={dropOn}
                    onAdd={openSlot}
                    onEdit={openJob}
                    onResize={resizeJob}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="border-t border-[#ddd] bg-[#fafafa] p-4 text-sm lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <p className="font-medium">
              {workerName}
              {tradeLabel ? ` (${tradeShort(tradeLabel)})` : ""}
            </p>
            <p className="text-xs uppercase tracking-wider text-muted">Antal</p>
          </div>
          <StatRow label="Forventede timer" value={formatHoursDa(expectedHours)} />
          <StatRow label="Registrerede timer" value={formatHoursDa(registeredHours)} />
          <StatRow label="Arbejdstid" value={formatHoursDa(scheduledHours)} />
          <StatRow label="Fravær" value={formatHoursDa(absenceHours)} />
          <p className="mt-4 text-xs text-muted">
            Hold musen nede og træk fra start til slut, eller klik et tidspunkt.
          </p>
          <ul className="timesheet-legend mt-4">
            {BOOKING_TONES.map((tone) => (
              <li key={tone}>
                <span className={`timesheet-swatch cal-job--${tone}`} />
                {BOOKING_TONE_LABELS[tone]}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {unassigned.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[#ddd] bg-white p-4">
          <h2 className="text-sm font-semibold">Sager du kan booke på dig selv</h2>
          <p className="mt-1 text-xs text-muted">Træk en sag ind på et tidspunkt i ugen.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {unassigned.map((job) => (
              <li key={job.id}>
                <article
                  draggable
                  onDragStart={(event) => {
                    const payload: DragPayload = {
                      caseId: job.id,
                      fromDate: null,
                      assignedToId: job.assignedToId,
                    };
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
                    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
                  }}
                  className="cal-job relative cursor-grab rounded-md px-3 py-2 pr-7 text-white"
                  onClick={() => {
                    const day = days.find((item) => item.isSelected) ?? days[0];
                    if (day) {
                      openSlot(
                        day,
                        FULL_DAY_START_HOUR,
                        FULL_DAY_START_MINUTE,
                        job.id,
                        FULL_DAY_END_HOUR,
                        FULL_DAY_END_MINUTE,
                      );
                    }
                  }}
                  style={{ background: job.color || "#215744" }}
                >
                  <CaseOpenLink caseId={job.id} label={job.caseNumber} />
                  <p className="text-[11px] opacity-80">Ikke tidsat</p>
                  <p className="text-sm font-medium leading-snug">
                    {job.caseNumber} · {job.title}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {job.customerName}
                    {job.customerCity ? ` · ${job.customerCity}` : ""}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {draft ? (
        <ActivityDialog
          draft={draft}
          cases={cases}
          forUserId={workerId}
          onClose={() => {
            setDraft(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function useMinDagSwipe() {
  const [swipe, setSwipe] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(MIN_DAG_SWIPE_MEDIA);
    const apply = () => setSwipe(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return swipe;
}

function DayHead({ day, hours, href }: { day: CalendarDay; hours: number; href: string }) {
  const className = [
    "timesheet-day-head block border-b border-l border-[var(--ts-line)] px-2 py-1.5 text-center text-[12px] hover:bg-black/5",
    day.holiday ? "timesheet-head--holiday" : "",
    day.isWeekend && !day.holiday ? "timesheet-head--weekend" : "",
    day.isToday && !day.isWeekend && !day.holiday ? "bg-[#f3f6f2]" : "",
    day.isSelected ? "ring-inset ring-2 ring-pine" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Link href={href} className={className}>
      {day.isWeekend && !day.holiday ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide">Weekend</p>
      ) : day.holiday ? (
        <p className="text-[11px] font-semibold leading-tight">{day.holiday}</p>
      ) : (
        <p className="capitalize text-[#555]">{format(parseDayParam(day.iso), "EEEEEE dd.MM", { locale: da })}</p>
      )}
      <p className="text-[11px] opacity-80">Timer: {formatHoursDa(hours)}</p>
    </Link>
  );
}

function DayColumn({
  day,
  jobs,
  absences,
  hours,
  height,
  onDrop,
  onAdd,
  onEdit,
  onResize,
}: {
  day: CalendarDay;
  jobs: TimesheetJob[];
  absences: CalendarAbsence[];
  hours: number[];
  height: number;
  onDrop: (day: CalendarDay, hour?: number) => (payload: DragPayload) => Promise<void> | void;
  onAdd: (
    day: CalendarDay,
    hour: number,
    minute?: number,
    caseId?: string,
    endHour?: number,
    endMinute?: number,
  ) => void;
  onEdit: (day: CalendarDay, job: TimesheetJob) => void;
  onResize: (day: CalendarDay, job: TimesheetJob, endHour: number, endMinute: number) => void;
}) {
  const [overHour, setOverHour] = useState<number | null>(null);
  const [range, setRange] = useState<{ origin: number; current: number } | null>(null);
  const rangeRef = useRef<{ origin: number; current: number } | null>(null);
  const gestureRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    top: number;
    lock: "pending" | "v" | "h";
  } | null>(null);
  const dayDate = parseDayParam(day.iso);
  const items = jobs.filter((job) => {
    if (!job.scheduledStart || !job.scheduledEnd) return false;
    return overlapsDay(new Date(job.scheduledStart), new Date(job.scheduledEnd), dayDate);
  });

  function readPayload(event: React.DragEvent): DragPayload | null {
    const raw = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      return payload.caseId || payload.activityId ? payload : null;
    } catch {
      return null;
    }
  }

  function minutesAt(clientY: number, top: number) {
    return pointerToMinutes(clientY, top, height);
  }

  function finishRange(selection: { origin: number; current: number }) {
    const snapped = snapTimeRange(selection.origin, selection.current);
    const start = clockFromMinutes(snapped.from);
    const end = clockFromMinutes(snapped.dragged ? snapped.to : snapped.from + 60);
    onAdd(day, start.hour, start.minute, "", end.hour, end.minute);
  }

  const snappedRange = range ? snapTimeRange(range.origin, range.current) : null;
  const selectFrom = snappedRange?.from ?? 0;
  const selectTo = snappedRange
    ? snappedRange.dragged
      ? snappedRange.to
      : snappedRange.from + 60
    : 0;

  return (
    <div
      data-cal-col
      className={`relative border-l border-[var(--ts-line)] ${
        day.holiday ? "timesheet-col--holiday" : day.isWeekend ? "timesheet-col--weekend" : ""
      } ${range ? "timesheet-col--selecting" : ""}`}
      style={{ height, touchAction: range ? "none" : "pan-x" }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest(".cal-job, .cal-job-open, a, button")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        gestureRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          top: rect.top,
          lock: "pending",
        };
      }}
      onPointerMove={(event) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (gesture.lock === "pending") {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          if (Math.abs(dx) > Math.abs(dy)) {
            gesture.lock = "h";
            gestureRef.current = null;
            rangeRef.current = null;
            setRange(null);
            return;
          }
          gesture.lock = "v";
          event.preventDefault();
          const minutes = minutesAt(gesture.y, gesture.top);
          const next = { origin: minutes, current: minutesAt(event.clientY, gesture.top) };
          rangeRef.current = next;
          setRange(next);
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* pointer capture is optional */
          }
          return;
        }
        if (gesture.lock !== "v" || !rangeRef.current) return;
        event.preventDefault();
        const next = { origin: rangeRef.current.origin, current: minutesAt(event.clientY, gesture.top) };
        rangeRef.current = next;
        setRange(next);
      }}
      onPointerUp={(event) => {
        const gesture = gestureRef.current;
        gestureRef.current = null;
        const selection = rangeRef.current;
        rangeRef.current = null;
        setRange(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            /* ignore */
          }
        }
        if (gesture?.lock === "h") return;
        if (selection) {
          finishRange(selection);
          return;
        }
        if (gesture && gesture.lock === "pending" && gesture.pointerId === event.pointerId) {
          const minutes = minutesAt(gesture.y, gesture.top);
          finishRange({ origin: minutes, current: minutes });
        }
      }}
      onPointerCancel={() => {
        gestureRef.current = null;
        rangeRef.current = null;
        setRange(null);
      }}
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className={`absolute inset-x-0 cursor-ns-resize border-t border-[var(--ts-line)] hover:bg-black/[0.04] ${
            overHour === hour ? "bg-moss/50" : ""
          }`}
          style={{ top: (hour - START_HOUR) * PX_PER_HOUR, height: PX_PER_HOUR }}
          onDragEnter={(event) => {
            event.preventDefault();
            setOverHour(hour);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setOverHour((current) => (current === hour ? null : current));
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setOverHour(null);
            setRange(null);
            const payload = readPayload(event);
            if (payload) onDrop(day, hour)(payload);
          }}
        />
      ))}
      {range ? (
        <div
          className="timesheet-range"
          style={{
            top: ((selectFrom - START_HOUR * 60) / 60) * PX_PER_HOUR,
            height: Math.max(6, ((selectTo - selectFrom) / 60) * PX_PER_HOUR),
          }}
        />
      ) : null}
      {absences.map((absence) => (
        <div
          key={absence.id}
          className="timesheet-absence timesheet-absence--registered absolute inset-x-1 top-1 z-20 rounded-sm px-1 py-0.5 text-[10px]"
        >
          {absence.label}
        </div>
      ))}
      {items.map((job) => {
        const start = new Date(job.scheduledStart!);
        const end = new Date(job.scheduledEnd!);
        const from = Math.max(START_HOUR * 60, minutesOnDay(start, dayDate));
        const to = Math.min(END_HOUR * 60, Math.max(from + 20, minutesOnDay(end, dayDate)));
        const duration = billedHours(start, end);
        const line2 = [job.customerAddress, job.customerCity].filter(Boolean).join(", ");
        const tone = job.tone ?? "case-planned";
        const canDrag = job.source !== "activity" || Boolean(job.tone?.includes("-planned"));
        return (
          <article
            key={job.id}
            draggable={canDrag}
            onDragStart={(event) => {
              if (!canDrag) return;
              if ((event.target as HTMLElement).closest(".cal-resize")) {
                event.preventDefault();
                return;
              }
              const payload: DragPayload =
                job.source === "activity"
                  ? {
                      activityId: job.id,
                      fromDate: day.iso,
                      assignedToId: job.assignedToId,
                    }
                  : {
                      caseId: job.id,
                      fromDate: day.iso,
                      assignedToId: job.assignedToId,
                    };
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
              event.dataTransfer.setData("text/plain", JSON.stringify(payload));
            }}
            className={`cal-job cal-job--${tone} absolute inset-x-px z-10 overflow-visible px-1.5 py-1 pr-5 text-[11px] leading-snug ${
              canDrag ? "cursor-grab" : "cursor-pointer"
            }`}
            style={{
              top: ((from - START_HOUR * 60) / 60) * PX_PER_HOUR,
              height: Math.max(28, ((to - from) / 60) * PX_PER_HOUR - 1),
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(day, job);
            }}
          >
            {job.source !== "activity" || job.caseId ? (
              <CaseOpenLink caseId={job.caseId || job.id} label={job.caseNumber} />
            ) : null}
            <p className="font-medium">
              ({formatHoursDa(duration)}) {formatTime(start)} – {formatTime(end)}
            </p>
            <p className="block">
              {job.caseNumber}
              {job.title ? ` · ${job.title}` : ""}
            </p>
            {line2 ? <p className="opacity-90">{line2}</p> : null}
            {job.insuranceCompany ? <p className="opacity-80">{job.insuranceCompany}</p> : null}
            {canDrag ? (
              <BookingResizeHandle
                fromHour={START_HOUR}
                toHour={END_HOUR}
                pxPerHour={PX_PER_HOUR}
                minEndMinutes={from + 15}
                onCommit={(hour, minute) => onResize(day, job, hour, minute)}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#eee] py-2">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function hoursOnDay(jobs: TimesheetJob[], day: CalendarDay): number {
  const dayDate = parseDayParam(day.iso);
  return uniqueTimesheetJobs(jobs).reduce((sum, job) => {
    if (!job.scheduledStart || !job.scheduledEnd) return sum;
    const start = new Date(job.scheduledStart);
    const end = new Date(job.scheduledEnd);
    if (!overlapsDay(start, end, dayDate)) return sum;
    return sum + billedHours(start, end);
  }, 0);
}

function tradeShort(label: string): string {
  const map: Record<string, string> = {
    Tømrer: "TM",
    Murer: "MU",
    Elektriker: "EL",
    VVS: "VV",
    Maler: "MA",
    Gulv: "GU",
    Tag: "TA",
    Andet: "AN",
  };
  return map[label] ?? label.slice(0, 2).toUpperCase();
}

function pointerToMinutes(clientY: number, top: number, heightPx: number): number {
  const ratio = heightPx <= 0 ? 0 : (clientY - top) / heightPx;
  const minutes = START_HOUR * 60 + ratio * (END_HOUR - START_HOUR) * 60;
  return Math.min(END_HOUR * 60, Math.max(START_HOUR * 60, minutes));
}

function snapTimeRange(origin: number, current: number): { from: number; to: number; dragged: boolean } {
  const rawFrom = Math.min(origin, current);
  const rawTo = Math.max(origin, current);
  const from = Math.floor(rawFrom / 15) * 15;
  const to = Math.max(from + 15, Math.ceil(rawTo / 15) * 15);
  return { from, to, dragged: rawTo - rawFrom >= 12 };
}

function clockFromMinutes(total: number): { hour: number; minute: number } {
  const capped = Math.min(23 * 60 + 45, Math.max(0, total));
  return { hour: Math.floor(capped / 60), minute: capped % 60 };
}
