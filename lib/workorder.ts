import { isAbsenceKind } from "@/lib/catalog";
import { billedHours, startOfDay } from "@/lib/dates";
import { STATE_LABELS, type CaseState } from "@/lib/fsm";
import { isPlannedCoveredByRegistered, registeredCaseDays } from "@/lib/calendar-query";
import { parseKrToOre } from "@/lib/money";

export const WORK_ORDER_STAGES = [
  { id: "ordre", label: "Ordre", states: ["NY", "BESIGTIGELSE", "PLANLAGT"] as const },
  { id: "igang", label: "Igang", states: ["I_GANG", "KLS"] as const },
  { id: "faktura", label: "Faktura", states: ["KLAR_TIL_FAKTURA", "FAKTURERET", "AFSLUTTET"] as const },
] as const;

export type WorkOrderStageId = (typeof WORK_ORDER_STAGES)[number]["id"];

export function workOrderStage(state: string): WorkOrderStageId | "annulleret" {
  if (state === "ANNULLERET") return "annulleret";
  for (const stage of WORK_ORDER_STAGES) {
    if ((stage.states as readonly string[]).includes(state)) return stage.id;
  }
  return "ordre";
}

export function workOrderStageIndex(state: string): number {
  const id = workOrderStage(state);
  if (id === "annulleret") return -1;
  return WORK_ORDER_STAGES.findIndex((stage) => stage.id === id);
}

export function workOrderStageTone(stageIndex: number, currentIndex: number): "done" | "current" | "todo" {
  if (currentIndex < 0) return "todo";
  if (stageIndex < currentIndex) return "done";
  if (stageIndex === currentIndex) return "current";
  return "todo";
}

export const WORK_ORDER_SHORTCUTS = [
  { href: "#kunde", label: "Kunde" },
  { href: "#ordrebeskrivelse", label: "Ordrebeskrivelse" },
  { href: "#anlaeg", label: "Anlæg" },
  { href: "#opfoelgning", label: "Opfølgning" },
  { href: "#noter", label: "Noter" },
  { href: "#pris", label: "Pris og tidsfrister" },
  { href: "#forbrug", label: "Forbrugsoverblik" },
  { href: "#medarbejdere", label: "Medarbejdere" },
  { href: "#kvalitetssikring", label: "Kvalitetssikring" },
  { href: "#dokumentation", label: "Dokumentation" },
  { href: "#grossist", label: "Grossistindkøb" },
  { href: "#materialer", label: "Registrering af materialer" },
  { href: "#timesedler", label: "Registrering fra timesedler" },
  { href: "#planlagte-timer", label: "Planlagte timer" },
  { href: "#laaste", label: "Låste materialer og timer" },
  { href: "#fakturaer", label: "Fakturaer" },
  { href: "#kalkulation", label: "Kalkulation" },
  { href: "#haendelser", label: "Hændelsesforløb" },
] as const;

export function workOrderShortcuts(hasPlannedHours: boolean) {
  if (hasPlannedHours) return [...WORK_ORDER_SHORTCUTS];
  return WORK_ORDER_SHORTCUTS.filter((item) => item.href !== "#planlagte-timer");
}

export type WorkOrderIgangAction = {
  label: string;
  toState: "PLANLAGT" | "KLAR_TIL_FAKTURA" | "AFSLUTTET";
  note: string;
};

/** Minuba Igang menu: Udsæt, Færdigmeld, Afslut. */
export function workOrderIgangActions(state: string, allowed: string[]): WorkOrderIgangAction[] {
  const actions: WorkOrderIgangAction[] = [];
  if (state === "I_GANG" || state === "KLS") {
    actions.push({ label: "Udsæt", toState: "PLANLAGT", note: "Arbejdet er udsat." });
  }
  if (allowed.includes("KLAR_TIL_FAKTURA")) {
    actions.push({ label: "Færdigmeld", toState: "KLAR_TIL_FAKTURA", note: "Arbejdet er færdigmeldt." });
  }
  if (allowed.includes("AFSLUTTET")) {
    actions.push({ label: "Afslut", toState: "AFSLUTTET", note: "Sagen er afsluttet." });
  }
  return actions;
}

