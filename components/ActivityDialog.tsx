"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteTimesheetActivity, saveTimesheetActivity, searchActivityCases } from "@/app/actions/field";
import { ABSENCE_TYPES, ABSENCE_TYPE_LABELS, type AbsenceType } from "@/lib/catalog";
import {
  billedHours,
  formatHoursDa,
  FULL_DAY_PAUSE_HOURS,
  fullDaySlot,
  looksLikeFullDay,
  parseDayParam,
} from "@/lib/dates";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = [0, 15, 30, 45];

export type ActivityDraft = {
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  caseId: string;
  activityId?: string;
  source?: "case" | "activity";
  kind?: "ARBEJDE" | "FRAVAER";
  absenceType?: AbsenceType;
  note?: string;
  status?: "PLANLAGT" | "REGISTRERET";
};

export type ActivityCaseOption = {
  id: string;
  caseNumber: string;
  title: string;
  customerName?: string;
  customerAddress?: string;
  customerCity?: string;
  claimNumber?: string;
};

export function ActivityDialog({
  draft,
  cases,
  forUserId,
  onClose,
}: {
  draft: ActivityDraft;
  cases: ActivityCaseOption[];
  forUserId?: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(draft.date);
  const initialAllDay =
    Boolean(draft.caseId) &&
    looksLikeFullDay(draft.startHour, draft.startMinute, draft.endHour, draft.endMinute);
  const [allDay, setAllDay] = useState(initialAllDay);
  const initialSlot = fullDaySlot(parseDayParam(draft.date));
  const [startHour, setStartHour] = useState(initialAllDay ? initialSlot.start.getHours() : draft.startHour);
  const [startMinute, setStartMinute] = useState(
    initialAllDay ? initialSlot.start.getMinutes() : draft.startMinute,
  );
  const [endHour, setEndHour] = useState(initialAllDay ? initialSlot.end.getHours() : draft.endHour);
  const [endMinute, setEndMinute] = useState(initialAllDay ? initialSlot.end.getMinutes() : draft.endMinute);
  const [kind, setKind] = useState<"ARBEJDE" | "FRAVAER">(draft.kind ?? "ARBEJDE");
  const [absenceType, setAbsenceType] = useState<AbsenceType>(draft.absenceType ?? "FERIE");
  const [caseId, setCaseId] = useState(draft.caseId);
  const [note, setNote] = useState(draft.note ?? "");
  const isPlanned = draft.status === "PLANLAGT" && Boolean(draft.activityId || draft.source === "case");
  const plannedHours = billedHours(
    new Date(parseDayParam(draft.date).setHours(draft.startHour, draft.startMinute, 0, 0)),
    new Date(parseDayParam(draft.date).setHours(draft.endHour, draft.endMinute, 0, 0)),
  );
  const [usePlannedDuration, setUsePlannedDuration] = useState(isPlanned);
  const canDelete = Boolean(draft.activityId || (draft.source === "case" && draft.caseId));
  const timesLocked = allDay || (isPlanned && usePlannedDuration);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!caseId.trim()) return;
    if (looksLikeFullDay(startHour, startMinute, endHour, endMinute)) {
      applyFullDay(date);
    }
    // Only when a sag is chosen — a full-day range becomes billed Hel dag with pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function applyFullDay(nextDate: string) {
    const slot = fullDaySlot(parseDayParam(nextDate));
    setAllDay(true);
    setStartHour(slot.start.getHours());
    setStartMinute(slot.start.getMinutes());
    setEndHour(slot.end.getHours());
    setEndMinute(slot.end.getMinutes());
  }

  function submit(intent: "plan" | "register") {
    setError(null);
    const usePlanned = intent === "register" && isPlanned && usePlannedDuration;
    startTransition(async () => {
      try {
        await saveTimesheetActivity({
          intent,
          kind,
          date,
          startHour: usePlanned ? draft.startHour : startHour,
          startMinute: usePlanned ? draft.startMinute : startMinute,
          endHour: usePlanned ? draft.endHour : endHour,
          endMinute: usePlanned ? draft.endMinute : endMinute,
          allDay: usePlanned
            ? looksLikeFullDay(draft.startHour, draft.startMinute, draft.endHour, draft.endMinute)
            : allDay,
          caseId: kind === "FRAVAER" ? "" : caseId.trim(),
          fromCaseId: draft.caseId || undefined,
          note,
          forUserId,
          absenceType,
          activityId: draft.activityId,
          source: draft.source,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke gemme aktiviteten.");
      }
    });
  }

  function remove() {
    if (!canDelete) return;
    const message =
      draft.status === "REGISTRERET"
        ? "Slet den registrerede tid?"
        : draft.source === "case"
          ? "Fjern den planlagte tid fra kalenderen? Sagen slettes ikke."
          : "Slet den planlagte tid?";
    if (!window.confirm(message)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTimesheetActivity({
          activityId: draft.activityId,
          caseId: draft.source === "case" ? draft.caseId : undefined,
          source: draft.source,
          forUserId,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke slette aktiviteten.");
      }
    });
  }

  function toggleAllDay(next: boolean) {
    if (next) {
      applyFullDay(date);
      return;
    }
    setAllDay(false);
  }

  return (
    <div className="act-dialog-scrim" onClick={onClose}>
      <div className="act-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="act-dialog-head">
          <h2 className="font-serif text-xl tracking-tight">Aktivitet</h2>
        </div>
        <div className="act-dialog-body">
          {error ? <p className="rounded-md bg-[#f3d7d4] px-3 py-2 text-[#7c2f2a]">{error}</p> : null}
          <label className="act-dialog-row">
            <span>Dato</span>
            <div className="act-dialog-controls">
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  const next = event.target.value;
                  setDate(next);
                  if (allDay) applyFullDay(next);
                }}
                className="act-dialog-input"
              />
              <label className="act-dialog-check">
                <input type="checkbox" checked={allDay} onChange={(event) => toggleAllDay(event.target.checked)} />
                Hel dag
              </label>
            </div>
          </label>
          {allDay ? (
            <p className="act-dialog-hint">
              {formatHoursDa(billedHours(fullDaySlot(parseDayParam(date)).start, fullDaySlot(parseDayParam(date)).end, true))}{" "}
              time på sagen ({formatHoursDa(FULL_DAY_PAUSE_HOURS)} t pause).
            </p>
          ) : null}
          {isPlanned ? (
            <fieldset className="act-dialog-hint space-y-1.5">
              <legend className="sr-only">Registrering af planlagt tid</legend>
              <label className="act-dialog-check">
                <input
                  type="radio"
                  name="planned-duration"
                  checked={usePlannedDuration}
                  onChange={() => {
                    setUsePlannedDuration(true);
                    setStartHour(draft.startHour);
                    setStartMinute(draft.startMinute);
                    setEndHour(draft.endHour);
                    setEndMinute(draft.endMinute);
                    setAllDay(looksLikeFullDay(draft.startHour, draft.startMinute, draft.endHour, draft.endMinute));
                  }}
                />
                Brug planlagt tid ({formatHoursDa(plannedHours)} t)
              </label>
              <label className="act-dialog-check">
                <input
                  type="radio"
                  name="planned-duration"
                  checked={!usePlannedDuration}
                  onChange={() => setUsePlannedDuration(false)}
                />
                Vælg selv tid (kortere eller længere)
              </label>
            </fieldset>
          ) : null}
          <label className="act-dialog-row">
            <span>Start</span>
            <TimeSelect hour={startHour} minute={startMinute} disabled={timesLocked} onHour={setStartHour} onMinute={setStartMinute} />
          </label>
          <label className="act-dialog-row">
            <span>Slut</span>
            <TimeSelect hour={endHour} minute={endMinute} disabled={timesLocked} onHour={setEndHour} onMinute={setEndMinute} />
          </label>
          <fieldset className="act-dialog-row">
            <span>Reg. type</span>
            <div className="act-dialog-controls">
              <label className="act-dialog-check">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === "ARBEJDE"}
                  onChange={() => setKind("ARBEJDE")}
                />
                Arbejdstid
              </label>
              <label className="act-dialog-check">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === "FRAVAER"}
                  onChange={() => setKind("FRAVAER")}
                />
                Fravær
              </label>
            </div>
          </fieldset>
          {kind === "FRAVAER" ? (
            <label className="act-dialog-row">
              <span>Fraværstype</span>
              <select
                value={absenceType}
                onChange={(event) => setAbsenceType(event.target.value as AbsenceType)}
                className="act-dialog-input"
              >
                {ABSENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ABSENCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="act-dialog-row">
              <span>Tilbud og ordrer</span>
              <CaseSearch cases={cases} value={caseId} onChange={setCaseId} />
            </div>
          )}
          <label className="act-dialog-row act-dialog-row--stack">
            <span>Note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 1500))}
              rows={5}
              className="act-dialog-input"
            />
            <p className="act-dialog-count">{note.length} / 1500</p>
          </label>
          <div className="act-dialog-actions">
            {canDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={remove}
                className="act-dialog-btn act-dialog-btn--danger"
              >
                Slet
              </button>
            ) : (
              <span />
            )}
            <div className="act-dialog-actions-main">
              <button
                type="button"
                disabled={pending}
                onClick={() => submit("plan")}
                className="act-dialog-btn act-dialog-btn--primary"
              >
                Planlæg tid
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => submit("register")}
                className="act-dialog-btn act-dialog-btn--primary"
              >
                Registrer tid
              </button>
              <button
                type="button"
                onClick={onClose}
                className="act-dialog-btn"
              >
                Annullér
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function caseHaystack(sag: ActivityCaseOption) {
  return `${sag.caseNumber} ${sag.title} ${sag.customerName ?? ""} ${sag.customerAddress ?? ""} ${sag.customerCity ?? ""} ${sag.claimNumber ?? ""}`.toLowerCase();
}

