export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PL" | "MEDARBEJDER" | string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  barcode: string;
  unit: string;
};

export type ExtraWork = {
  id: string;
  title: string;
  amount: number;
  status: string;
};

export type Job = {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  state: string;
  stateLabel: string;
  customerName: string;
  address: string;
  phone: string;
  scheduledStart: string | null;
  scheduledEnd?: string | null;
  extraWorks: ExtraWork[];
};

export type TimeEntry = {
  id: string;
  caseId?: string;
  caseNumber?: string;
  hours: number;
  kind: string;
  note: string;
  date: string;
  userName?: string;
};

export type Absence = {
  id: string;
  date: string;
  hours: number;
  type: string;
  note: string;
};

export type Customer = {
  id: string;
  name: string;
  type?: string;
  phone: string;
  email: string;
  address: string;
  caseCount: number;
};

export type DayPayload = {
  user: SessionUser;
  timer: { caseId: string; startedAt: string | null; caseNumber?: string; title?: string } | null;
  products: Product[];
  klsTemplates?: { id: string; name: string; trade: string }[];
  jobs: Job[];
  cases?: Job[];
  timeEntries?: TimeEntry[];
  absences?: Absence[];
  customers?: Customer[];
};

export type CaseDetail = {
  job: Job;
  nextStates: { id: string; label: string }[];
  materials: { id: string; name: string; sku: string; quantity: number }[];
  timeEntries: TimeEntry[];
  documents: { id: string; name: string; category: string; createdAt: string }[];
  extraWorks: ExtraWork[];
  kls: {
    id: string;
    name: string;
    signedAt: string | null;
    notes: string;
    checks: { id: string; label: string; status: string; statusLabel: string; comment: string }[];
  } | null;
};

export type Tab = "day" | "cases" | "customers" | "time";

export type Route =
  | { name: "login" }
  | { name: "app"; tab: Tab }
  | { name: "job"; id: string }
  | { name: "settings" }
  | { name: "scan"; caseId: string }
  | { name: "legal" };
