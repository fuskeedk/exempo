import { STATE_TONE, STATE_LABELS, isCaseState, type CaseState } from "@/lib/fsm";

const invoiceTone: Record<string, string> = {
  KLADDE: "tone-stone",
  SENDT: "tone-sky",
  BETALT: "tone-green",
  RYKKET: "tone-amber",
  INKASSO: "tone-rose",
};

export function StatusBadge({ state }: { state: string }) {
  const tone = isCaseState(state) ? STATE_TONE[state] : "stone";
  const label = isCaseState(state) ? STATE_LABELS[state] : state;
  return (
    <span className={`tone-${tone} inline-flex rounded-full px-2.5 py-1 text-xs font-semibold`}>
      {label}
    </span>
  );
}

export function InvoiceBadge({ status, kind }: { status: string; kind?: string }) {
  const statusLabel =
    status === "KLADDE"
      ? "Kladde"
      : status === "SENDT"
        ? "Sendt"
        : status === "BETALT"
          ? "Betalt"
          : status === "RYKKET"
            ? "Rykket"
            : status === "INKASSO"
              ? "Inkasso"
              : status;
  const label =
    kind === "KREDITNOTA"
      ? `Kreditnota · ${statusLabel}`
      : kind === "ACONTO"
        ? `Aconto · ${statusLabel}`
        : statusLabel;
  return (
    <span className={`${invoiceTone[status] ?? "tone-stone"} inline-flex rounded-full px-2.5 py-1 text-xs font-semibold`}>
      {label}
    </span>
  );
}

export function CoverageBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-sm text-muted">—</span>;
  }
  const pct = Math.round(value * 1000) / 10;
  const tone = pct >= 45 ? "tone-green" : pct >= 30 ? "tone-amber" : "tone-rose";
  return (
    <span className={`${tone} inline-flex rounded-full px-2.5 py-1 text-xs font-semibold`}>
      {String(pct).replace(".", ",")} %
    </span>
  );
}

export function PurchaseBadge({ status }: { status: string }) {
  const tone =
    status === "GODKENDT"
      ? "tone-green"
      : status === "AFVENTER"
        ? "tone-amber"
        : status === "DELVIST"
          ? "tone-indigo"
          : status === "AFVIST"
            ? "tone-rose"
            : status === "DRIFT"
              ? "tone-sky"
              : "tone-stone";
  const label =
    status === "MODTAGET"
      ? "Ny"
      : status === "DELVIST"
        ? "Delvist"
        : status === "AFVENTER"
          ? "Afventer"
          : status === "GODKENDT"
            ? "Godkendt"
            : status === "DRIFT"
              ? "Drift"
              : status === "AFVIST"
                ? "Afvist"
                : status;
  return (
    <span className={`${tone} inline-flex rounded-full px-2.5 py-1 text-xs font-semibold`}>
      {label}
    </span>
  );
}

export function PipelineDots({ state }: { state: CaseState }) {
  const steps: CaseState[] = [
    "NY",
    "BESIGTIGELSE",
    "PLANLAGT",
    "I_GANG",
    "KLS",
    "KLAR_TIL_FAKTURA",
    "FAKTURERET",
    "AFSLUTTET",
  ];
  const current = steps.indexOf(state);
  return (
    <div className="flex flex-wrap gap-1">
      {steps.map((step, index) => (
        <span
          key={step}
          title={STATE_LABELS[step]}
          className={`h-1.5 w-6 rounded-full ${
            state === "ANNULLERET"
              ? "bg-rose-300"
              : index <= current
                ? "bg-pine-2"
                : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}
