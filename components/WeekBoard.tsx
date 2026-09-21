"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveCaseOnCalendar } from "@/app/actions/cases";
import { CaseOpenLink } from "@/components/CaseOpenLink";
import { StatusBadge } from "@/components/StatusBadge";
import { formatSlot, formatTime, hoursOfDay, minutesOnDay, overlapsDay, parseDayParam } from "@/lib/dates";

export type CalendarDay = {
  iso: string;
  weekday: string;
  dayNumber: string;
  holiday: string | null;
  isToday: boolean;
  isWeekend: boolean;
  isSelected?: boolean;
};

export type CalendarJob = {
  id: string;
  caseNumber: string;
  title: string;
  customerName: string;
  customerCity: string;
  state: string;
  assignedToId: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  color: string;
};

export type CalendarEmployee = {
  id: string;
  name: string;
  tradeLabel: string;
  color: string;
};

export type CalendarAbsence = {
  id: string;
  userId: string;
  date: string;
  label: string;
};

type DragPayload = {
  caseId: string;
  fromDate: string | null;
  assignedToId: string | null;
};

const DRAG_TYPE = "application/x-exempo-case";
const PX_PER_HOUR = 28;

export function WeekBoard({
  days,
  jobs,
  absences,
  employees,
  unassigned = [],
  variant,
  dayHrefBase,
}: {
  days: CalendarDay[];
  jobs: CalendarJob[];
  absences: CalendarAbsence[];
  employees?: CalendarEmployee[];
  unassigned?: CalendarJob[];
  variant: "mine" | "team";
  dayHrefBase?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function dropOn(day: CalendarDay, assignedToId?: string, hour?: number) {
    return async (payload: DragPayload) => {
      if (day.holiday) {
        const ok = window.confirm(
          `${day.holiday} (${day.iso})\n\nDet er en helligdag. Vil du alligevel flytte sagen hertil?`,
        );
        if (!ok) return;
      }
      setError(null);
      startTransition(async () => {
        try {
          await moveCaseOnCalendar({
            caseId: payload.caseId,
            date: day.iso,
            fromDate: payload.fromDate ?? undefined,
            assignedToId: assignedToId ?? payload.assignedToId ?? undefined,
            hour,
          });
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kunne ikke flytte sagen.");
        }
      });
    };
  }

  const rows =
    variant === "team"
      ? (employees ?? [])
      : [{ id: "", name: "", tradeLabel: "", color: "" }];

  return (
    <div className={pending ? "opacity-70" : ""}>
      {error ? (
        <p className="mb-3 rounded-xl bg-[#f3d7d4] px-3 py-2 text-sm text-[#7c2f2a]">{error}</p>
      ) : null}
      <p className="mb-3 text-sm text-muted">
        Træk en sag til et tidspunkt mellem 00:00 og 23:59.
        {variant === "team"
          ? " Du kan også trække sager over på en anden medarbejder."
          : " Træk en sag fra listen nedenfor for at booke den på dig selv."}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-line bg-paper-2">
        <div
          className="min-w-[880px]"
          style={{
            display: "grid",
            gridTemplateColumns:
              variant === "team"
                ? "11rem repeat(7, minmax(0, 1fr))"
                : "3.5rem repeat(7, minmax(0, 1fr))",
          }}
        >
          {variant === "team" ? (
            <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Medarbejder
            </div>
          ) : (
            <div className="border-b border-line px-1 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
              00:00–23:59
            </div>
          )}
          {days.map((day) => (
            <DayHeader key={day.iso} day={day} href={dayHrefBase ? `${dayHrefBase}${day.iso}` : undefined} />
          ))}
          {variant === "mine" ? (
            <MineHourGrid days={days} jobs={jobs} absences={absences} onDrop={dropOn} />
          ) : (
            rows.map((employee) => (
              <EmployeeWeekRow
                key={employee.id || "mine"}
                employee={employee}
                days={days}
                jobs={jobs}
                absences={absences}
                onDrop={dropOn}
              />
            ))
          )}
        </div>
      </div>
      {variant === "mine" || unassigned.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-paper-2 p-4">
          <h2 className="font-serif text-xl">
            {variant === "mine" ? "Sager du kan booke på dig selv" : "Sager der venter på kalenderen"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {variant === "mine"
              ? "Træk en sag ind på et tidspunkt (00:00–23:59) i din uge."
              : "Træk en sag ind på en medarbejders dag."}
          </p>
          {unassigned.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Ingen åbne sager at booke lige nu.</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {unassigned.map((job) => (
                <li key={job.id}>
                  <JobCard
                    job={job}
                    fromDate={null}
                    days={days}
                    onMove={(date) =>
                      dropOn(days.find((d) => d.iso === date)!, undefined)({
                        caseId: job.id,
                        fromDate: null,
                        assignedToId: job.assignedToId,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DayHeader({ day, href }: { day: CalendarDay; href?: string }) {
  const className = [
    "border-b border-line px-2 py-2",
    day.holiday ? "cal-day--holiday" : "",
    day.isWeekend && !day.holiday ? "cal-day--weekend" : "",
    day.isSelected ? "bg-pine text-[#f4efe4]" : "",
    day.isToday && !day.isSelected ? "bg-moss/60" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider">{day.weekday}</p>
      <p className="text-sm">{day.dayNumber}</p>
      {day.holiday ? <p className="mt-0.5 text-[10px] font-medium leading-tight">{day.holiday}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${className} block hover:bg-white/40`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function MineHourGrid({
  days,
  jobs,
  absences,
  onDrop,
}: {
  days: CalendarDay[];
  jobs: CalendarJob[];
  absences: CalendarAbsence[];
  onDrop: (day: CalendarDay, assignedToId?: string, hour?: number) => (payload: DragPayload) => Promise<void> | void;
}) {
  const hours = hoursOfDay();
  const height = 24 * PX_PER_HOUR;
  return (
    <>
      <div className="relative border-t border-line">
        {hours.map((hour) => (
          <div
            key={hour}
            className="border-t border-line px-1 text-[10px] text-muted"
            style={{ height: PX_PER_HOUR }}
          >
            {String(hour).padStart(2, "0")}:00
          </div>
        ))}
        <div className="-mt-3 px-1 pb-1 text-[10px] text-muted">23:59</div>
      </div>
      {days.map((day) => (
        <HourDayColumn
          key={day.iso}
          day={day}
          jobs={jobs}
          absences={absences.filter((absence) => absence.date === day.iso)}
          height={height}
          hours={hours}
          onDrop={onDrop}
        />
      ))}
    </>
  );
}

function HourDayColumn({
  day,
  jobs,
  absences,
  height,
  hours,
  onDrop,
}: {
  day: CalendarDay;
  jobs: CalendarJob[];
  absences: CalendarAbsence[];
  height: number;
  hours: number[];
  onDrop: (day: CalendarDay, assignedToId?: string, hour?: number) => (payload: DragPayload) => Promise<void> | void;
}) {
  const [overHour, setOverHour] = useState<number | null>(null);
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
      return payload.caseId ? payload : null;
    } catch {
      return null;
    }
  }

  return (
    <div
      className={`relative border-t border-l border-line ${day.holiday ? "cal-day--holiday" : ""} ${
        day.isWeekend && !day.holiday ? "cal-day--weekend" : ""
      } ${day.isSelected ? "cal-day--selected" : ""}`}
      style={{ height }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className={`absolute inset-x-0 border-t border-line/70 ${
            overHour === hour ? "cal-day--over bg-moss/40" : ""
          }`}
          style={{ top: hour * PX_PER_HOUR, height: PX_PER_HOUR }}
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
            const payload = readPayload(event);
            if (payload) onDrop(day, undefined, hour)(payload);
          }}
        />
      ))}
      {absences.map((absence) => (
        <div key={absence.id} className="absolute inset-x-1 top-1 z-20 rounded-lg bg-[#ece7dc] px-1 py-0.5 text-[10px]">
          {absence.label}
        </div>
      ))}
      {items.map((job) => {
        const start = new Date(job.scheduledStart!);
        const end = new Date(job.scheduledEnd!);
        const from = minutesOnDay(start, dayDate);
        const to = Math.max(from + 20, minutesOnDay(end, dayDate));
        return (
          <article
            key={job.id}
            draggable
            onDragStart={(event) => {
              const payload: DragPayload = {
                caseId: job.id,
                fromDate: day.iso,
                assignedToId: job.assignedToId,
              };
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
              event.dataTransfer.setData("text/plain", JSON.stringify(payload));
            }}
            className="cal-job absolute inset-x-1 z-10 cursor-grab overflow-hidden rounded-lg p-1 pr-5 text-white shadow-sm"
            style={{
              top: (from / 60) * PX_PER_HOUR,
              height: Math.max(22, ((to - from) / 60) * PX_PER_HOUR),
              background: job.color || "#215744",
            }}
          >
            <CaseOpenLink caseId={job.id} label={job.caseNumber} />
            <p className="text-[10px] leading-tight opacity-80">
              {formatTime(start)}–{formatTime(end)}
            </p>
            <Link href={`/sager/${job.id}`} className="block text-[11px] font-medium leading-snug hover:underline">
              {job.caseNumber}
            </Link>
          </article>
        );
      })}
    </div>
  );
}

function EmployeeWeekRow({
  employee,
  days,
  jobs,
  absences,
  onDrop,
}: {
  employee: CalendarEmployee;
  days: CalendarDay[];
  jobs: CalendarJob[];
  absences: CalendarAbsence[];
  onDrop: (day: CalendarDay, assignedToId?: string, hour?: number) => (payload: DragPayload) => Promise<void> | void;
}) {
  return (
    <>
      <div className="border-t border-line px-3 py-3">
        <p className="font-medium">{employee.name}</p>
        <p className="text-xs text-muted">{employee.tradeLabel}</p>
      </div>
      {days.map((day) => {
        const dayDate = parseDayParam(day.iso);
        const items = jobs.filter((job) => {
          if (job.assignedToId !== employee.id) return false;
          if (!job.scheduledStart || !job.scheduledEnd) return false;
          return overlapsDay(new Date(job.scheduledStart), new Date(job.scheduledEnd), dayDate);
        });
        const dayAbsences = absences.filter((absence) => absence.date === day.iso && absence.userId === employee.id);
        return (
          <DropCell key={`${employee.id}-${day.iso}`} day={day} onDrop={onDrop(day, employee.id)}>
            {dayAbsences.map((absence) => (
              <div key={absence.id} className="rounded-xl bg-[#ece7dc] p-2 text-xs">
                {absence.label}
              </div>
            ))}
            {items.map((job) => (
              <JobCard
                key={job.id}
                job={{ ...job, color: employee.color }}
                fromDate={day.iso}
                days={days}
                onMove={(iso) =>
                  onDrop(days.find((d) => d.iso === iso)!, employee.id)({
                    caseId: job.id,
                    fromDate: day.iso,
                    assignedToId: employee.id,
                  })
                }
              />
            ))}
          </DropCell>
        );
      })}
    </>
  );
}

function DropCell({
  day,
  onDrop,
  children,
}: {
  day: CalendarDay;
  onDrop: (payload: DragPayload) => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`cal-day min-h-36 space-y-2 border-t border-l border-line p-2 ${
        day.holiday ? "cal-day--holiday" : ""
      } ${day.isWeekend && !day.holiday ? "cal-day--weekend" : ""} ${
        day.isSelected ? "cal-day--selected" : ""
      } ${over ? "cal-day--over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
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
        const raw = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as DragPayload;
          if (payload.caseId) onDrop(payload);
        } catch {
          /* ignore */
        }
      }}
    >
      {children}
    </div>
  );
}

function JobCard({
  job,
  fromDate,
  days,
  onMove,
}: {
  job: CalendarJob;
  fromDate: string | null;
  days: CalendarDay[];
  onMove: (iso: string) => void;
}) {
  const start = job.scheduledStart ? new Date(job.scheduledStart) : null;
  const end = job.scheduledEnd ? new Date(job.scheduledEnd) : null;
  return (
    <article
      draggable
      onDragStart={(event) => {
        const payload: DragPayload = {
          caseId: job.id,
          fromDate,
          assignedToId: job.assignedToId,
        };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
        event.dataTransfer.setData("text/plain", JSON.stringify(payload));
        (event.currentTarget as HTMLElement).classList.add("cal-job--dragging");
      }}
      onDragEnd={(event) => {
        (event.currentTarget as HTMLElement).classList.remove("cal-job--dragging");
      }}
      className="cal-job relative cursor-grab rounded-xl p-2 pr-7 text-white"
      style={{ background: job.color || "#215744" }}
    >
      <CaseOpenLink caseId={job.id} label={job.caseNumber} />
      <p className="text-[11px] opacity-80">{start && end ? formatSlot(start, end) : "Ikke tidsat"}</p>
      <Link href={`/sager/${job.id}`} className="block text-sm font-medium leading-snug hover:underline">
        {job.caseNumber} · {job.title}
      </Link>
      <p className="mt-0.5 text-[11px] opacity-80">
        {job.customerName}
        {job.customerCity ? ` · ${job.customerCity}` : ""}
      </p>
      <div className="mt-1">
        <StatusBadge state={job.state} />
      </div>
      {fromDate ? (
        <label className="mt-2 block text-[10px] uppercase tracking-wider opacity-80">
          Flyt til
          <select
            className="mt-1 w-full rounded-lg border-0 bg-white/15 px-2 py-1 text-xs text-white"
            defaultValue=""
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const iso = event.target.value;
              event.target.value = "";
              if (iso) onMove(iso);
            }}
          >
            <option value="">Vælg dag</option>
            {days.map((day) => (
              <option key={day.iso} value={day.iso} className="text-ink">
                {day.weekday} {day.dayNumber}
                {day.holiday ? ` · ${day.holiday}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-2 text-[10px] opacity-80">Træk sagen ind på kalenderen</p>
      )}
    </article>
  );
}
