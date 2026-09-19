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
  KLS: "Kvalitetsledelse og dokumentation udfyldes.",
  KLAR_TIL_FAKTURA: "KLS er godkendt. Sagen kan faktureres.",
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
  NY: ["BESIGTIGELSE", "PLANLAGT", "ANNULLERET"],
  BESIGTIGELSE: ["PLANLAGT", "NY", "ANNULLERET"],
  PLANLAGT: ["I_GANG", "BESIGTIGELSE", "ANNULLERET"],
  I_GANG: ["KLS", "PLANLAGT", "ANNULLERET"],
  KLS: ["KLAR_TIL_FAKTURA", "I_GANG", "ANNULLERET"],
  KLAR_TIL_FAKTURA: ["FAKTURERET", "KLS", "ANNULLERET"],
  FAKTURERET: ["AFSLUTTET"],
  AFSLUTTET: [],
  ANNULLERET: ["NY"],
};

export type TransitionContext = {
  hasSignedKls?: boolean;
  hasInvoice?: boolean;
  isScheduled?: boolean;
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
  if (to === "PLANLAGT" && ctx.isScheduled === false) {
    return {
      ok: false,
      reason: "Sagen skal ligge i en medarbejders kalender, før den kan planlægges.",
    };
  }
  if (to === "KLAR_TIL_FAKTURA" && ctx.hasSignedKls === false) {
    return {
      ok: false,
      reason: "KLS skal være underskrevet, før sagen er klar til faktura.",
    };
  }
  if (to === "FAKTURERET" && ctx.hasInvoice === false) {
    return {
      ok: false,
      reason: "Der skal oprettes en faktura, før status kan sættes til faktureret.",
    };
  }
  if (to === "AFSLUTTET" && ctx.hasInvoice === false) {
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
