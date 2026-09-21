import { format } from "date-fns";
import { da } from "date-fns/locale";
import { invoiceNet } from "@/lib/coverage";
import { parseDayParam, startOfDay, toDateInput } from "@/lib/dates";

export const REVENUE_PERIODS = [
  { value: "12m", label: "Seneste 12 mdr." },
  { value: "year", label: "Dette år" },
  { value: "last-year", label: "Sidste år" },
  { value: "month", label: "Denne måned" },
  { value: "last-month", label: "Forrige måned" },
  { value: "custom", label: "Valgt periode" },
] as const;
export type RevenuePeriod = (typeof REVENUE_PERIODS)[number]["value"];

const BILLED_STATUSES = new Set(["SENDT", "BETALT", "RYKKET", "INKASSO"]);
const COST_PURCHASE_STATUSES = new Set(["GODKENDT", "DRIFT"]);

export function parseRevenuePeriod(value?: string): RevenuePeriod {
  return REVENUE_PERIODS.some((period) => period.value === value)
    ? (value as RevenuePeriod)
    : "12m";
}

export function revenueRange(
  period: RevenuePeriod,
  from?: string,
  to?: string,
  today = new Date(),
): { start: Date; end: Date } {
  const now = startOfDay(today);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (period === "year") {
    return { start: new Date(now.getFullYear(), 0, 1), end: endOfToday };
  }
  if (period === "last-year") {
    return {
      start: new Date(now.getFullYear() - 1, 0, 1),
      end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
    };
  }
  if (period === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfToday };
  }
  if (period === "last-month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === "custom") {
    const start = parseDayParam(from);
    const endDay = parseDayParam(to);
    endDay.setHours(23, 59, 59, 999);
    if (endDay < start) return { start: endDay, end: new Date(start.getTime() + 86_399_999) };
    return { start, end: endDay };
  }

  return {
    start: new Date(now.getFullYear(), now.getMonth() - 11, 1),
    end: endOfToday,
  };
}

export function revenueRangeInputs(period: RevenuePeriod, today = new Date()) {
  const { start, end } = revenueRange(period === "custom" ? "12m" : period, undefined, undefined, today);
  return { fra: toDateInput(start), til: toDateInput(end) };
}

export function isBilledInvoice(status: string) {
  return BILLED_STATUSES.has(status);
}

export function isCostPurchase(status: string) {
  return COST_PURCHASE_STATUSES.has(status);
}

export function invoiceSignedNet(invoice: {
  kind: string;
  lines: { quantity: number; unitPrice: number }[];
}) {
  const net = invoiceNet(invoice.lines);
  return invoice.kind === "KREDITNOTA" ? -Math.abs(net) : net;
}

export type RevenueMonth = {
  key: string;
  label: string;
  invoices: number;
  cashflow: number;
  costs: number;
  contribution: number;
};

export type RevenueTotals = {
  invoiced: number;
  cashflow: number;
  costs: number;
  contribution: number;
  coverage: number | null;
  unrelated: number;
  months: RevenueMonth[];
};

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function revenueMonths(start: Date, end: Date): RevenueMonth[] {
  const months: RevenueMonth[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push({
      key: monthKey(cursor),
      label: format(cursor, "MMM", { locale: da }).replace(".", ""),
      invoices: 0,
      cashflow: 0,
      costs: 0,
      contribution: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function inRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function aggregateRevenue(input: {
  start: Date;
  end: Date;
  invoices: {
    status: string;
    kind: string;
    issuedAt: Date;
    paidAt: Date | null;
    net: number;
  }[];
  costs: { date: Date; amount: number }[];
  unrelated: { date: Date; amount: number }[];
}): RevenueTotals {
  const months = revenueMonths(input.start, input.end);
  const byKey = new Map(months.map((month) => [month.key, month]));

  let invoiced = 0;
  let cashflow = 0;
  for (const invoice of input.invoices) {
    if (!isBilledInvoice(invoice.status)) continue;
    if (inRange(invoice.issuedAt, input.start, input.end)) {
      invoiced += invoice.net;
      const month = byKey.get(monthKey(invoice.issuedAt));
      if (month) month.invoices += invoice.net;
    }
    const paidAt = invoice.paidAt ?? (invoice.status === "BETALT" ? invoice.issuedAt : null);
    if (paidAt && inRange(paidAt, input.start, input.end)) {
      cashflow += invoice.net;
      const month = byKey.get(monthKey(paidAt));
      if (month) month.cashflow += invoice.net;
    }
  }

  let costs = 0;
  for (const cost of input.costs) {
    if (!inRange(cost.date, input.start, input.end)) continue;
    costs += cost.amount;
    const month = byKey.get(monthKey(cost.date));
    if (month) month.costs += cost.amount;
  }

  let unrelated = 0;
  for (const row of input.unrelated) {
    if (!inRange(row.date, input.start, input.end)) continue;
    unrelated += row.amount;
  }

  for (const month of months) {
    month.contribution = month.invoices - month.costs;
  }

  const contribution = invoiced - costs;
  return {
    invoiced,
    cashflow,
    costs,
    contribution,
    coverage: invoiced === 0 ? null : contribution / invoiced,
    unrelated,
    months,
  };
}

export function materialCostOre(material: { quantity: number; unitPrice: number; costPrice?: number | null }) {
  const unit =
    material.costPrice && material.costPrice > 0 ? material.costPrice : material.unitPrice;
  return Math.round(material.quantity * unit);
}

export function laborCostOre(entry: { hours: number; hourlyRate: number }) {
  return Math.round(entry.hours * entry.hourlyRate);
}