function caseLabel(sag: ActivityCaseOption) {
  return `${sag.caseNumber} · ${sag.title}`;
}

const NONE_LABEL = "Ikke ordrerelateret";

function CaseSearch({
  cases,
  value,
  disabled,
  onChange,
}: {
  cases: ActivityCaseOption[];
  value: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<ActivityCaseOption[]>([]);
  const [, startSearch] = useTransition();
  const catalog = useMemo(() => {
    const map = new Map<string, ActivityCaseOption>();
    for (const sag of [...cases, ...remote]) map.set(sag.id, sag);
    return [...map.values()];
  }, [cases, remote]);
  const selected = catalog.find((sag) => sag.id === value) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalog.slice(0, 40);
    return catalog.filter((sag) => caseHaystack(sag).includes(needle)).slice(0, 40);
  }, [catalog, query]);

  useEffect(() => {
    if (!open) return;
    const needle = query.trim();
    const timer = window.setTimeout(() => {
      startSearch(async () => {
        const rows = await searchActivityCases(needle);
        setRemote(rows);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeList();
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, filtered.length]);

  const shownValue = open ? query : selected ? caseLabel(selected) : NONE_LABEL;

  function closeList() {
    setOpen(false);
    setQuery("");
  }

  function pick(id: string) {
    onChange(id);
    const sag = catalog.find((item) => item.id === id);
    setQuery(sag ? caseLabel(sag) : "");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeList();
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(filtered.length, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active === 0) pick("");
      else if (filtered[active - 1]) pick(filtered[active - 1].id);
    }
  }

  return (
    <div className="act-search" ref={rootRef}>
      <input
        type="search"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder="Søg sag, eller lad stå som ikke ordrerelateret"
        aria-label="Søg sag"
        aria-expanded={open}
        aria-controls="act-case-list"
        className={!open && !selected ? "is-none" : undefined}
        value={shownValue}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled ? (
        <ul id="act-case-list" role="listbox" className="act-search-list">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`act-search-item ${active === 0 ? "is-active" : ""}`}
              onMouseEnter={() => setActive(0)}
              onClick={() => pick("")}
            >
              Ikke ordrerelateret
              <small>Vælges automatisk, hvis du ikke vælger en sag</small>
            </button>
          </li>
          {filtered.map((sag, index) => (
            <li key={sag.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === sag.id}
                className={`act-search-item ${active === index + 1 ? "is-active" : ""}`}
                onMouseEnter={() => setActive(index + 1)}
                onClick={() => pick(sag.id)}
              >
                {caseLabel(sag)}
                {sag.customerName || sag.customerAddress ? (
                  <small>
                    {[sag.customerName, sag.customerAddress, sag.customerCity].filter(Boolean).join(" · ")}
                  </small>
                ) : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="act-search-empty">Ingen sager matcher</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function TimeSelect({
  hour,
  minute,
  disabled,
  onHour,
  onMinute,
}: {
  hour: number;
  minute: number;
  disabled?: boolean;
  onHour: (value: number) => void;
  onMinute: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-1">
      <select
        value={hour}
        disabled={disabled}
        onChange={(event) => onHour(Number(event.target.value))}
        className="act-dialog-input"
      >
        {HOURS.map((item) => (
          <option key={item} value={item}>
            {String(item).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        value={minute}
        disabled={disabled}
        onChange={(event) => onMinute(Number(event.target.value))}
        className="act-dialog-input"
      >
        {MINUTES.map((item) => (
          <option key={item} value={item}>
            {String(item).padStart(2, "0")}
          </option>
        ))}
      </select>
    </span>
  );
}