export type PlannedSlotSource = {
  id: string;
  userId: string;
  userName: string;
  start: Date;
  end: Date;
  status: string;
  kind: string;
  allDay?: boolean;
  caseId: string | null;
};

export type PlannedSlot = {
  id: string;
  userId: string;
  userName: string;
  start: Date;
  end: Date;
  hours: number;
  allDay: boolean;
};

/** Upcoming booked days for a case. Past and registered slots stay hidden. */
export function futurePlannedSlots(input: {
  now?: Date;
  caseId: string;
  assignedTo?: { id: string; name: string } | null;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
  activities: PlannedSlotSource[];
}): PlannedSlot[] {
  const now = input.now ?? new Date();
  const registered = registeredCaseDays(input.activities);
  const slots: PlannedSlot[] = [];
  const seen = new Set<string>();

  const push = (slot: PlannedSlot) => {
    const key = `${slot.userId}:${startOfDay(slot.start).getTime()}`;
    if (seen.has(key)) return;
    seen.add(key);
    slots.push(slot);
  };

  for (const activity of input.activities) {
    if (activity.status !== "PLANLAGT") continue;
    if (isAbsenceKind(activity.kind)) continue;
    if (activity.end <= now) continue;
    if (isPlannedCoveredByRegistered(input.caseId, activity.start, registered)) continue;
    push({
      id: activity.id,
      userId: activity.userId,
      userName: activity.userName,
      start: activity.start,
      end: activity.end,
      hours: billedHours(activity.start, activity.end, Boolean(activity.allDay)),
      allDay: Boolean(activity.allDay),
    });
  }

  if (
    input.assignedTo &&
    input.scheduledStart &&
    input.scheduledEnd &&
    input.scheduledEnd > now &&
    !isPlannedCoveredByRegistered(input.caseId, input.scheduledStart, registered)
  ) {
    push({
      id: `case:${input.caseId}`,
      userId: input.assignedTo.id,
      userName: input.assignedTo.name,
      start: input.scheduledStart,
      end: input.scheduledEnd,
      hours: billedHours(input.scheduledStart, input.scheduledEnd),
      allDay: false,
    });
  }

  return slots.sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.userName.localeCompare(b.userName, "da"),
  );
}

export function workOrderHours(entries: { hours: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.hours, 0);
}

export function workOrderMarkup(cost: number, sale: number): number | null {
  if (cost <= 0) return null;
  return (sale - cost) / cost;
}

export function parseMarkupInput(input: string): number {
  const normalized = input.replace("%", "").replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) throw new Error("Avancen skal være et tal.");
  return value / 100;
}

export function saleFromMarkup(costOre: number, markupRatio: number): number {
  if (costOre <= 0) throw new Error("Kan ikke sætte avance uden indkøbspris.");
  return Math.round(costOre * (1 + markupRatio));
}

export function markupInputValue(ratio: number | null): string {
  if (ratio === null) return "";
  const pct = Math.round(ratio * 1000) / 10;
  return String(pct).replace(".", ",");
}

export function materialPricePatch(
  current: { costPrice: number; unitPrice: number },
  input: { costPrice?: string; markup?: string; unitPrice?: string },
): { costPrice: number; unitPrice: number } {
  if (input.costPrice != null && input.costPrice.trim() !== "") {
    return { costPrice: parseKrToOre(input.costPrice), unitPrice: current.unitPrice };
  }
  if (input.markup) {
    return {
      costPrice: current.costPrice,
      unitPrice: saleFromMarkup(current.costPrice, parseMarkupInput(input.markup)),
    };
  }
  if (input.unitPrice != null && input.unitPrice.trim() !== "") {
    return { costPrice: current.costPrice, unitPrice: parseKrToOre(input.unitPrice) };
  }
  throw new Error("Angiv indkøb, avance eller salgspris.");
}

export function workOrderNoteTitle(note: string): { title: string; body: string } {
  const [first, ...rest] = note.split("\n");
  return { title: first || "Note", body: rest.join("\n").trim() };
}

export function workOrderStateLabel(state: string): string {
  return STATE_LABELS[state as CaseState] ?? state;
}
