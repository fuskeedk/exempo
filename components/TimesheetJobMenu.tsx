"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveCaseOnCalendar } from "@/app/actions/cases";
import { deleteTimesheetActivity, moveTimesheetActivity, saveTimesheetActivity } from "@/app/actions/field";
import type { AbsenceType } from "@/lib/catalog";
import { looksLikeFullDay } from "@/lib/dates";
import { appleMapsUrl, formatPlace, googleMapsSearchUrl } from "@/lib/geo";
import type { CalendarDay } from "@/components/WeekBoard";

export type TimesheetMenuJob = {
  id: string;
  caseNumber: string;
  title: string;
  customerAddress?: string;
  customerCity?: string;
  caseId?: string;
  source?: "case" | "activity";
  tone?: string;
  absenceType?: AbsenceType;
  note?: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  assignedToId: string | null;
};

export function TimesheetJobMenu({
  day,
  job,
  forUserId,
  onEdit,
  onClose,
}: {
  day: CalendarDay;
  job: TimesheetMenuJob;
  forUserId?: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [postpone, setPostpone] = useState(false);
  const [date, setDate] = useState(day.iso);
  const registered = Boolean(job.tone?.includes("registered"));
  const absence = Boolean(job.absenceType) || Boolean(job.tone?.startsWith("absence"));
  const caseId = job.source === "activity" ? job.caseId ?? "" : job.id;
  const place = formatPlace([job.customerAddress, job.customerCity]);
  const mapHref = googleMapsSearchUrl(place);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function register() {
    if (!job.scheduledStart || !job.scheduledEnd) return;
    const start = new Date(job.scheduledStart);
    const end = new Date(job.scheduledEnd);
    setError(null);
    startTransition(async () => {
      try {
        await saveTimesheetActivity({
          intent: "register",
          kind: absence ? "FRAVAER" : "ARBEJDE",
          date: day.iso,
          startHour: start.getHours(),
          startMinute: start.getMinutes(),
          endHour: end.getHours(),
          endMinute: end.getMinutes(),
          allDay: looksLikeFullDay(start.getHours(), start.getMinutes(), end.getHours(), end.getMinutes()),
          caseId: absence ? "" : caseId,
          note: job.note ?? "",
          forUserId,
          absenceType: job.absenceType,
          activityId: job.source === "activity" ? job.id : undefined,
          source: job.source === "activity" ? "activity" : "case",
        });
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke registrere tiden.");
      }
    });
  }

  function move() {
    if (date === day.iso) {
      onClose();
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (job.source === "activity") {
          await moveTimesheetActivity({
            activityId: job.id,
            date,
            fromDate: day.iso,
            forUserId: forUserId ?? job.assignedToId ?? undefined,
          });
        } else {
          await moveCaseOnCalendar({
            caseId: job.id,
            date,
            fromDate: day.iso,
            assignedToId: forUserId ?? job.assignedToId ?? undefined,
          });
        }
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke flytte tiden.");
      }
    });
  }

  function remove() {
    const message = registered
      ? "Slet den registrerede tid?"
      : job.source === "case"
        ? "Fjern den planlagte tid fra kalenderen? Sagen slettes ikke."
        : "Slet den planlagte tid?";
    if (!window.confirm(message)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTimesheetActivity({
          activityId: job.source === "activity" ? job.id : undefined,
          caseId: job.source === "case" ? job.id : undefined,
          source: job.source === "activity" ? "activity" : "case",
          forUserId,
        });
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke slette aktiviteten.");
      }
    });
  }

  function openMap() {
    if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) {
      window.location.href = appleMapsUrl(place);
      return;
    }
    window.location.href = mapHref;
  }

  return (
    <div className="cal-job-menu-scrim" onClick={onClose}>
      <div className="cal-job-menu" onClick={(event) => event.stopPropagation()}>
        {error ? <p className="cal-job-menu-error">{error}</p> : null}
        {postpone ? (
          <div className="cal-job-menu-postpone">
            <label>
              <span>Ny dato</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <button type="button" disabled={pending} onClick={move}>
              Flyt
              <span aria-hidden>›</span>
            </button>
            <button type="button" onClick={() => setPostpone(false)}>
              Tilbage
              <span aria-hidden>›</span>
            </button>
          </div>
        ) : (
          <ul>
            {!registered ? (
              <li>
                <button type="button" disabled={pending} onClick={register}>
                  Registrer
                  <span aria-hidden>›</span>
                </button>
              </li>
            ) : null}
            {!registered ? (
              <li>
                <button type="button" disabled={pending} onClick={() => setPostpone(true)}>
                  Udskyd
                  <span aria-hidden>›</span>
                </button>
              </li>
            ) : null}
            <li>
              <button type="button" onClick={onEdit}>
                Rediger
                <span aria-hidden>›</span>
              </button>
            </li>
            {caseId && !absence ? (
              <li>
                <button type="button" onClick={() => router.push(`/sager/${caseId}`)}>
                  Arbejdsseddel
                  <span aria-hidden>›</span>
                </button>
              </li>
            ) : null}
            {mapHref && !absence ? (
              <li>
                <button type="button" onClick={openMap}>
                  Vis på kort
                  <span aria-hidden>›</span>
                </button>
              </li>
            ) : null}
            <li>
              <button type="button" disabled={pending} onClick={remove}>
                Slet
                <span aria-hidden>›</span>
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
