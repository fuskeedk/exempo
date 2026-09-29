import { normalizeHeader, parseListPriceToOre, type CatalogImportRow } from "@/lib/catalog-import";
import type { CaseState } from "@/lib/fsm";
import { headerIndex, headersOf } from "@/lib/spreadsheet";

export const MIGRATION_SOURCES = ["minuba", "ordrestyring", "apacta", "andet"] as const;
export type MigrationSource = (typeof MIGRATION_SOURCES)[number];
export type MigrationKind = "kunder" | "ordrer" | "varer";

export const SOURCE_LABELS: Record<MigrationSource, string> = {
  minuba: "Minuba",
  ordrestyring: "Ordrestyring",
  apacta: "Apacta",
  andet: "fil",
};

const MAX_ROWS = 8_000;

const PRODUCT_KEYS = ["varenr", "varenummer", "artikelnummer", "sku", "produktnr", "itemnumber"];
const ORDER_KEYS = ["ordrenummer", "ordrenr", "sagsnr", "sagnummer", "overskrift", "ordretitel", "sagsnavn", "projekttitel", "projektnavn"];
const CUSTOMER_KEYS = ["kundenavn", "debitornavn", "firmanavn", "companyname", "kundenr", "kundenummer"];
const NAME_KEYS = ["kundenavn", "debitornavn", "firmanavn", "companyname", "navn", "name", "kunde"];
const NUMBER_KEYS = ["kundenr", "kundenummer", "kundennr", "debitornr", "debitornummer", "customernumber"];
const CVR_KEYS = ["cvr", "cvrnr", "cvrnummer", "vat", "vatnumber", "senr"];
const EMAIL_KEYS = ["email", "mail", "mailadresse"];
const PHONE_KEYS = ["mobil", "mobilnr", "telefon", "telefonnr", "tlf", "phone"];
const STREET_KEYS = ["adresse", "address", "vej", "gade", "installationsadresse", "kontaktadresse"];
const POSTAL_KEYS = ["postnr", "postnummer", "zip", "zipcode"];
const CITY_KEYS = ["by", "city", "postnrnavn"];
const POSTAL_CITY_KEYS = ["postnrogby", "postnrby"];
const NOTE_KEYS = ["kundebeskrivelse", "beskrivelse", "noter", "note", "notes", "kommentar"];
const ADDRESS2_KEYS = ["adresse2", "att"];
const ORDER_NUMBER_KEYS = ["ordrenummer", "ordrenr", "sagsnr", "sagnummer", "ordernumber", "nummer"];
const TITLE_KEYS = ["overskrift", "ordretitel", "sagsnavn", "projekttitel", "projektnavn", "titel", "title"];
const ORDER_TEXT_KEYS = ["ordrebeskrivelse", "sagsbeskrivelse", "beskrivelse", "description"];
const STATUS_KEYS = ["status", "ordrestatus", "sagsstatus"];
const REQUISITION_KEYS = ["rekvisitionsnr", "rekvisitionsnummer", "rekvisition"];
const REFERENCE_KEYS = ["deresreference", "reference", "erreference", "voresreference"];
const START_KEYS = ["startdato", "start", "startdate"];
const END_KEYS = ["slutdato", "slut", "enddate"];
const PRICE_KEYS = ["fastpris", "pris", "belob", "aftaltpris"];
const PERSON_KEYS = ["ansvarlig", "montor", "medarbejder"];
const TRADE_KEYS = ["afdeling", "fag", "department"];
const TYPE_KEYS = ["ordretype", "type", "sagstype"];
const SKU_KEYS = PRODUCT_KEYS;
const PRODUCT_NAME_KEYS = ["varenavn", "navn", "name", "beskrivelse", "varetekst"];
const BARCODE_KEYS = ["ean", "stregkode", "barcode", "ean13"];
const UNIT_KEYS = ["enhed", "unit"];
const COST_KEYS = ["indkob", "indkobspris", "kostpris", "nettopris", "cost", "costprice"];
const SALE_KEYS = ["salg", "salgspris", "listepris", "veil", "vejl", "price", "salesprice"];

const HEADER_HINTS = new Set([
  ...PRODUCT_KEYS,
  ...ORDER_KEYS,
  ...CUSTOMER_KEYS,
  ...NAME_KEYS,
  ...STREET_KEYS,
  ...EMAIL_KEYS,
  ...PHONE_KEYS,
  "glnnr",
  "kundekategori",
  "betalingsbetingelser",
  "fakturanavn",
]);

export type MigratedCustomer = {
  externalNumber: string;
  name: string;
  cvr: string;
  email: string;
  phone: string;
  street: string;
  postal: string;
  city: string;
  notes: string;
};

