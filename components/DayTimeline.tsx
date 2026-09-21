"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveCaseOnCalendar } from "@/app/actions/cases";
import { CaseOpenLink } from "@/components/CaseOpenLink";
import { formatTime, hoursOfDay, minutesOnDay, parseDayParam } from "@/lib/dates";
import type { CalendarJob } from "@/components/WeekBoard";

const DRAG_TYPE = "application/x-exempo-case";
const PX_PER_HOUR = 48;

type DragPayload = {
  caseId: string;
  fromDate: string | null;
  assignedToId: string | null;
};

export function DayTimeline({
  date,
  jobs,
  color,
}: {
  date: string;
  jobs: CalendarJob[];
  color: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [overHour, setOverHour] = useState<number | null>(null);
  const day = parseDayParam(date);
  const hours = hoursOfDay();
  const height = 24 * PX_PER_HOUR;

  function dropAt(hour: number, payload: DragPayload) {
    setError(null);
    startTransition(async () => {
      try {
        await moveCaseOnCalendar({
          caseId: payload.caseId,
          date,
          fromDate: payload.fromDate ?? undefined,
          assignedToId: payload.assignedToId ?? undefined,
          hour,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke booke tiden.");
      }
    });
  }

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
    <div className={pending ? "opacity-70" : ""}>
      {error ? (
        <p className="mb-3 rounded-xl bg-[#f3d7d4] px-3 py-2 text-sm text-[#7c2f2a]">{error}</p>
      ) : null}
      <p className="mb-3 text-sm text-muted">
        Døgnet går fra 00:00 til 23:59. Træk en sag ind på et tidspunkt, eller book nedenfor.
      </p>
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-2">
        <div className="grid grid-cols-[4.5rem_1fr]">
          <div className="border-b border-line px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Tid
          </div>
          <div className="border-b border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            00:00 – 23:59
          </div>
        </div>
        <div className="grid grid-cols-[4.5rem_1fr]">
          <div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-t border-line px-2 text-xs text-muted"
                style={{ height: PX_PER_HOUR }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
            <div className="-mt-4 px-2 pb-1 text-xs text-muted">23:59</div>
          </div>
          <div
            className="relative border-l border-line"
            style={{ height }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className={`absolute inset-x-0 border-t border-line/80 ${
                  overHour === hour ? "cal-day--over bg-moss/40" : hour % 2 ? "bg-white/40" : ""
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
                  if (payload) dropAt(hour, payload);
                }}
              />
            ))}
            {jobs.map((job) => {
              if (!job.scheduledStart || !job.scheduledEnd) return null;
              const start = new Date(job.scheduledStart);
              const end = new Date(job.scheduledEnd);
              const from = minutesOnDay(start, day);
              const to = Math.max(from + 20, minutesOnDay(end, day));
              const top = (from / 60) * PX_PER_HOUR;
              const blockHeight = Math.max(28, ((to - from) / 60) * PX_PER_HOUR);
              return (
                <article
                  key={job.id}
                  draggable
                  onDragStart={(event) => {
                    const payload: DragPayload = {
                      caseId: job.id,
                      fromDate: date,
                      assignedToId: job.assignedToId,
                    };
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
                    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
                  }}
                  className="cal-job absolute inset-x-2 z-10 cursor-grab overflow-hidden rounded-xl p-2 pr-7 text-white shadow-sm"
                  style={{ top, height: blockHeight, background: job.color || color }}
                >
                  <CaseOpenLink caseId={job.id} label={job.caseNumber} />
                  <p className="text-[11px] opacity-80">
                    {formatTime(start)}–{formatTime(end)}
                  </p>
                  <Link href={`/sager/${job.id}`} className="block text-sm font-medium leading-snug hover:underline">
                    {job.caseNumber} · {job.title}
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
