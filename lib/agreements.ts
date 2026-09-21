export type ApprenticeStep = {
  step: number;
  label: string;
  wageOre: number;
};

export type AgreementRates = {
  code: string;
  name: string;
  unionName: string;
  notes: string;
  pensionEmployerBps: number;
  pensionEmployeeBps: number;
  holidayPayBps: number;
  shBps: number;
  fritvalgBps: number;
  overtimeFirstHours: number;
  overtimeFirstPct: number;
  overtimeRestPct: number;
  overtimeFirstAddonOre: number;
  overtimeRestAddonOre: number;
  weekHours: number;
  sickPayPct: number;
  childSickPayPct: number;
  apprentices: ApprenticeStep[];
};

/** Udgangspunkt pr. 1. marts 2026. Redigeres pr. virksomhed — tjek altid gældende overenskomst. */
export const AGREEMENT_TEMPLATES: AgreementRates[] = [
  {
    code: "NONE",
    name: "Ingen overenskomst",
    unionName: "",
    notes: "Kun ferielovens 12,5 %. Overtid som 50/100 % af den indtastede timeløn. Sygeløn 100 % af timeløn — sæt ned, hvis I betaler mindre under sygdom.",
    pensionEmployerBps: 0,
    pensionEmployeeBps: 0,
    holidayPayBps: 1250,
    shBps: 0,
    fritvalgBps: 0,
    overtimeFirstHours: 3,
    overtimeFirstPct: 50,
    overtimeRestPct: 100,
    overtimeFirstAddonOre: 0,
    overtimeRestAddonOre: 0,
    weekHours: 37,
    sickPayPct: 100,
    childSickPayPct: 100,
    apprentices: [],
  },
  {
    code: "BA",
    name: "Bygge- og anlægsoverenskomsten",
    unionName: "3F / Dansk Byggeri",
    notes: "Satser pr. 1. marts 2026. Pension 11+2 %. SH/feriefridage 15,7 %. Overtidstillæg 74,95 / 149,90 kr. Sygeløn 100 % af timeløn (sæt ned, hvis overenskomsten giver lavere). Lærlingeløn 1.–4. år.",
    pensionEmployerBps: 1100,
    pensionEmployeeBps: 200,
    holidayPayBps: 1250,
    shBps: 1570,
    fritvalgBps: 0,
    overtimeFirstHours: 3,
    overtimeFirstPct: 50,
    overtimeRestPct: 100,
    overtimeFirstAddonOre: 7495,
    overtimeRestAddonOre: 14990,
    weekHours: 37,
    sickPayPct: 100,
    childSickPayPct: 100,
    apprentices: [
      { step: 1, label: "1. år", wageOre: 8580 },
      { step: 2, label: "2. år", wageOre: 10145 },
      { step: 3, label: "3. år", wageOre: 12245 },
      { step: 4, label: "4. år", wageOre: 14190 },
    ],
  },
  {
    code: "EL",
    name: "Elektrikeroverenskomsten",
    unionName: "Dansk El-Forbund / TEKNIQ",
    notes: "Satser pr. 1. marts 2026. Pension 11+2 %. Fritvalg 10 %. Overtidstillæg 103,15 / 154,45 kr. Sygeløn 100 % af timeløn (ret til gældende El-overenskomst). El-montørlærlinge lønperiode 1–5.",
    pensionEmployerBps: 1100,
    pensionEmployeeBps: 200,
    holidayPayBps: 1250,
    shBps: 0,
    fritvalgBps: 1000,
    overtimeFirstHours: 2,
    overtimeFirstPct: 50,
    overtimeRestPct: 100,
    overtimeFirstAddonOre: 10315,
    overtimeRestAddonOre: 15445,
    weekHours: 37,
    sickPayPct: 100,
    childSickPayPct: 100,
    apprentices: [
      { step: 1, label: "0–1 år", wageOre: 7845 },
      { step: 2, label: "1–2 år", wageOre: 8965 },
      { step: 3, label: "2–3 år", wageOre: 10645 },
      { step: 4, label: "3–4 år", wageOre: 12720 },
      { step: 5, label: "4–5 år", wageOre: 14725 },
    ],
  },
  {
    code: "METAL",
    name: "Industriens Overenskomst",
    unionName: "Dansk Metal / CO-industri",
    notes: "Satser pr. 1. marts 2026. Pension 11+2 %. Fritvalgskonto 10 %. Overtid 50/100 % af timeløn. Sygeløn 100 % af timeløn (ret til lokal aftale). Lærlingetrin er vejledende.",
    pensionEmployerBps: 1100,
    pensionEmployeeBps: 200,
    holidayPayBps: 1250,
    shBps: 0,
    fritvalgBps: 1000,
    overtimeFirstHours: 3,
    overtimeFirstPct: 50,
    overtimeRestPct: 100,
    overtimeFirstAddonOre: 0,
    overtimeRestAddonOre: 0,
    weekHours: 37,
    sickPayPct: 100,
    childSickPayPct: 100,
    apprentices: [
      { step: 1, label: "1. år", wageOre: 8200 },
      { step: 2, label: "2. år", wageOre: 9800 },
      { step: 3, label: "3. år", wageOre: 11800 },
      { step: 4, label: "4. år", wageOre: 13800 },
    ],
  },
  {
    code: "VVS",
    name: "Blik- og røroverenskomsten",
    unionName: "Blik- og Rørarbejderforbundet / TEKNIQ",
    notes: "Udgangspunkt pr. marts 2026 (pension 13 %, fritvalg 10 %). Sygeløn 100 % af timeløn. Ret lærlingesatser, sygeløn og overtidsstillæg til jeres gældende VVS-overenskomst.",
    pensionEmployerBps: 1100,
    pensionEmployeeBps: 200,
    holidayPayBps: 1250,
    shBps: 0,
    fritvalgBps: 1000,
    overtimeFirstHours: 2,
    overtimeFirstPct: 50,
    overtimeRestPct: 100,
    overtimeFirstAddonOre: 0,
    overtimeRestAddonOre: 0,
    weekHours: 37,
    sickPayPct: 100,
    childSickPayPct: 100,
    apprentices: [
      { step: 1, label: "1. år", wageOre: 8000 },
      { step: 2, label: "2. år", wageOre: 9500 },
      { step: 3, label: "3. år", wageOre: 11200 },
      { step: 4, label: "4. år", wageOre: 13200 },
    ],
  },
];