export type MigratedOrder = {
  externalNumber: string;
  customerNumber: string;
  customerName: string;
  title: string;
  description: string;
  state: CaseState;
  street: string;
  postal: string;
  city: string;
  phone: string;
  email: string;
  requisition: string;
  reference: string;
  start: Date | null;
  end: Date | null;
  priceOre: number;
  responsible: string;
  trade: string;
  orderType: string;
};

export type MigrationSheet = {
  source: MigrationSource;
  kind: MigrationKind;
  customers: MigratedCustomer[];
  orders: MigratedOrder[];
  products: CatalogImportRow[];
  skipped: number;
};

export function sourceLabel(source: MigrationSource) {
  return SOURCE_LABELS[source];
}

export function customerNote(source: MigrationSource, externalNumber: string, extra = "") {
  const label = sourceLabel(source);
  const marker = externalNumber ? `Overført fra ${label} (kundenr. ${externalNumber})` : `Overført fra ${label}`;
  return [marker, extra.trim()].filter(Boolean).join("\n");
}

export function partyKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(aps|a\/s|as|ivs|i\/s)\b/g, "")
    .replace(/[^a-z0-9æøå]+/gi, "");
}

export function markerKey(source: MigrationSource, externalNumber: string) {
  return externalNumber ? `${source}:${externalNumber}` : "";
}

export function mapTrade(value: string) {
  const text = normalizeHeader(value);
  if (text.includes("elektr")) return "ELEKTRIKER";
  if (text.includes("vvs") || text.includes("blikk")) return "VVS";
  if (text.includes("tomrer") || text.includes("snedker")) return "TOMRER";
  if (text.includes("murer")) return "MURER";
  if (text.includes("maler")) return "MALER";
  if (text.includes("gulv")) return "GULV";
  if (text.includes("tag")) return "TAG";
  return "ANDET";
}

export function mapOrderType(value: string) {
  const text = normalizeHeader(value);
  if (text.includes("skade")) return "SKADE";
  if (text.includes("service")) return "SERVICE";
  if (text.includes("entrepr")) return "ENTREPRISE";
  if (text.includes("repar")) return "REPARATION";
  return "ANDET";
}

export function mapCaseState(value: string): CaseState {
  const text = normalizeHeader(value);
  if (!text) return "NY";
  if (text.includes("annull") || text.includes("afvist")) return "ANNULLERET";
  if (text.includes("afslut") || text.includes("arkiv")) return "AFSLUTTET";
  if (text.includes("fakturer")) return "FAKTURERET";
  if (text.includes("faerdig") || text.includes("klar")) return "KLAR_TIL_FAKTURA";
  if (text.includes("igang") || text.includes("paabegyndt") || text.includes("startet")) return "I_GANG";
  if (text.includes("plan")) return "PLANLAGT";
  if (text.includes("besigt")) return "BESIGTIGELSE";
  return "NY";
}

