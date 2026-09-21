import { spawn } from "node:child_process";
import { inflateRawSync, inflateSync } from "node:zlib";
import { parseKrToOre } from "@/lib/money";

export type ParsedInvoiceLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type ParsedInvoice = {
  supplierName: string;
  supplierCvr: string;
  invoiceNumber: string;
  issuedAt: string | null;
  dueAt: string | null;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
  orderReference: string;
  note: string;
  fileName: string;
  lines: ParsedInvoiceLine[];
  text: string;
};

export type PurchaseCaseHint = {
  id: string;
  caseNumber: string;
  title: string;
  customerAddress: string;
  customerCity: string;
  requisition?: string | null;
  projectLeaderId?: string | null;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  januar: 0,
  feb: 1,
  februar: 1,
  mar: 2,
  marts: 2,
  apr: 3,
  april: 3,
  maj: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oktober: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONEY = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})`;

export function moneyToOre(input: string): number {
  const raw = input.replace(/DKK|kr\.?|EUR/gi, "").trim();
  if (!raw) return 0;
  if (raw.includes(",")) return parseKrToOre(raw);
  const value = Number.parseFloat(raw.replace(/\s/g, ""));
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function fold(value: string) {
  return value
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function xmlLocal(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, "gi");
  return [...xml.matchAll(re)].map((match) =>
    match[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
  );
}

function firstXml(xml: string, names: string[]) {
  for (const name of names) {
    const values = xmlLocal(xml, name).map((value) => value.trim()).filter(Boolean);
    if (values[0]) return values[0];
  }
  return "";
}

function looksLikeXmlInvoice(text: string) {
  return /<(?:\w+:)?(?:Invoice|CreditNote)\b/i.test(text);
}

export function looksLikeInvoiceMail(input: { subject?: string; text?: string; hasAttachment?: boolean }) {
  if (input.hasAttachment) return true;
  const hay = `${input.subject ?? ""}\n${input.text ?? ""}`;
  return /faktura|kreditnota|invoice|credit\s*note|følgeseddel|indk[øo]bsfaktura/i.test(hay);
}

export function parseDanishDate(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dotted) {
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    return `${year}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  }
  const named = text.match(/^(\d{1,2})\.?\s+([a-zæøå.]+)\s+(\d{4})$/i);
  if (named) {
    const month = MONTHS[named[2].replace(/\./g, "").toLowerCase()];
    if (month != null) {
      const date = new Date(Date.UTC(Number(named[3]), month, Number(named[1])));
      return date.toISOString().slice(0, 10);
    }
  }
  const compact = text.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    return `20${compact[3]}-${compact[2]}-${compact[1]}`;
  }
  return null;
}

function labeledDate(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/);
  for (const label of labels) {
    const re = new RegExp(label, "i");
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i])) continue;
      const window = `${lines[i]} ${lines[i + 1] ?? ""}`;
      const match = window.match(new RegExp(`${label}\\s*[:.]?\\s*([^\\n]+)`, "i"));
      const rest = (match?.[1] ?? "").trim();
      const named = rest.match(/^(\d{1,2}\.?\s+[a-zæøå.]+\s+\d{4})/i);
      const parsed =
        parseDanishDate(named?.[1] ?? "") ||
        parseDanishDate(rest.split(/\s{2,}/)[0] ?? "") ||
        parseDanishDate(rest.split(/\s+/)[0] ?? "");
      if (parsed) return parsed;
      const compact = [...window.matchAll(/\b(\d{6})\b/g)].map((item) => parseDanishDate(item[1])).find(Boolean);
      if (compact) return compact;
    }
  }
  return null;
}

