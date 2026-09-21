"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { moveCaseOnCalendar, resizeCaseOnCalendar } from "@/app/actions/cases";
import { moveTimesheetActivity, resizeTimesheetActivity } from "@/app/actions/field";
import { ActivityDialog, type ActivityCaseOption, type ActivityDraft } from "@/components/ActivityDialog";
import { BookingResizeHandle } from "@/components/BookingResizeHandle";
import { CaseOpenLink } from "@/components/CaseOpenLink";
import type { CalendarDay } from "@/components/WeekBoard";
import { formatHoursDa, formatTime, minutesOnDay, overlapsDay, parseDayParam } from "@/lib/dates";
import { durationHours, scheduleStatus, shortName } from "@/lib/scheduling";
import type { AbsenceType } from "@/lib/catalog";

export type ScheduleJob = {
  id: string;
  caseNumber: string;
  title: string;
  customerName: string;
  customerAddress: string;
  customerPostal: string;
  customerCity: string;
  insuranceCompany: string;
  state: string;
  assignedToId: string | null;
  assignedName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  color: string;
  actualHours: number;
  source?: "case" | "activity";
  caseId?: string;
  absenceType?: AbsenceType;
  note?: string;
  status?: "PLANLAGT" | "REGISTRERET";
};

export type ScheduleEmployee = {
  id: string;
  name: string;
  tradeLabel: string;
  color: string;
};

export type ScheduleAbsence = {
  id: string;
  userId: string;
  date: string;
  label: string;
};

export type ScheduleToolbar = {
  week: number;
  date: string;
  view: string;
  fromHour: number;
  toHour: number;
  trade: string;
  trades: { value: string; label: string }[];
  compare: boolean;
  prevHref: string;
  nextHref: string;
};

type DragPayload = {
  caseId?: string;
  activityId?: string;
  fromDate: string | null;
  assignedToId: string | null;
};

const DRAG_TYPE = "application/x-exempo-case";
const PAGE_SIZE = 8;
const PX_PER_HOUR = 32;