export function parseLooseDate(value: string) {
  const text = value.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return atNoon(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dk = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (dk) {
    const year = dk[3].length === 2 ? 2000 + Number(dk[3]) : Number(dk[3]);
    return atNoon(year, Number(dk[2]), Number(dk[1]));
  }
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial > 20000 && serial < 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return atNoon(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  }
  return null;
}

export function splitPostalCity(value: string) {
  const match = value.trim().match(/^(\d{4})\s+(.+)$/);
  if (!match) return { postal: "", city: value.trim() };
  return { postal: match[1], city: match[2].trim() };
}

export function splitAddressLine(value: string) {
  const flat = value.replace(/\s*\n\s*/g, ", ").replace(/\s+/g, " ").trim();
  const match = flat.match(/^(.*?)(?:,\s*)?(\d{4})\s+([^,]+)$/);
  if (!match) return { street: flat, postal: "", city: "" };
  return { street: match[1].replace(/,\s*$/, "").trim(), postal: match[2], city: match[3].trim() };
}

export function splitCustomerCell(value: string) {
  const match = value.trim().match(/^(.*?)\s*\((\d+)\)\s*$/);
  if (!match) return { name: value.trim(), number: "" };
  return { name: match[1].trim(), number: match[2] };
}

export function matchPerson(name: string, people: Array<{ id: string; name: string }>) {
  const key = name.trim().toLowerCase();
  if (key.length < 2) return "";
  const exact = people.filter((person) => person.name.trim().toLowerCase() === key);
  if (exact.length === 1) return exact[0].id;
  const parts = key.split(/\s+/).filter(Boolean);
  const fuzzy = people.filter((person) => {
    const other = person.name.trim().toLowerCase();
    return other.includes(key) || key.includes(other);
  });
  if (fuzzy.length === 1) return fuzzy[0].id;
  if (parts.length < 2) return "";
  const both = people.filter((person) => {
    const other = person.name.trim().toLowerCase();
    return other.includes(parts[0]) && other.includes(parts[parts.length - 1]);
  });
  return both.length === 1 ? both[0].id : "";
}

export function mapMigration(rows: string[][], preferred: MigrationSource | "auto" = "auto"): MigrationSheet {
  const start = headerIndex(rows, (cells) => cells.some((cell) => HEADER_HINTS.has(normalizeHeader(cell))));
  const headers = headersOf(rows[start] ?? []);
  const kind = detectKind(headers);
  if (!kind) throw new Error("Filen blev ikke genkendt. Brug eksporten med kolonneoverskrifter.");
  const source = preferred === "auto" ? detectSource(headers) : preferred;
  const body = rows.slice(start + 1).filter((row) => row.some((cell) => cell.trim()));
  if (body.length > MAX_ROWS) throw new Error(`Højst ${MAX_ROWS} rækker ad gangen.`);
  if (kind === "varer") {
    return { source, kind, customers: [], orders: [], products: mapProducts(headers, body), skipped: 0 };
  }
  if (kind === "ordrer") {
    const orders = mapOrders(headers, body);
    return { source, kind, customers: [], orders, products: [], skipped: body.length - orders.length };
  }
  const customers = mapCustomers(headers, body);
  return { source, kind, customers, orders: [], products: [], skipped: body.length - customers.length };
}

function detectKind(headers: string[]): MigrationKind | null {
  const has = (...keys: string[]) => keys.some((key) => headers.includes(key));
  if (has(...PRODUCT_KEYS) && !has(...ORDER_KEYS)) return "varer";
  if (has(...ORDER_KEYS)) return "ordrer";
  if (has(...CUSTOMER_KEYS) || (has("navn", "name") && has("adresse", "address", "email", "telefon", "tlf", "postnr"))) {
    return "kunder";
  }
  return null;
}

function detectSource(headers: string[]): MigrationSource {
  const has = (...keys: string[]) => keys.some((key) => headers.includes(key));
  if (has("glnnr", "kundebeskrivelse", "rekvisitionsnr", "rekvisitionsnummer", "installationsadresse")) return "minuba";
  if (has("kundekategori", "betalingsbetingelser", "fakturanavn", "fakturapostnummer", "fakturaadresse")) return "ordrestyring";
  if (headers.some((header) => header.startsWith("apacta"))) return "apacta";
  return "andet";
}

function mapCustomers(headers: string[], rows: string[][]) {
  const numberAt = first(headers, NUMBER_KEYS);
  const nameAt = first(headers, ["kundenavn", "debitornavn", "firmanavn", "companyname", "navn", "name"]);
  const cvrAt = first(headers, CVR_KEYS);
  const emailAt = first(headers, EMAIL_KEYS);
  const phoneAt = first(headers, PHONE_KEYS);
  const streetAt = first(headers, ["adresse", "address", "vej"]);
  const postalAt = first(headers, POSTAL_KEYS);
  const cityAt = first(headers, CITY_KEYS);
  const postalCityAt = first(headers, POSTAL_CITY_KEYS);
  const noteAt = first(headers, NOTE_KEYS);
  const address2At = first(headers, ADDRESS2_KEYS);
  const invoiceStreetAt = first(headers, ["fakturaadresse"]);
  const out: MigratedCustomer[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = clean(row[nameAt] ?? "");
    if (!name) continue;
    const externalNumber = clean(row[numberAt] ?? "");
    const key = externalNumber || partyKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    let postal = clean(row[postalAt] ?? "");
    let city = clean(row[cityAt] ?? "");
    if ((!postal || !city) && postalCityAt >= 0) {
      const both = splitPostalCity(row[postalCityAt] ?? "");
      postal = postal || both.postal;
      city = city || both.city;
    }
    let street = clean(row[streetAt] ?? "");
    if (!street && invoiceStreetAt >= 0) street = clean(row[invoiceStreetAt] ?? "");
    if (street && !postal) {
      const split = splitAddressLine(street);
      if (split.postal) {
        street = split.street;
        postal = postal || split.postal;
        city = city || split.city;
      }
    }
    const extra = [clean(row[noteAt] ?? ""), clean(row[address2At] ?? "")].filter(Boolean).join(" · ");
    out.push({
      externalNumber,
      name,
      cvr: digits(row[cvrAt] ?? ""),
      email: clean(row[emailAt] ?? ""),
      phone: firstPhone(row, headers, phoneAt),
      street,
      postal,
      city,
      notes: extra,
    });
  }
  if (out.length === 0) throw new Error("Ingen kunder i filen.");
  return out;
}

function mapOrders(headers: string[], rows: string[][]) {
  const numberAt = first(headers, ORDER_NUMBER_KEYS);
  const customerNumberAt = first(headers, NUMBER_KEYS);
  const customerNameAt = first(headers, ["kundenavn", "kunde", "debitornavn", "firmanavn", "navn"]);
  const titleAt = first(headers, TITLE_KEYS);
  const textAt = first(headers, ORDER_TEXT_KEYS);
  const statusAt = first(headers, STATUS_KEYS);
  const streetAt = first(headers, ["installationsadresse", "kontaktadresse", "adresse", "address"]);
  const postalAt = first(headers, POSTAL_KEYS);
  const cityAt = first(headers, CITY_KEYS);
  const phoneAt = first(headers, PHONE_KEYS);
  const emailAt = first(headers, EMAIL_KEYS);
  const requisitionAt = first(headers, REQUISITION_KEYS);
  const referenceAt = first(headers, REFERENCE_KEYS);
  const startAt = first(headers, START_KEYS);
  const endAt = first(headers, END_KEYS);
  const priceAt = first(headers, PRICE_KEYS);
  const personAt = first(headers, PERSON_KEYS);
  const tradeAt = first(headers, TRADE_KEYS);
  const typeAt = first(headers, TYPE_KEYS);
  const out: MigratedOrder[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const named = splitCustomerCell(clean(row[customerNameAt] ?? ""));
    const customerNumber = clean(row[customerNumberAt] ?? "") || named.number;
    const titled = clean(row[titleAt] ?? "");
    const text = textAt >= 0 && textAt !== titleAt ? clean(row[textAt] ?? "") : "";
    const title = titled || named.name || text;
    if (!title) continue;
    const externalNumber = clean(row[numberAt] ?? "");
    if (externalNumber && seen.has(externalNumber)) continue;
    if (externalNumber) seen.add(externalNumber);
    let street = clean(row[streetAt] ?? "");
    let postal = clean(row[postalAt] ?? "");
    let city = clean(row[cityAt] ?? "");
    if (street && !postal) {
      const split = splitAddressLine(street);
      if (split.postal) {
        street = split.street;
        postal = split.postal;
        city = city || split.city;
      }
    }
    out.push({
      externalNumber,
      customerNumber,
      customerName: named.name,
      title,
      description: titled ? text : "",
      state: mapCaseState(statusAt >= 0 ? (row[statusAt] ?? "") : ""),
      street,
      postal,
      city,
      phone: clean(row[phoneAt] ?? ""),
      email: clean(row[emailAt] ?? ""),
      requisition: clean(row[requisitionAt] ?? ""),
      reference: clean(row[referenceAt] ?? ""),
      start: startAt >= 0 ? parseLooseDate(row[startAt] ?? "") : null,
      end: endAt >= 0 ? parseLooseDate(row[endAt] ?? "") : null,
      priceOre: priceAt >= 0 ? parseListPriceToOre(row[priceAt] ?? "") : 0,
      responsible: clean(row[personAt] ?? ""),
      trade: mapTrade(row[tradeAt] ?? ""),
      orderType: mapOrderType(row[typeAt] ?? ""),
    });
  }
  if (out.length === 0) throw new Error("Ingen sager i filen.");
  return out;
}

function mapProducts(headers: string[], rows: string[][]) {
  const skuAt = first(headers, SKU_KEYS);
  const nameAt = first(headers, PRODUCT_NAME_KEYS);
  const barcodeAt = first(headers, BARCODE_KEYS);
  const unitAt = first(headers, UNIT_KEYS);
  const costAt = first(headers, COST_KEYS);
  const saleAt = first(headers, SALE_KEYS);
  const out: CatalogImportRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const sku = clean(row[skuAt] ?? "");
    const name = clean(row[nameAt] ?? "");
    if (!sku || !name || seen.has(sku)) continue;
    seen.add(sku);
    const costPrice = costAt >= 0 ? parseListPriceToOre(row[costAt] ?? "") : 0;
    const salePrice = saleAt >= 0 ? parseListPriceToOre(row[saleAt] ?? "") : 0;
    out.push({
      sku,
      name,
      barcode: barcodeAt >= 0 ? (row[barcodeAt] ?? "").replace(/\s/g, "") : "",
      unit: (clean(row[unitAt] ?? "") || "stk").toLowerCase(),
      costPrice,
      salePrice: salePrice || costPrice,
    });
  }
  if (out.length === 0) throw new Error("Ingen varer i filen.");
  return out;
}

function first(headers: string[], keys: string[]) {
  return headers.findIndex((header) => keys.includes(header));
}

function firstPhone(row: string[], headers: string[], fallback: number) {
  for (const key of PHONE_KEYS) {
    const at = headers.indexOf(key);
    const value = clean(row[at] ?? "");
    if (value) return value;
  }
  return clean(row[fallback] ?? "");
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function atNoon(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
