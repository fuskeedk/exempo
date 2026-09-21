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
  "ADMINISTRATION",
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
  ADMINISTRATION: "Administration",
  ANDET: "Andet",
};

export const CASE_TRADES = TRADES.filter((trade) => trade !== "ADMINISTRATION");

export const DOCUMENT_CATEGORIES = [
  "FØR",
  "EFTER",
  "FOTO",
  "UNDERSKRIFT",
  "TILBUD",
  "KLS",
  "FAKTURA",
  "FORSIKRING",
  "ANDET",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_LABELS: Record<DocumentCategory, string> = {
  "FØR": "Før-foto",
  EFTER: "Efter-foto",
  FOTO: "Foto",
  UNDERSKRIFT: "Underskrift",
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

export const ABSENCE_TYPES = ["FERIE", "FRI", "SYG", "BARNSYG", "EGEN_TID"] as const;
export type AbsenceType = (typeof ABSENCE_TYPES)[number];
export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  FERIE: "Ferie",
  FRI: "Fridag",
  SYG: "Sygdom",
  BARNSYG: "Barnsyg",
  EGEN_TID: "Egen tid",
};

export function isAbsenceType(value: string): value is AbsenceType {
  return (ABSENCE_TYPES as readonly string[]).includes(value);
}

export function absenceLabel(type: string) {
  if (isAbsenceType(type)) return ABSENCE_TYPE_LABELS[type];
  if (type === "ANDET") return "Andet";
  if (type === "FRAVAER") return "Fravær";
  return type;
}

export function isAbsenceKind(kind: string) {
  return kind === "FRAVAER" || kind === "ANDET" || isAbsenceType(kind);
}

export const BOOKING_TONES = [
  "case-planned",
  "case-registered",
  "none-planned",
  "none-registered",
  "absence-planned",
  "absence-registered",
] as const;
export type BookingTone = (typeof BOOKING_TONES)[number];
export const BOOKING_TONE_LABELS: Record<BookingTone, string> = {
  "case-planned": "Planlagt sag",
  "case-registered": "Registreret sag",
  "none-planned": "Planlagt · ikke ordrerelateret",
  "none-registered": "Registreret · ikke ordrerelateret",
  "absence-planned": "Planlagt fravær",
  "absence-registered": "Registreret fravær",
};

export function activityBookingTone(kind: string, status: string, caseId?: string | null): BookingTone {
  const registered = status === "REGISTRERET";
  if (isAbsenceKind(kind)) return registered ? "absence-registered" : "absence-planned";
  if (caseId) return registered ? "case-registered" : "case-planned";
  return registered ? "none-registered" : "none-planned";
}

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

export const INVOICE_KINDS = ["FAKTURA", "ACONTO", "KREDITNOTA"] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];
export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  FAKTURA: "Faktura",
  ACONTO: "Acontofaktura",
  KREDITNOTA: "Kreditnota",
};

export function isInvoiceKind(value: string): value is InvoiceKind {
  return (INVOICE_KINDS as readonly string[]).includes(value);
}

export function invoiceDocumentTitle(kind: string): string {
  if (kind === "ACONTO") return "Acontofaktura";
  if (kind === "KREDITNOTA") return "Kreditnota";
  return "Faktura";
}

export function canDeleteInvoice(status: string) {
  return status === "KLADDE";
}

export function canDeleteCase(invoices: { status: string }[]) {
  return invoices.every((invoice) => canDeleteInvoice(invoice.status));
}

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

export const PURCHASE_STATUSES = ["MODTAGET", "AFVENTER", "GODKENDT", "DRIFT", "AFVIST"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  MODTAGET: "Ikke matchet til sag",
  AFVENTER: "Afventer godkendelse",
  GODKENDT: "Godkendt — belaster sag",
  DRIFT: "Godkendt — ikke ordre-relateret",
  AFVIST: "Afvist",
};

export const MAIL_PURPOSES = ["FAKTURA", "TILBUD", "GENEREL"] as const;
export type MailPurpose = (typeof MAIL_PURPOSES)[number];
export const MAIL_PURPOSE_LABELS: Record<MailPurpose, string> = {
  FAKTURA: "Indkøbs- og salgsfaktura",
  TILBUD: "Tilbud",
  GENEREL: "Generel post",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isTrade(value: string): value is Trade {
  return (TRADES as readonly string[]).includes(value);
}

export function isPricingMode(value: string): value is PricingMode {
  return (PRICING_MODES as readonly string[]).includes(value);
}

export function isOrderType(value: string): value is OrderType {
  return (ORDER_TYPES as readonly string[]).includes(value);
}

export const EMPLOYEE_COLORS = [
  "#2d6a52",
  "#b85c38",
  "#3d5a80",
  "#7b4b94",
  "#8a6d3b",
  "#2f6f7e",
];