function labeledMoney(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:^|[^A-Za-zÆØÅæøå])${label}(?![A-Za-zÆØÅæøå])[^\\n]{0,80}?${MONEY}`, "i"));
    if (match) return moneyToOre(match[1]);
  }
  return 0;
}

export function extractInvoiceNumber(text: string, fileName = "") {
  const labeled = text.match(
    /(?:fakturan(?:ummer|r\.?)|invoice\s*(?:number|no\.?)|kreditnota(?:nr\.?)?)\s*[:.\s]+([A-Z0-9][-A-Z0-9/]{2,})/i,
  );
  if (labeled?.[1]) return labeled[1].replace(/[.,]$/g, "").toUpperCase();
  const underTitle = text.match(/\bFAKTURA\s+(\d{5,})\b/i) || text.match(/\bFAKTURA\s*\r?\n\s*(\d{5,})\b/i);
  if (underTitle?.[1]) return underTitle[1];
  const fromFile = fileName.match(/(?:faktura[-_ ]+)?(\d{5,}|\d{4}-\d{3,})/i);
  return fromFile?.[1] ? fromFile[1].toUpperCase() : "";
}

export function extractCvr(text: string) {
  const match = text.match(/CVR(?:-nr\.?)?[:\s]*([0-9]{8})/i);
  return match?.[1] ?? "";
}

export function extractOrderReference(text: string) {
  const slash = text.match(/\b(\d{4,8}\s*\/\s*[A-Za-zÆØÅæøå][^\n,]{2,40})/);
  if (slash?.[1]) return slash[1].replace(/\s+/g, " ").trim();
  const labeled = text.match(
    /(?:kundens ordre|ordrereference|buyer\s*reference|sag(?:snr\.?|nummer)?)\s*[:.\s]+([^\n]{3,80})/i,
  );
  if (labeled?.[1]) {
    const value = labeled[1].replace(/\s{2,}/g, " ").trim();
    const compact = value.match(/^(\d{4,8}\s*\/\s*[^\n,]{3,40}|\S{3,40})/);
    const picked = (compact?.[1] ?? value).trim();
    if (!/^(fakturadato|side|antal|ordrenr)$/i.test(picked)) return picked;
  }
  return "";
}

function parseSimpleLines(text: string): ParsedInvoiceLine[] {
  const lines: ParsedInvoiceLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || /beskrivelse|subtotal|moms|total|ordretotal|antal\s+pris|stregkode|varenr/i.test(line)) continue;
    const match = line.match(
      new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s+(?:DKK\\s*)?${MONEY}\\s+(?:DKK\\s*)?${MONEY}$`, "i"),
    );
    if (!match) continue;
    const description = match[1].replace(/^[-\d.\s]+/, "").trim();
    if (description.length < 3 || !/[a-zæøå]/i.test(description)) continue;
    if (/\d{3,5}\s+\d+(?:[.,]\d+)?\s+\d+[.,]\d{2}/.test(description)) continue;
    const quantity = Number.parseFloat(match[2].replace(",", ".")) || 1;
    const unitPrice = moneyToOre(match[3]);
    const amount = moneyToOre(match[4]);
    if (quantity <= 0 || amount < 0) continue;
    lines.push({ description, quantity, unitPrice, amount });
  }
  return lines;
}

function parseAoInvoiceLines(text: string): ParsedInvoiceLine[] {
  const lines: ParsedInvoiceLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    const match = line.match(
      new RegExp(
        `^([A-ZÆØÅ0-9].{7,}?)\\s+\\d{3,5}\\s+(\\d+(?:[.,]\\d+)?)\\s+${MONEY}(?:\\s+[KT])?\\s+${MONEY}(?:\\s+[\\d.,]+)?\\s+${MONEY}$`,
      ),
    );
    if (!match) continue;
    const description = match[1].replace(/^[-\d.\s]+/, "").trim();
    if (!description || /beskrivelse|stregkode|varenr/i.test(description)) continue;
    const quantity = Number.parseFloat(match[2].replace(",", ".")) || 1;
    const unitPrice = moneyToOre(match[3]);
    const amount = moneyToOre(match[5]);
    if (quantity <= 0) continue;
    lines.push({ description, quantity, unitPrice, amount: amount || Math.round(quantity * unitPrice) });
  }
  return lines;
}

function parsePackingLines(text: string): ParsedInvoiceLine[] {
  const lines: ParsedInvoiceLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    const match = line.match(/^(\d+)\s+\S+\s+(\d{6,})\s+(.+?)\s+(\d+)\s*STK\s+(\d+)\s*STK/i);
    if (!match) continue;
    const sku = match[2];
    const name = match[3].replace(/\s+/g, " ").trim();
    const quantity = Number.parseFloat(match[5]) || Number.parseFloat(match[4]) || 1;
    lines.push({
      description: sku ? `${name} (${sku})` : name,
      quantity,
      unitPrice: 0,
      amount: 0,
    });
  }
  return lines;
}

