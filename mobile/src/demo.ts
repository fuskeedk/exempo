import type { CaseDetail, DayPayload, ExtraWork, Job } from "./types";

const jobs: Job[] = [
  {
    id: "demo-1",
    caseNumber: "EX-2026-0004",
    title: "Køkkenrenovering — Nørrebro",
    description: "Nyt køkken, gips og maling.",
    state: "I_GANG",
    stateLabel: "I gang",
    customerName: "Maja Holm",
    address: "Jægersborggade 12, 2200 København N",
    phone: "20112233",
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date(Date.now() + 4 * 36e5).toISOString(),
    extraWorks: [{ id: "xw-1", title: "Ekstra stikkontakt", amount: 185000, status: "SENDT" }],
  },
  {
    id: "demo-2",
    caseNumber: "EX-2026-0002",
    title: "Tagrender — Hellerup",
    description: "Rens og reparation.",
    state: "PLANLAGT",
    stateLabel: "Planlagt",
    customerName: "Hellerup Villa ApS",
    address: "Strandvejen 188, 2900 Hellerup",
    phone: "39664411",
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date(Date.now() + 3 * 36e5).toISOString(),
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
    klsTemplates: [{ id: "t1", name: "Tømrer — udførelse", trade: "TOMRER" }],
    jobs: jobs.map((job) => ({ ...job, extraWorks: [...job.extraWorks] })),
    cases: jobs.map((job) => ({ ...job, extraWorks: [...job.extraWorks] })),
    timeEntries: [
      { id: "te-1", caseId: "demo-1", caseNumber: "EX-2026-0004", hours: 6, kind: "ARBEJDE", note: "Opstart", date: new Date().toISOString() },
    ],
    absences: [],
    customers: [
      {
        id: "c1",
        name: "Maja Holm",
        type: "PRIVAT",
        phone: "20112233",
        email: "maja@example.dk",
        address: "Jægersborggade 12, 2200 København N",
        caseCount: 1,
      },
      {
        id: "c2",
        name: "Hellerup Villa ApS",
        type: "ERHVERV",
        phone: "39664411",
        email: "drift@hellerup-villa.dk",
        address: "Strandvejen 188, 2900 Hellerup",
        caseCount: 1,
      },
    ],
  };
}

export function demoCase(id: string): CaseDetail {
  const job = jobs.find((item) => item.id === id) ?? jobs[0];
  return {
    job,
    nextStates:
      job.state === "PLANLAGT"
        ? [{ id: "I_GANG", label: "I gang" }]
        : job.state === "I_GANG"
          ? [{ id: "KLS", label: "KLS" }]
          : [],
    materials: [{ id: "m1", name: "Gipsplade 13 mm", sku: "GIPS-13", quantity: 4 }],
    timeEntries: [
      { id: "te-1", hours: 6, kind: "ARBEJDE", note: "Opstart", date: new Date().toISOString(), userName: "Lars Nielsen" },
    ],
    documents: [],
    extraWorks: job.extraWorks,
    kls: null,
  };
}

export function demoStartTimer(caseId: string) {
  const job = jobs.find((item) => item.id === caseId);
  timer = { caseId, startedAt: new Date().toISOString(), caseNumber: job?.caseNumber, title: job?.title };
  return { hours: undefined as number | undefined };
}

export function demoStopTimer() {
  timer = null;
  return { hours: 0.5 };
}

export function demoAddMaterial(barcodeOrId: string) {
  const day = demoDay();
  const product = day.products.find(
    (item) => item.id === barcodeOrId || item.barcode === barcodeOrId || item.sku === barcodeOrId || item.name === barcodeOrId,
  );
  if (!product) return barcodeOrId || "Materiale";
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
