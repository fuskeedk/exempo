import { prisma } from "@/lib/prisma";
import { formatSerial } from "@/lib/serial";
import { getSettings, setSetting } from "@/lib/settings";

type Kind = "case" | "quote" | "invoice";

function keys(kind: Kind) {
  return {
    prefix: `${kind}_number_prefix`,
    year: `${kind}_number_year`,
    digits: `${kind}_number_digits`,
    next: `${kind}_number_next`,
  } as const;
}

async function exists(kind: Kind, value: string): Promise<boolean> {
  if (kind === "case") return Boolean(await prisma.case.findUnique({ where: { caseNumber: value } }));
  if (kind === "quote") return Boolean(await prisma.quote.findUnique({ where: { quoteNumber: value } }));
  return Boolean(await prisma.invoice.findUnique({ where: { invoiceNumber: value } }));
}

export async function nextSerial(kind: Kind, now = new Date()): Promise<string> {
  const settings = await getSettings();
  const k = keys(kind);
  const prefix = settings[k.prefix] ?? "";
  const includeYear = settings[k.year] !== "0";
  const digits = Number.parseInt(settings[k.digits] || "4", 10);
  let n = Number.parseInt(settings[k.next] || "1", 10);
  if (!Number.isFinite(n) || n < 1) n = 1;

  let candidate = formatSerial({ prefix, includeYear, digits, n, year: now.getFullYear() });
  while (await exists(kind, candidate)) {
    n += 1;
    candidate = formatSerial({ prefix, includeYear, digits, n, year: now.getFullYear() });
  }
  await setSetting(k.next, String(n + 1));
  return candidate;
}

export function nextCaseNumber(now = new Date()) {
  return nextSerial("case", now);
}

export function nextQuoteNumber(now = new Date()) {
  return nextSerial("quote", now);
}

export async function peekQuoteNumber(now = new Date()) {
  const settings = await getSettings();
  const prefix = settings.quote_number_prefix ?? "";
  const includeYear = settings.quote_number_year !== "0";
  const digits = Number.parseInt(settings.quote_number_digits || "4", 10);
  let n = Number.parseInt(settings.quote_number_next || "1", 10);
  if (!Number.isFinite(n) || n < 1) n = 1;
  let candidate = formatSerial({ prefix, includeYear, digits, n, year: now.getFullYear() });
  while (await exists("quote", candidate)) {
    n += 1;
    candidate = formatSerial({ prefix, includeYear, digits, n, year: now.getFullYear() });
  }
  return candidate;
}

export function nextInvoiceNumber(now = new Date()) {
  return nextSerial("invoice", now);
}
