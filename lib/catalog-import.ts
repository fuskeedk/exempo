import { parseKrToOre } from "@/lib/money";

export type CatalogImportRow = {
  sku: string;
  name: string;
  barcode: string;
  unit: string;
  costPrice: number;
  salePrice: number;
};

const MAX_ROWS = 8_000;

const SKU_KEYS = ["varenr", "varenummer", "sku", "itemnumber", "itemno", "artikelnummer", "number", "produktnr"];
const NAME_KEYS = ["navn", "varenavn", "name", "beskrivelse", "description", "varetekst", "tekst"];
const BARCODE_KEYS = ["ean", "stregkode", "barcode", "ean13", "ean8"];
const UNIT_KEYS = ["enhed", "unit", "enhedskode", "uom"];
const COST_KEYS = [
  "indkob",
  "indkobspris",
  "kostpris",
  "nettopris",
  "cost",
  "costprice",
  "netprice",
  "indkoeb",
  "indkoebspris",
];
const SALE_KEYS = ["salg", "salgspris", "listepris", "veil", "vejl", "price", "salesprice", "salgsprisexmoms"];

export function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function parseListPriceToOre(input: string) {
  const raw = input.trim().replace(/\s/g, "").replace(/kr\.?/gi, "");
  if (!raw || raw === "-" || raw === "–") return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) || raw.includes(",")) {
    return parseKrToOre(raw);
  }
  if (/^\d+\.\d{1,2}$/.test(raw)) {
    return Math.round(Number.parseFloat(raw) * 100);
  }
  return parseKrToOre(raw);
}

function detectDelimiter(headerLine: string) {
  const counts = [
    { delim: ";", count: headerLine.split(";").length },
    { delim: "\t", count: headerLine.split("\t").length },
    { delim: ",", count: headerLine.split(",").length },
  ].sort((a, b) => b.count - a.count);
  return counts[0].count > 1 ? counts[0].delim : ";";
}

function splitCsvLine(line: string, delim: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delim && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function pickIndex(headers: string[], keys: string[]) {
  return headers.findIndex((header) => keys.includes(header));
}

export function parseCatalogCsv(text: string): CatalogImportRow[] {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Filen har ingen datarækker.");
  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim).map(normalizeHeader);
  const skuAt = pickIndex(headers, SKU_KEYS);
  const nameAt = pickIndex(headers, NAME_KEYS);
  if (skuAt < 0 || nameAt < 0) {
    throw new Error("Filen skal have kolonner til varenr. og navn.");
  }
  const barcodeAt = pickIndex(headers, BARCODE_KEYS);
  const unitAt = pickIndex(headers, UNIT_KEYS);
  const costAt = pickIndex(headers, COST_KEYS);
  const saleAt = pickIndex(headers, SALE_KEYS);
  if (lines.length - 1 > MAX_ROWS) {
    throw new Error(`Højst ${MAX_ROWS} varer ad gangen.`);
  }

  const rows: CatalogImportRow[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, delim);
    const sku = (cells[skuAt] ?? "").trim();
    const name = (cells[nameAt] ?? "").replace(/\s+/g, " ").trim();
    if (!sku || !name || seen.has(sku)) continue;
    seen.add(sku);
    const costPrice = costAt >= 0 ? parseListPriceToOre(cells[costAt] ?? "") : 0;
    const salePrice = saleAt >= 0 ? parseListPriceToOre(cells[saleAt] ?? "") : 0;
    rows.push({
      sku,
      name,
      barcode: barcodeAt >= 0 ? (cells[barcodeAt] ?? "").replace(/\s/g, "") : "",
      unit: ((unitAt >= 0 ? cells[unitAt] : "") || "stk").trim().toLowerCase() || "stk",
      costPrice,
      salePrice: salePrice || costPrice,
    });
  }
  if (rows.length === 0) throw new Error("Ingen gyldige varer i filen.");
  return rows;
}