export function parseInvoiceLines(text: string): ParsedInvoiceLine[] {
  const ao = parseAoInvoiceLines(text);
  const priced = ao.length ? ao : parseSimpleLines(text);
  if (priced.length) {
    const seen = new Set<string>();
    return priced.filter((line) => {
      const key = `${line.description}|${line.quantity}|${line.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return parsePackingLines(text);
}

const KNOWN_SUPPLIER_CVR: Record<string, string> = {
  "58210617": "AO",
};

function supplierFromText(text: string, fallback = "") {
  const known = KNOWN_SUPPLIER_CVR[extractCvr(text)];
  if (known) return known;
  if (/\bAO\b/.test(text) && /58210617/.test(text)) return "AO";
  const letterhead = text
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => /aps|a\/s|as\b|i\/s|ivs/i.test(line) && line.length < 80 && !/cvr|faktura|kunde/i.test(line));
  return (letterhead || fallback).replace(/\s+/g, " ").trim();
}

export function parseInvoiceXml(xml: string, fileName = ""): ParsedInvoice {
  const credit = /<(?:\w+:)?CreditNote\b/i.test(xml);
  const invoiceNumber = firstXml(xml, ["ID"]);
  const supplierName =
    firstXml(xml, ["RegistrationName"]) ||
    xmlLocal(xml, "Name")[0] ||
    "";
  const supplierCvr = firstXml(xml, ["CompanyID"]).replace(/\D/g, "").slice(0, 8);
  const netAmount = moneyToOre(firstXml(xml, ["TaxExclusiveAmount", "LineExtensionAmount"]));
  const vatAmount = moneyToOre(firstXml(xml, ["TaxAmount"]));
  const grossAmount =
    moneyToOre(firstXml(xml, ["PayableAmount", "TaxInclusiveAmount"])) || netAmount + vatAmount;
  const orderReference = firstXml(xml, ["BuyerReference"]) || firstXml(xml, ["ID"]);
  const orderRefNode =
    xml.match(/<(?:[\w.-]+:)?OrderReference[\s\S]*?<(?:[\w.-]+:)?ID(?:\s[^>]*)?>([\s\S]*?)<\//i)?.[1]?.trim() ?? "";
  const linesXml = xml.split(/<(?:[\w.-]+:)?(?:InvoiceLine|CreditNoteLine)\b/i).slice(1);
  const lines = linesXml.map((chunk) => {
    const name = firstXml(chunk, ["Name", "Description"]) || "Varelinje";
    const sku = firstXml(chunk, ["SellersItemIdentification", "ID"]);
    const quantity = Number.parseFloat(firstXml(chunk, ["InvoicedQuantity", "CreditedQuantity"]) || "1") || 1;
    const amount = moneyToOre(firstXml(chunk, ["LineExtensionAmount"]));
    const unitPrice = moneyToOre(firstXml(chunk, ["PriceAmount"])) || (quantity ? Math.round(amount / quantity) : amount);
    return {
      description: sku && !name.includes(sku) ? `${name} (${sku})` : name,
      quantity,
      unitPrice,
      amount,
    };
  }).filter((line) => line.description);
  const sign = credit ? -1 : 1;
  return {
    supplierName: supplierName || "Ukendt leverandør",
    supplierCvr,
    invoiceNumber: invoiceNumber && invoiceNumber.length < 40 ? invoiceNumber : "",
    issuedAt: parseDanishDate(firstXml(xml, ["IssueDate"])) ,
    dueAt: parseDanishDate(firstXml(xml, ["DueDate", "PaymentDueDate"])),
    netAmount: netAmount * sign,
    vatAmount: vatAmount * sign,
    grossAmount: grossAmount * sign,
    currency: firstXml(xml, ["DocumentCurrencyCode"]) || "DKK",
    orderReference: orderRefNode || (orderReference !== invoiceNumber ? orderReference : ""),
    note: credit ? "Kreditnota" : "",
    fileName,
    lines,
    text: xml,
  };
}

function parseAoTotals(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    if (!/ordretotal/i.test(lines[i])) continue;
    const window = `${lines[i]}\n${lines[i + 1] ?? ""}`;
    const nums = [...window.matchAll(new RegExp(MONEY, "g"))].map((match) => moneyToOre(match[1]));
    if (nums.length < 3) continue;
    const percentIdx = nums.findIndex((value) => value === 2500);
    const vat =
      percentIdx >= 0 && nums[percentIdx + 1] != null ? nums[percentIdx + 1] : nums[nums.length - 2];
    return { net: nums[0], vat, gross: nums[nums.length - 1] };
  }
  return null;
}

export function parseInvoiceText(text: string, fileName = "", fallback: Partial<ParsedInvoice> = {}): ParsedInvoice {
  if (looksLikeXmlInvoice(text)) return parseInvoiceXml(text, fileName);
  const lines = parseInvoiceLines(text);
  const invoiceNumber = extractInvoiceNumber(text, fileName) || fallback.invoiceNumber || "";
  const aoTotals = parseAoTotals(text);
  const netAmount = aoTotals?.net || labeledMoney(text, ["ordretotal", "subtotal", "netto", "tax exclusive"]) || fallback.netAmount || 0;
  const vatAmount = aoTotals?.vat || labeledMoney(text, ["momsbeløb", "moms \\(25%\\)", "moms"]) || fallback.vatAmount || 0;
  const grossAmount =
    aoTotals?.gross ||
    labeledMoney(text, ["til betaling", "att betala", "total\\s+dkk", "\\btotal\\b", "gross"]) ||
    fallback.grossAmount ||
    (netAmount && vatAmount ? netAmount + vatAmount : 0);
  const orderReference = extractOrderReference(text) || fallback.orderReference || "";
  return {
    supplierName: supplierFromText(text, fallback.supplierName || "") || "Ukendt leverandør",
    supplierCvr: extractCvr(text) || fallback.supplierCvr || "",
    invoiceNumber,
    issuedAt: labeledDate(text, ["fakturadato", "udstedt", "issue date", "dato"]) || fallback.issuedAt || null,
    dueAt: labeledDate(text, ["forfaldsdato", "betalingsdato", "due date"]) || fallback.dueAt || null,
    netAmount,
    vatAmount,
    grossAmount,
    currency: "DKK",
    orderReference,
    note: /følgeseddel/i.test(`${fileName}\n${text}`) ? "Følgeseddel" : fallback.note || "",
    fileName,
    lines,
    text,
  };
}

export function mergeParsedInvoices(parts: ParsedInvoice[], fallback: Partial<ParsedInvoice> = {}): ParsedInvoice {
  const ranked = [...parts].sort((a, b) => {
    const score = (item: ParsedInvoice) =>
      (item.grossAmount ? 8 : 0) +
      (item.lines.some((line) => line.amount) ? 4 : 0) +
      (item.invoiceNumber ? 2 : 0) +
      (item.lines.length ? 1 : 0);
    return score(b) - score(a);
  });
  const best = ranked[0] ?? parseInvoiceText("", "", fallback);
  const lineSource =
    ranked.find((part) => part.lines.some((line) => line.amount > 0)) ??
    ranked.find((part) => part.lines.length) ??
    best;
  const unique: ParsedInvoiceLine[] = [];
  const seen = new Set<string>();
  for (const line of lineSource.lines) {
    const key = `${line.description}|${line.quantity}|${line.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  return {
    ...best,
    supplierName: best.supplierName !== "Ukendt leverandør" ? best.supplierName : fallback.supplierName || best.supplierName,
    supplierCvr: best.supplierCvr || fallback.supplierCvr || "",
    invoiceNumber: best.invoiceNumber || fallback.invoiceNumber || "",
    orderReference: best.orderReference || fallback.orderReference || "",
    issuedAt: best.issuedAt || fallback.issuedAt || null,
    dueAt: best.dueAt || fallback.dueAt || null,
    netAmount: best.netAmount || fallback.netAmount || 0,
    vatAmount: best.vatAmount || fallback.vatAmount || 0,
    grossAmount: best.grossAmount || fallback.grossAmount || 0,
    note: [best.note, fallback.note].filter(Boolean).join(" · "),
    fileName: best.fileName || fallback.fileName || "",
    lines: unique.length ? unique : best.lines,
    text: [fallback.note, ...ranked.map((part) => part.text)].filter(Boolean).join("\n"),
  };
}

function pdfToTextFallback(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const texts: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const payload = Buffer.from(match[1], "latin1");
    let decoded: Buffer | null = null;
    for (const fn of [inflateSync, inflateRawSync]) {
      try {
        decoded = fn(payload);
        break;
      } catch {
        decoded = null;
      }
    }
    const body = (decoded ?? payload).toString("latin1");
    for (const hit of body.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
      texts.push(unescapePdf(hit[0].slice(1, hit[0].lastIndexOf(")"))));
    }
    for (const hit of body.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
      const parts = [...hit[1].matchAll(/\((?:\\.|[^\\)])*\)/g)].map((part) => unescapePdf(part[0].slice(1, -1)));
      texts.push(parts.join(""));
    }
  }
  return texts.join(" ");
}

function unescapePdf(value: string) {
  return value.replace(/\\n/g, "\n").replace(/\\([()\\])/g, "$1");
}

export function extractPdfTextSync(buffer: Buffer) {
  return pdfToTextFallback(buffer);
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const fromPoppler = await new Promise<string>((resolve) => {
    const child = spawn("pdftotext", ["-layout", "-enc", "UTF-8", "-", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk as Buffer));
    child.on("error", () => resolve(""));
    child.on("close", (code) => {
      resolve(code === 0 ? Buffer.concat(chunks).toString("utf8") : "");
    });
    child.stdin.on("error", () => resolve(""));
    child.stdin.end(buffer);
  });
  if (fromPoppler.trim()) return fromPoppler;
  return pdfToTextFallback(buffer);
}

export function extractCaseCandidates(text: string, invoiceNumber = "") {
  const hay = text.replace(/\r/g, "");
  const found = new Set<string>();
  const skip = fold(invoiceNumber);
  const add = (value?: string | null) => {
    const clean = (value ?? "").replace(/[.,;:]+$/g, "").trim();
    if (!clean || fold(clean) === skip) return;
    found.add(clean.toUpperCase());
  };
  for (const match of hay.matchAll(/\b([A-ZÆØÅ]{1,6}-\d{4}-\d{3,})\b/gi)) add(match[1]);
  for (const match of hay.matchAll(/\b(\d{4}-\d{3,5})\b/g)) add(match[1]);
  for (const match of hay.matchAll(/\b(?:sag|arbejdsseddel|ordre|reference)[:\s#/.-]*([A-Z0-9-]{3,})\b/gi)) add(match[1]);
  for (const match of hay.matchAll(/\b(\d{4,8})\s*\/\s*[A-Za-zÆØÅæøå]/g)) add(match[1]);
  for (const match of hay.matchAll(/\b(\d{5,8})\b/g)) add(match[1]);
  return [...found];
}

export function matchPurchaseCase(
  text: string,
  cases: PurchaseCaseHint[],
  opts?: { invoiceNumber?: string },
): PurchaseCaseHint | null {
  if (!cases.length) return null;
  const hay = fold(text);
  const candidates = extractCaseCandidates(text, opts?.invoiceNumber);
  const byNumber = new Map<string, PurchaseCaseHint[]>();
  for (const sag of cases) {
    const exact = fold(sag.caseNumber);
    const stripped = fold(sag.caseNumber.replace(/^0+/, "") || sag.caseNumber);
    const keys = [exact];
    if (stripped.length >= 4 && stripped !== exact) keys.push(stripped);
    for (const key of keys) {
      const list = byNumber.get(key) ?? [];
      list.push(sag);
      byNumber.set(key, list);
    }
  }
  for (const candidate of candidates) {
    const key = fold(candidate);
    const stripped = fold(candidate.replace(/^0+/, "") || candidate);
    const hits = [
      ...(byNumber.get(key) ?? []),
      ...(byNumber.get(stripped) ?? []),
      ...(/^\d{4}-\d{3,}$/.test(candidate)
        ? cases.filter((sag) => fold(sag.caseNumber).endsWith(`-${key}`))
        : []),
    ];
    const unique = [...new Map(hits.map((item) => [item.id, item])).values()];
    if (unique.length === 1) return unique[0];
  }

  const streetHits: PurchaseCaseHint[] = [];
  for (const sag of cases) {
    const street = (sag.customerAddress || "").trim().split(/[\s,]+/)[0] ?? "";
    const token = fold(street).replace(/[^a-z0-9]/g, "");
    if (token.length < 5) continue;
    if (new RegExp(`\\b${token}\\b`, "i").test(hay)) streetHits.push(sag);
  }
  const uniqueStreet = [...new Map(streetHits.map((item) => [item.id, item])).values()];
  if (uniqueStreet.length === 1) return uniqueStreet[0];

  const requisitionHits = cases.filter((sag) => {
    const req = (sag.requisition ?? "").trim();
    return req.length >= 4 && hay.includes(fold(req));
  });
  if (requisitionHits.length === 1) return requisitionHits[0];
  return null;
}

export function purchaseCaseReference(sag: PurchaseCaseHint) {
  const place = [sag.customerAddress, sag.customerCity].filter(Boolean).join(" ");
  return place ? `${sag.caseNumber}/${place}` : sag.caseNumber;
}