export function SchedulingBoard({
  days,
  jobs,
  unassigned,
  employees,
  absences,
  cases = [],
  fromHour,
  toHour,
  compare,
  toolbar,
}: {
  days: CalendarDay[];
  jobs: ScheduleJob[];
  unassigned: ScheduleJob[];
  employees: ScheduleEmployee[];
  absences: ScheduleAbsence[];
  cases?: ActivityCaseOption[];
  fromHour: number;
  toHour: number;
  compare: boolean;
  toolbar: ScheduleToolbar;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(employees[0]?.id ?? "");
  const [overKey, setOverKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<(ActivityDraft & { userId: string }) | null>(null);

  const pool = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const address = addressQuery.trim().toLowerCase();
    return unassigned.filter((job) => {
      const hay = `${job.caseNumber} ${job.title} ${job.customerName} ${job.insuranceCompany}`.toLowerCase();
      const addr = `${job.customerAddress} ${job.customerPostal} ${job.customerCity}`.toLowerCase();
      if (needle && !hay.includes(needle)) return false;
      if (address && !addr.includes(address)) return false;
      return true;
    });
  }, [unassigned, query, addressQuery]);

  const pageCount = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleOrders = pool.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

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

  function startDrag(event: React.DragEvent, job: ScheduleJob, fromDate: string | null) {
    const payload: DragPayload =
      job.source === "activity"
        ? { activityId: job.id, fromDate, assignedToId: job.assignedToId }
        : { caseId: job.id, fromDate, assignedToId: job.assignedToId };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  }

  function dropOn(day: CalendarDay, assignedToId: string, hour?: number) {
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
              forUserId: assignedToId,
              hour: hour ?? (payload.fromDate ? undefined : fromHour),
            });
          } else if (payload.caseId) {
            await moveCaseOnCalendar({
              caseId: payload.caseId,
              date: day.iso,
              fromDate: payload.fromDate ?? undefined,
              assignedToId,
              hour: hour ?? (payload.fromDate ? undefined : fromHour),
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

  function openSlot(
    day: CalendarDay,
    userId: string,
    hour: number,
    minute = 0,
    caseId = "",
    endHour?: number,
    endMinute?: number,
  ) {
    if (day.holiday) {
      const ok = window.confirm(`${day.holiday} (${day.iso})\n\nDet er en helligdag. Vil du alligevel tilføje tid?`);
      if (!ok) return;
    }
    let nextHour = endHour ?? hour + 1;
    let nextMinute = endMinute ?? minute;
    if (endHour == null) {
      nextHour = hour + 1;
      nextMinute = minute;
    }
    if (nextHour < hour || (nextHour === hour && nextMinute <= minute)) {
      nextHour = hour + 1;
      nextMinute = minute;
    }
    if (nextHour > 23) {
      nextHour = 23;
      nextMinute = 59;
    }
    setDraft({
      date: day.iso,
      startHour: hour,
      startMinute: minute,
      endHour: nextHour,
      endMinute: nextMinute,
      caseId,
      userId,
    });
  }

  function resizeJob(day: CalendarDay, job: ScheduleJob, endHour: number, endMinute: number) {
    const planned = job.source !== "activity" || job.status !== "REGISTRERET";
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
            forUserId: job.assignedToId ?? undefined,
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

  function openJob(day: CalendarDay, userId: string, job: ScheduleJob) {
    if (!job.scheduledStart || !job.scheduledEnd) return;
    const start = new Date(job.scheduledStart);
    const end = new Date(job.scheduledEnd);
    setDraft({
      date: day.iso,
      startHour: start.getHours(),
      startMinute: [0, 15, 30, 45].includes(start.getMinutes()) ? start.getMinutes() : 0,
      endHour: end.getHours(),
      endMinute: [0, 15, 30, 45].includes(end.getMinutes()) ? end.getMinutes() : 0,
      caseId: job.source === "activity" ? job.caseId ?? "" : job.id,
      activityId: job.source === "activity" ? job.id : undefined,
      source: job.source === "activity" ? "activity" : "case",
      kind: job.absenceType ? "FRAVAER" : "ARBEJDE",
      absenceType: job.absenceType,
      note: job.note ?? "",
      status: job.status,
      userId,
    });
  }

  async function toggleFullscreen() {
    const root = document.querySelector(".sch");
    if (!root) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await root.requestFullscreen();
  }

  function submitSoon(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className={`sch ${pending ? "sch--pending" : ""} ${collapsed ? "sch--collapsed" : ""}`} data-tour="tour-plan">
      <form className="sch-toolbar" action="/kalender">
        <Link className="sch-week-btn" href={toolbar.prevHref} aria-label="Forrige">
          ‹
        </Link>
        <span className="sch-week">uge {toolbar.week}</span>
        <Link className="sch-week-btn" href={toolbar.nextHref} aria-label="Næste">
          ›
        </Link>
        <input type="date" name="uge" defaultValue={toolbar.date} onChange={submitSoon} />
        <select name="vis" defaultValue={toolbar.view} onChange={submitSoon}>
          <option value="1">1 Dag</option>
          <option value="3">3 Dage</option>
          <option value="arbejdsdag">Arbejdsdag</option>
          <option value="uge">Uge</option>
        </select>
        <span className="sch-label">Fra</span>
        <select name="fra" defaultValue={String(toolbar.fromHour)} onChange={submitSoon}>
          {hourOptions()}
        </select>
        <span className="sch-label">Til</span>
        <select name="til" defaultValue={String(toolbar.toHour)} onChange={submitSoon}>
          {hourOptions()}
        </select>
        <span className="sch-label">Afdeling</span>
        <select name="afdeling" defaultValue={toolbar.trade} onChange={submitSoon}>
          <option value="">Alle</option>
          {toolbar.trades.map((trade) => (
            <option key={trade.value} value={trade.value}>
              {trade.label}
            </option>
          ))}
        </select>
        <label className="sch-check">
          <input type="checkbox" name="sammenlign" value="1" defaultChecked={toolbar.compare} onChange={submitSoon} />
          Sammenlign planlagt og udført tid
        </label>
        <button type="submit">Vis</button>
        <button type="button" className="sch-full" onClick={() => void toggleFullscreen()}>
          Fuldskærm
        </button>
      </form>

      {error ? <p className="sch-error">{error}</p> : null}

      <div className="sch-body">
        <aside className="sch-orders">
          <header className="sch-orders-head">
            <h2>Aktive ordrer i den valgte periode</h2>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Vis ordrer" : "Skjul ordrer"}
              title={collapsed ? "Vis ordrer" : "Skjul ordrer"}
            >
              {collapsed ? "›" : "‹"}
            </button>
          </header>
          {collapsed ? null : (
            <>
              <div className="sch-orders-filters">
                <span>Status</span>
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Ordrebeskrivelse"
                />
                <input
                  value={addressQuery}
                  onChange={(event) => {
                    setAddressQuery(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Installation..."
                />
                <span />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Søg beskrivelse"
                />
                <input
                  value={addressQuery}
                  onChange={(event) => {
                    setAddressQuery(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Søg adresse"
                />
              </div>
              <ul className="sch-order-list">
                {visibleOrders.length === 0 ? (
                  <li className="sch-order-empty">Ingen aktive ordrer matcher.</li>
                ) : (
                  visibleOrders.map((job) => {
                    const status = scheduleStatus(job.state, Boolean(job.scheduledStart));
                    return (
                      <li key={job.id}>
                        <article
                          className={`sch-order ${status.work === "Igang" ? "sch-order--busy" : ""}`}
                          draggable
                          onDragStart={(event) =>
                            startDrag(event, job, job.scheduledStart ? job.scheduledStart.slice(0, 10) : null)
                          }
                        >
                          <div className="sch-order-status">
                            <strong>{status.work}</strong>
                            <span>/ {status.plan}</span>
                          </div>
                          <div className="sch-order-body">
                            <Link href={`/sager/${job.id}`}>
                              {job.caseNumber} {job.title}
                            </Link>
                            <p>{job.insuranceCompany || "Andet"}</p>
                          </div>
                          <div className="sch-order-place">
                            <p>{job.assignedName || "—"}</p>
                            <p>
                              {job.customerAddress}
                              {job.customerPostal || job.customerCity
                                ? ` ${job.customerPostal} ${job.customerCity}`.trim()
                                : ""}
                            </p>
                          </div>
                        </article>
                      </li>
                    );
                  })
                )}
              </ul>
              <footer className="sch-pager">
                <button type="button" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                  ‹
                </button>
                <span>
                  Side {safePage + 1} af {pageCount}
                </span>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                >
                  ›
                </button>
                <span className="sch-pager-count">
                  Viser {pool.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min(pool.length, (safePage + 1) * PAGE_SIZE)} af {pool.length}
                </span>
              </footer>
            </>
          )}
        </aside>

        <div className="sch-board" style={{ "--sch-days": String(days.length) } as React.CSSProperties}>
          <div className="sch-head sch-head-label">Medarbejdere</div>
          {days.map((day) => (
            <div
              key={day.iso}
              className={`sch-head sch-dayhead ${day.isWeekend ? "sch-dayhead--weekend" : ""} ${
                day.holiday ? "sch-dayhead--holiday" : ""
              }`}
            >
              <span>{String(fromHour).padStart(2, "0")}:00</span>
              <strong>
                {day.weekday.replace(".", "")} {day.iso.slice(8, 10)}/{day.iso.slice(5, 7)}
              </strong>
              <span>{String(toHour).padStart(2, "0")}:00</span>
            </div>
          ))}

          {employees.length === 0 ? (
            <p className="sch-empty">Ingen medarbejdere at vise.</p>
          ) : (
            employees.map((employee, index) => (
              <EmployeeRow
                key={employee.id}
                index={index}
                employee={employee}
                selected={selectedId === employee.id}
                onSelect={() => setSelectedId(employee.id)}
                days={days}
                jobs={jobs}
                absences={absences}
                fromHour={fromHour}
                toHour={toHour}
                compare={compare}
                overKey={overKey}
                setOverKey={setOverKey}
                startDrag={startDrag}
                readPayload={readPayload}
                dropOn={dropOn}
                onAdd={(day, hour, minute, caseId, endHour, endMinute) =>
                  openSlot(day, employee.id, hour, minute, caseId, endHour, endMinute)
                }
                onEdit={(day, job) => openJob(day, employee.id, job)}
                onResize={resizeJob}
              />
            ))
          )}
        </div>
      </div>
      <p className="sch-hint">Klik et tidspunkt, eller hold musen nede og træk fra start til slut for at tilføje sag.</p>
      {draft ? (
        <ActivityDialog
          draft={draft}
          cases={cases}
          forUserId={draft.userId}
          onClose={() => {
            setDraft(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function hourOptions() {
  return Array.from({ length: 24 }, (_, hour) => (
    <option key={hour} value={hour}>
      {String(hour).padStart(2, "0")}:00
    </option>
  ));
}

function EmployeeRow({
  index,
  employee,
  selected,
  onSelect,
  days,
  jobs,
  absences,
  fromHour,
  toHour,
  compare,
  overKey,
  setOverKey,
  startDrag,
  readPayload,
  dropOn,
  onAdd,
  onEdit,
  onResize,
}: {
  index: number;
  employee: ScheduleEmployee;
  selected: boolean;
  onSelect: () => void;
  days: CalendarDay[];
  jobs: ScheduleJob[];
  absences: ScheduleAbsence[];
  fromHour: number;
  toHour: number;
  compare: boolean;
  overKey: string | null;
  setOverKey: (key: string | null) => void;
  startDrag: (event: React.DragEvent, job: ScheduleJob, fromDate: string | null) => void;
  readPayload: (event: React.DragEvent) => DragPayload | null;
  dropOn: (day: CalendarDay, assignedToId: string, hour?: number) => (payload: DragPayload) => void | Promise<void>;
  onAdd: (
    day: CalendarDay,
    hour: number,
    minute?: number,
    caseId?: string,
    endHour?: number,
    endMinute?: number,
  ) => void;
  onEdit: (day: CalendarDay, job: ScheduleJob) => void;
  onResize: (day: CalendarDay, job: ScheduleJob, endHour: number, endMinute: number) => void;
}) {
  return (
    <>
      <button
        type="button"
        className={`sch-person ${selected ? "sch-person--selected" : ""}`}
        onClick={onSelect}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const payload = readPayload(event);
          if (payload && days[0]) void dropOn(days[0], employee.id)(payload);
        }}
      >
        <span>
          {index + 1}. {employee.name}
        </span>
        <small>{employee.tradeLabel}</small>
      </button>
      {days.map((day) => (
        <ScheduleDayCell
          key={`${employee.id}-${day.iso}`}
          day={day}
          employee={employee}
          jobs={jobs}
          absences={absences}
          fromHour={fromHour}
          toHour={toHour}
          compare={compare}
          over={overKey === `${employee.id}-${day.iso}`}
          setOver={(value) => setOverKey(value ? `${employee.id}-${day.iso}` : null)}
          startDrag={startDrag}
          readPayload={readPayload}
          dropOn={dropOn}
          onAdd={onAdd}
          onEdit={onEdit}
          onResize={onResize}
        />
      ))}
    </>
  );
}

function ScheduleDayCell({
  day,
  employee,
  jobs,
  absences,
  fromHour,
  toHour,
  compare,
  over,
  setOver,
  startDrag,
  readPayload,
  dropOn,
  onAdd,
  onEdit,
  onResize,
}: {
  day: CalendarDay;
  employee: ScheduleEmployee;
  jobs: ScheduleJob[];
  absences: ScheduleAbsence[];
  fromHour: number;
  toHour: number;
  compare: boolean;
  over: boolean;
  setOver: (value: boolean) => void;
  startDrag: (event: React.DragEvent, job: ScheduleJob, fromDate: string | null) => void;
  readPayload: (event: React.DragEvent) => DragPayload | null;
  dropOn: (day: CalendarDay, assignedToId: string, hour?: number) => (payload: DragPayload) => void | Promise<void>;
  onAdd: (
    day: CalendarDay,
    hour: number,
    minute?: number,
    caseId?: string,
    endHour?: number,
    endMinute?: number,
  ) => void;
  onEdit: (day: CalendarDay, job: ScheduleJob) => void;
  onResize: (day: CalendarDay, job: ScheduleJob, endHour: number, endMinute: number) => void;
}) {
  const rangeRef = useRef<{ origin: number; current: number } | null>(null);
  const [range, setRange] = useState<{ origin: number; current: number } | null>(null);
  const hours = Array.from({ length: Math.max(1, toHour - fromHour) }, (_, index) => fromHour + index);
  const height = hours.length * PX_PER_HOUR;
  const dayDate = parseDayParam(day.iso);
  const items = jobs.filter((job) => {
    if (job.assignedToId !== employee.id || !job.scheduledStart || !job.scheduledEnd) return false;
    if (!overlapsDay(new Date(job.scheduledStart), new Date(job.scheduledEnd), dayDate)) return false;
    const start = new Date(job.scheduledStart);
    const end = new Date(job.scheduledEnd);
    const from = start.getHours() + start.getMinutes() / 60;
    const to = end.getHours() + end.getMinutes() / 60 || 24;
    return to > fromHour && from < toHour;
  });
  const dayAbsences = absences.filter((absence) => absence.userId === employee.id && absence.date === day.iso);

  function minutesAt(clientY: number, top: number) {
    return pointerToMinutes(clientY, top, height, fromHour, toHour);
  }

  function finishRange(selection: { origin: number; current: number }) {
    const snapped = snapTimeRange(selection.origin, selection.current);
    const start = clockFromMinutes(snapped.from);
    const end = clockFromMinutes(snapped.dragged ? snapped.to : snapped.from + 60);
    onAdd(day, start.hour, start.minute, "", end.hour, end.minute);
  }

  const snappedRange = range ? snapTimeRange(range.origin, range.current) : null;
  const selectFrom = snappedRange?.from ?? 0;
  const selectTo = snappedRange ? (snappedRange.dragged ? snappedRange.to : snappedRange.from + 60) : 0;

  return (
    <div
      data-cal-col
      className={`sch-cell ${day.holiday ? "sch-cell--holiday" : ""} ${day.isWeekend ? "sch-cell--weekend" : ""} ${
        over ? "sch-cell--over" : ""
      } ${range ? "sch-cell--selecting" : ""}`}
      style={{ height, touchAction: range ? "none" : undefined }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest(".sch-job, .cal-job-open, a, button")) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const minutes = minutesAt(event.clientY, rect.top);
        const next = { origin: minutes, current: minutes };
        rangeRef.current = next;
        setRange(next);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }}
      onPointerMove={(event) => {
        if (!rangeRef.current) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const next = { origin: rangeRef.current.origin, current: minutesAt(event.clientY, rect.top) };
        rangeRef.current = next;
        setRange(next);
      }}
      onPointerUp={(event) => {
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
        if (selection) finishRange(selection);
      }}
      onPointerCancel={() => {
        rangeRef.current = null;
        setRange(null);
      }}
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className="sch-hour"
          style={{ top: (hour - fromHour) * PX_PER_HOUR, height: PX_PER_HOUR }}
          onDragEnter={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            setRange(null);
            const payload = readPayload(event);
            if (payload) void dropOn(day, employee.id, hour)(payload);
          }}
        />
      ))}
      {range ? (
        <div
          className="sch-range"
          style={{
            top: ((selectFrom - fromHour * 60) / 60) * PX_PER_HOUR,
            height: Math.max(6, ((selectTo - selectFrom) / 60) * PX_PER_HOUR),
          }}
        />
      ) : null}
      {dayAbsences.map((absence) => (
        <div key={absence.id} className="sch-job sch-job--absence">
          {absence.label}
        </div>
      ))}
      {items.map((job) => {
        const start = new Date(job.scheduledStart!);
        const end = new Date(job.scheduledEnd!);
        const from = Math.max(fromHour * 60, minutesOnDay(start, dayDate));
        const to = Math.min(toHour * 60, Math.max(from + 20, minutesOnDay(end, dayDate)));
        return (
          <JobChip
            key={job.id}
            job={job}
            color={employee.color}
            compare={compare}
            onDragStart={
              job.source === "activity" && job.status === "REGISTRERET"
                ? undefined
                : (event) => startDrag(event, job, day.iso)
            }
            onEdit={() => onEdit(day, job)}
            onResize={
              job.source === "activity" && job.status === "REGISTRERET"
                ? undefined
                : (hour, minute) => onResize(day, job, hour, minute)
            }
            fromHour={fromHour}
            toHour={toHour}
            minEndMinutes={from + 15}
            style={{
              top: ((from - fromHour * 60) / 60) * PX_PER_HOUR,
              height: Math.max(22, ((to - from) / 60) * PX_PER_HOUR - 1),
            }}
          />
        );
      })}
    </div>
  );
}

function JobChip({
  job,
  color,
  compare,
  onDragStart,
  onEdit,
  onResize,
  fromHour,
  toHour,
  minEndMinutes,
  style,
}: {
  job: ScheduleJob;
  color: string;
  compare: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onEdit?: () => void;
  onResize?: (endHour: number, endMinute: number) => void;
  fromHour: number;
  toHour: number;
  minEndMinutes: number;
  style?: React.CSSProperties;
}) {
  const start = new Date(job.scheduledStart!);
  const end = new Date(job.scheduledEnd!);
  const planned = durationHours(start, end);
  const place = [job.customerAddress, job.customerCity].filter(Boolean).join(", ");
  return (
    <article
      className="sch-job"
      draggable={Boolean(onDragStart)}
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest(".cal-resize")) {
          event.preventDefault();
          return;
        }
        onDragStart?.(event);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onEdit?.();
      }}
      style={{ background: color || "#215744", cursor: onDragStart ? "grab" : "pointer", ...style }}
    >
      {job.source !== "activity" ? <CaseOpenLink caseId={job.id} label={job.caseNumber} /> : null}
      <span className="sch-job-who">{shortName(job.assignedName)}</span>
      <div>
        <p className="sch-job-time">
          {formatTime(start)}–{formatTime(end)} ({formatHoursDa(planned)}
          {compare ? ` / ${formatHoursDa(job.actualHours)}` : ""})
        </p>
        {job.source !== "activity" ? (
          <Link href={`/sager/${job.id}`} onClick={(event) => event.stopPropagation()}>
            {job.caseNumber}
          </Link>
        ) : (
          <span>{job.caseNumber}</span>
        )}
        <p>{place || job.title}</p>
      </div>
      {onResize ? (
        <BookingResizeHandle
          fromHour={fromHour}
          toHour={toHour}
          pxPerHour={PX_PER_HOUR}
          minEndMinutes={minEndMinutes}
          onCommit={onResize}
        />
      ) : null}
    </article>
  );
}

function pointerToMinutes(
  clientY: number,
  top: number,
  heightPx: number,
  startHour: number,
  endHour: number,
): number {
  const ratio = heightPx <= 0 ? 0 : (clientY - top) / heightPx;
  const minutes = startHour * 60 + ratio * (endHour - startHour) * 60;
  return Math.min(endHour * 60, Math.max(startHour * 60, minutes));
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
