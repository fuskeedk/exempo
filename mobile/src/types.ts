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
  state: string;
  stateLabel: string;
  customerName: string;
  address: string;
  phone: string;
  scheduledStart: string | null;
  extraWorks: ExtraWork[];
};

export type DayPayload = {
  user: SessionUser;
  timer: { caseId: string; startedAt: string | null } | null;
  products: Product[];
  jobs: Job[];
};

export type Route =
  | { name: "login" }
  | { name: "day" }
  | { name: "job"; id: string }
  | { name: "settings" }
  | { name: "absence" }
  | { name: "scan"; caseId: string }
  | { name: "legal" };
