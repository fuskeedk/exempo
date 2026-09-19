export const ROLES = ["ADMIN", "PL", "MEDARBEJDER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  PL: "Projektleder",
  MEDARBEJDER: "Medarbejder",
};

export const TRADES = [
  "TOMRER",
  "MURER",
  "ELEKTRIKER",
  "VVS",
  "MALER",
  "GULV",
  "TAG",
  "ANDET",
] as const;
export type Trade = (typeof TRADES)[number];

export const TRADE_LABELS: Record<Trade, string> = {
  TOMRER: "Tømrer",
  MURER: "Murer",
  ELEKTRIKER: "Elektriker",
  VVS: "VVS",
  MALER: "Maler",
  GULV: "Gulv",
  TAG: "Tag",
  ANDET: "Andet",
};

export const DOCUMENT_CATEGORIES = [
  "FOTO",
  "TILBUD",
  "KLS",
  "FAKTURA",
  "FORSIKRING",
  "ANDET",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_LABELS: Record<DocumentCategory, string> = {
  FOTO: "Foto",
  TILBUD: "Tilbud",
  KLS: "KLS",
  FAKTURA: "Faktura",
  FORSIKRING: "Forsikring",
  ANDET: "Andet",
};

export const INVOICE_STATUSES = ["KLADDE", "SENDT", "BETALT"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  KLADDE: "Kladde",
  SENDT: "Sendt",
  BETALT: "Betalt",
};

export const KLS_STATUSES = ["PENDING", "OK", "AFVIGELSE", "NA"] as const;
export type KlsStatus = (typeof KLS_STATUSES)[number];

export const KLS_STATUS_LABELS: Record<KlsStatus, string> = {
  PENDING: "Ikke tjekket",
  OK: "OK",
  AFVIGELSE: "Afvigelse",
  NA: "Ikke relevant",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isTrade(value: string): value is Trade {
  return (TRADES as readonly string[]).includes(value);
}

export const EMPLOYEE_COLORS = [
  "#2d6a52",
  "#b85c38",
  "#3d5a80",
  "#7b4b94",
  "#8a6d3b",
  "#2f6f7e",
];
