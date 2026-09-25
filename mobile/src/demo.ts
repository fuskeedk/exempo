import type { DayPayload, ExtraWork, Job } from "./types";

const jobs: Job[] = [
  {
    id: "demo-1",
    caseNumber: "EX-2026-0004",
    title: "Køkkenrenovering — Nørrebro",
    state: "I_GANG",
    stateLabel: "I gang",
    customerName: "Maja Holm",
    address: "Jægersborggade 12, 2200 København N",
    phone: "20112233",
    scheduledStart: new Date().toISOString(),
    extraWorks: [
      { id: "xw-1", title: "Ekstra stikkontakt", amount: 185000, status: "SENDT" },
    ],
  },
  {
    id: "demo-2",
    caseNumber: "EX-2026-0002",
    title: "Tagrender — Hellerup",
    state: "PLANLAGT",
    stateLabel: "Planlagt",
    customerName: "Hellerup Villa ApS",
    address: "Strandvejen 188, 2900 Hellerup",
    phone: "39664411",
    scheduledStart: new Date().toISOString(),
    extraWorks: [],
  },
];

let timer: DayPayload["timer"] = null;
let extraSeq = 2;

export function demoDay(): DayPayload {
  return {
    user: {
      id: "demo-lars",
      name: "Lars Nielsen",
      email: "lars@exempo.dk",
      role: "MEDARBEJDER",
    },
    timer,
    products: [
      { id: "p1", sku: "GIPS-13", name: "Gipsplade 13 mm", barcode: "5701234560001", unit: "stk" },
      { id: "p2", sku: "FUG-01", name: "Fugemasse hvid", barcode: "5701234560002", unit: "stk" },
      { id: "p3", sku: "MAL-10", name: "Vægmaling 10 L", barcode: "5701234560004", unit: "stk" },
    ],
    jobs: jobs.map((job) => ({ ...job, extraWorks: [...job.extraWorks] })),
  };
}

export function demoStartTimer(caseId: string) {
  timer = { caseId, startedAt: new Date().toISOString() };
  return { hours: undefined as number | undefined };
}

export function demoStopTimer() {
  timer = null;
  return { hours: 0.5 };
}

export function demoAddMaterial(barcodeOrId: string) {
  const day = demoDay();
  const product = day.products.find(
    (item) => item.id === barcodeOrId || item.barcode === barcodeOrId || item.sku === barcodeOrId,
  );
  if (!product) throw new Error("Varen findes ikke.");
  return product.name;
}

export function demoAddExtra(caseId: string, title: string, amountKr: string) {
  const job = jobs.find((item) => item.id === caseId);
  if (!job) throw new Error("Sag mangler.");
  const extra: ExtraWork = {
    id: `xw-${extraSeq++}`,
    title,
    amount: Math.round((Number.parseFloat(amountKr.replace(",", ".")) || 0) * 100),
    status: "SENDT",
  };
  job.extraWorks.unshift(extra);
}

export function demoAddAbsence() {
  return true;
}

export function demoReset() {
  timer = null;
}
