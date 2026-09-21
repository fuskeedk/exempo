export const CASE_STATES = [
  "NY",
  "BESIGTIGELSE",
  "PLANLAGT",
  "I_GANG",
  "KLS",
  "KLAR_TIL_FAKTURA",
  "FAKTURERET",
  "AFSLUTTET",
  "ANNULLERET",
] as const;

export type CaseState = (typeof CASE_STATES)[number];

export const STATE_LABELS: Record<CaseState, string> = {
  NY: "Ny sag",
  BESIGTIGELSE: "Besigtigelse",
  PLANLAGT: "Planlagt",
  I_GANG: "I gang",
  KLS: "KLS",
  KLAR_TIL_FAKTURA: "Klar til faktura",
  FAKTURERET: "Faktureret",
  AFSLUTTET: "Afsluttet",
  ANNULLERET: "Annulleret",
};

export const STATE_HELP: Record<CaseState, string> = {
  NY: "Sagen er oprettet og venter på besigtigelse eller planlægning.",
  BESIGTIGELSE: "Skaden vurderes på stedet, inden arbejdet planlægges.",
  PLANLAGT: "Sagen ligger i en medarbejders kalender.",
  I_GANG: "Arbejdet er i gang ude hos kunden.",
  KLS: "Kvalitetsledelse og dokumentation udfyldes, hvis I har tilføjet KLS.",
  KLAR_TIL_FAKTURA: "Arbejdet er færdigt. Sagen kan faktureres.",
  FAKTURERET: "Faktura er dannet og sendt.",
  AFSLUTTET: "Sagen er lukket.",
  ANNULLERET: "Sagen er stoppet.",
};

export const ACTIVE_PIPELINE: CaseState[] = [
  "NY",
  "BESIGTIGELSE",
  "PLANLAGT",
  "I_GANG",
  "KLS",
  "KLAR_TIL_FAKTURA",
  "FAKTURERET",
];

const TRANSITIONS: Record<CaseState, CaseState[]> = {
  NY: ["BESIGTIGELSE", "PLANLAGT", "ANNULLERET", "KLAR_TIL_FAKTURA", "AFSLUTTET"],
  BESIGTIGELSE: ["PLANLAGT", "NY", "ANNULLERET", "KLAR_TIL_FAKTURA", "AFSLUTTET"],
  PLANLAGT: ["I_GANG", "BESIGTIGELSE", "ANNULLERET", "KLAR_TIL_FAKTURA"],
  I_GANG: ["KLAR_TIL_FAKTURA", "KLS", "PLANLAGT", "ANNULLERET", "FAKTURERET", "AFSLUTTET"],
  KLS: ["KLAR_TIL_FAKTURA", "I_GANG", "PLANLAGT", "ANNULLERET", "FAKTURERET", "AFSLUTTET"],
  KLAR_TIL_FAKTURA: ["FAKTURERET", "KLS", "ANNULLERET", "I_GANG", "AFSLUTTET"],
  FAKTURERET: ["AFSLUTTET", "I_GANG"],
  AFSLUTTET: ["I_GANG"],
  ANNULLERET: ["NY"],
};

export const TIME_LOCKED_STATES: CaseState[] = ["KLAR_TIL_FAKTURA", "FAKTURERET", "AFSLUTTET"];

export const TIME_LOCKED_MESSAGE =
  "Sagen er færdigmeldt. Den skal genåbnes, før der kan registreres tid.";

export function isTimeLocked(state: string): boolean {
  return (TIME_LOCKED_STATES as readonly string[]).includes(state);
}

export type TransitionContext = {
  hasInvoice?: boolean;
  isScheduled?: boolean;
  allowCloseWithoutInvoice?: boolean;
};

export function isCaseState(value: string): value is CaseState {
  return (CASE_STATES as readonly string[]).includes(value);
}

export function allowedTransitions(from: CaseState): CaseState[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(
  from: string,
  to: string,
  ctx: TransitionContext = {},
): { ok: true } | { ok: false; reason: string } {
  if (!isCaseState(from) || !isCaseState(to)) {
    return { ok: false, reason: "Ukendt sagsstatus." };
  }
  if (from === to) {
    return { ok: false, reason: "Sagen er allerede i den status." };
  }
  if (!allowedTransitions(from).includes(to)) {
    return {
      ok: false,
      reason: `Kan ikke gå fra ${STATE_LABELS[from]} til ${STATE_LABELS[to]}.`,
    };
  }
  if (to === "PLANLAGT" && ctx.isScheduled === false && from !== "I_GANG" && from !== "KLS") {
    return {
      ok: false,
      reason: "Sagen skal ligge i en medarbejders kalender, før den kan planlægges.",
    };
  }
  if (to === "FAKTURERET" && ctx.hasInvoice === false) {
    return {
      ok: false,
      reason: "Der skal oprettes en faktura, før status kan sættes til faktureret.",
    };
  }
  if (to === "AFSLUTTET" && ctx.hasInvoice === false && !ctx.allowCloseWithoutInvoice) {
    return { ok: false, reason: "Sagen kan først afsluttes, når der er en faktura." };
  }
  return { ok: true };
}

export const STATE_TONE: Record<CaseState, string> = {
  NY: "stone",
  BESIGTIGELSE: "sky",
  PLANLAGT: "indigo",
  I_GANG: "amber",
  KLS: "violet",
  KLAR_TIL_FAKTURA: "teal",
  FAKTURERET: "green",
  AFSLUTTET: "olive",
  ANNULLERET: "rose",
};