export function templateByCode(code: string): AgreementRates {
  return AGREEMENT_TEMPLATES.find((row) => row.code === code) ?? AGREEMENT_TEMPLATES[0];
}

export function parseApprenticeJson(raw: string): ApprenticeStep[] {
  try {
    const parsed = JSON.parse(raw) as ApprenticeStep[];
    return Array.isArray(parsed) ? parsed.filter((row) => row && row.step > 0) : [];
  } catch {
    return [];
  }
}

export function apprenticeStepFromStart(start: Date, at: Date, maxStep: number) {
  if (maxStep < 1) return 0;
  const years = (at.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.min(maxStep, Math.max(1, Math.floor(years) + 1));
}

export function resolveWageOre(input: {
  wageRate: number;
  hourlyRate: number;
  apprenticeStep: number;
  apprentices: ApprenticeStep[];
}) {
  if (input.wageRate > 0) return input.wageRate;
  const step = input.apprentices.find((row) => row.step === input.apprenticeStep);
  if (step) return step.wageOre;
  return input.hourlyRate;
}

export type DayHours = { date: Date; hours: number };

export function splitOvertime(
  days: DayHours[],
  expectedHours: (date: Date) => number,
  firstOvertimeHours: number,
) {
  let normalHours = 0;
  let overtime50Hours = 0;
  let overtime100Hours = 0;
  for (const day of days) {
    const expected = expectedHours(day.date);
    const hours = Math.max(0, day.hours);
    if (expected <= 0) {
      overtime100Hours += hours;
      continue;
    }
    const normal = Math.min(hours, expected);
    const overtime = Math.max(0, hours - expected);
    const first = Math.min(overtime, Math.max(0, firstOvertimeHours));
    normalHours += normal;
    overtime50Hours += first;
    overtime100Hours += Math.max(0, overtime - first);
  }
  return { normalHours, overtime50Hours, overtime100Hours };
}

function pct(ore: number, bps: number) {
  return Math.round((ore * bps) / 10_000);
}

export function overtimePayOre(
  hours: number,
  wageOre: number,
  pctPoints: number,
  addonOre: number,
) {
  if (hours <= 0) return 0;
  if (addonOre > 0) return Math.round(hours * (wageOre + addonOre));
  return Math.round(hours * wageOre * (100 + pctPoints) / 100);
}

export function sickPayOre(hours: number, wageOre: number, pctOfWage: number) {
  if (hours <= 0 || pctOfWage <= 0 || wageOre <= 0) return 0;
  return Math.round((hours * wageOre * pctOfWage) / 100);
}

export function splitPaidAbsence(absences: { type: string; hours: number }[]) {
  let sickHours = 0;
  let childSickHours = 0;
  let unpaidHours = 0;
  for (const row of absences) {
    const hours = Math.max(0, row.hours);
    if (row.type === "SYG") sickHours += hours;
    else if (row.type === "BARNSYG") childSickHours += hours;
    else unpaidHours += hours;
  }
  return {
    sickHours,
    childSickHours,
    unpaidHours,
    paidAbsenceHours: sickHours + childSickHours,
    absenceHours: sickHours + childSickHours + unpaidHours,
  };
}

export function calculatePayroll(input: {
  rates: AgreementRates;
  wageOre: number;
  normalHours: number;
  overtime50Hours: number;
  overtime100Hours: number;
  sickHours?: number;
  childSickHours?: number;
  payType?: string;
  salariedOre?: number;
}) {
  if (input.payType === "FUNKTIONAER") {
    const normalOre = Math.max(0, input.salariedOre ?? 0);
    const grossOre = normalOre;
    const pensionEmployerOre = pct(grossOre, input.rates.pensionEmployerBps);
    const pensionEmployeeOre = pct(grossOre, input.rates.pensionEmployeeBps);
    return {
      wageOre: input.wageOre,
      normalOre,
      overtimeOre: 0,
      sickOre: 0,
      holidayPayOre: 0,
      shOre: 0,
      fritvalgOre: 0,
      pensionEmployerOre,
      pensionEmployeeOre,
      employerCostOre: grossOre + pensionEmployerOre,
      grossOre,
    };
  }
  const sickHours = Math.max(0, input.sickHours ?? 0);
  const childSickHours = Math.max(0, input.childSickHours ?? 0);
  const normalOre = Math.round(input.normalHours * input.wageOre);
  const overtimeOre =
    overtimePayOre(input.overtime50Hours, input.wageOre, input.rates.overtimeFirstPct, input.rates.overtimeFirstAddonOre) +
    overtimePayOre(input.overtime100Hours, input.wageOre, input.rates.overtimeRestPct, input.rates.overtimeRestAddonOre);
  const sickOre =
    sickPayOre(sickHours, input.wageOre, input.rates.sickPayPct) +
    sickPayOre(childSickHours, input.wageOre, input.rates.childSickPayPct);
  const grossOre = normalOre + overtimeOre + sickOre;
  const holidayPayOre = pct(grossOre, input.rates.holidayPayBps);
  const shOre = pct(grossOre, input.rates.shBps);
  const fritvalgOre = pct(grossOre, input.rates.fritvalgBps);
  const pensionEmployerOre = pct(grossOre, input.rates.pensionEmployerBps);
  const pensionEmployeeOre = pct(grossOre, input.rates.pensionEmployeeBps);
  const employerCostOre = grossOre + holidayPayOre + shOre + fritvalgOre + pensionEmployerOre;
  return {
    wageOre: input.wageOre,
    normalOre,
    overtimeOre,
    sickOre,
    holidayPayOre,
    shOre,
    fritvalgOre,
    pensionEmployerOre,
    pensionEmployeeOre,
    employerCostOre,
    grossOre,
  };
}

export function bpsLabel(bps: number) {
  return `${(bps / 100).toLocaleString("da-DK", { maximumFractionDigits: 2 })} %`;
}
