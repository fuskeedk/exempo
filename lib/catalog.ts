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

export const CUSTOMER_TYPES = ["PRIVAT", "ERHVERV"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  PRIVAT: "Privat",
  ERHVERV: "Erhverv",
};

export const ORDER_TYPES = ["SKADE", "SERVICE", "ENTREPRISE", "REPARATION", "ANDET"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  SKADE: "Skadesag",
  SERVICE: "Service",
  ENTREPRISE: "Entreprise",
  REPARATION: "Reparation",
  ANDET: "Andet",
};

export const PRICING_MODES = ["FORBRUG", "FAST_PRIS", "KALKULATION"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];
export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  FORBRUG: "Efter forbrug",
  FAST_PRIS: "Fast pris",
  KALKULATION: "Kalkulation",
};

export const QUOTE_STATUSES = ["KLADDE", "SENDT", "GODKENDT", "AFVIST"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  KLADDE: "Kladde",
  SENDT: "Sendt",
  GODKENDT: "Godkendt",
  AFVIST: "Afvist",
};

export const TIME_KINDS = ["ARBEJDE", "OVERTID", "TILLÆG"] as const;
export type TimeKind = (typeof TIME_KINDS)[number];
export const TIME_KIND_LABELS: Record<TimeKind, string> = {
  ARBEJDE: "Arbejde",
  OVERTID: "Overtid",
  TILLÆG: "Tillæg",
};

export const ABSENCE_TYPES = ["FERIE", "SYG", "FRI", "ANDET"] as const;
export type AbsenceType = (typeof ABSENCE_TYPES)[number];
export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  FERIE: "Ferie",
  SYG: "Sygdom",
  FRI: "Fri",
  ANDET: "Andet",
};

export const EXTRA_STATUSES = ["KLADDE", "SENDT", "GODKENDT", "AFVIST", "FAKTURERET"] as const;
export type ExtraStatus = (typeof EXTRA_STATUSES)[number];
export const EXTRA_STATUS_LABELS: Record<ExtraStatus, string> = {
  KLADDE: "Kladde",
  SENDT: "Sendt til kunden",
  GODKENDT: "Godkendt",
  AFVIST: "Afvist",
  FAKTURERET: "Faktureret",
};

export const RESOURCE_TYPES = ["KØRETØJ", "UDSTYR", "VÆRKSTED"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  "KØRETØJ": "Køretøj",
  UDSTYR: "Udstyr",
  "VÆRKSTED": "Værksted",
};

export const INVOICE_KINDS = ["FAKTURA", "KREDITNOTA"] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];
export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  FAKTURA: "Faktura",
  KREDITNOTA: "Kreditnota",
};

export const INVOICE_STATUSES = ["KLADDE", "SENDT", "BETALT", "RYKKET", "INKASSO"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  KLADDE: "Kladde",
  SENDT: "Sendt",
  BETALT: "Betalt",
  RYKKET: "Rykket",
  INKASSO: "Inkasso",
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
