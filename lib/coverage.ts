export type EconomicsInput = {
  estimatedRevenue: number;
  invoices: { status: string; lines: { quantity: number; unitPrice: number }[] }[];
  timeEntries: { hours: number; hourlyRate: number }[];
  materials: { quantity: number; unitPrice: number; costPrice?: number }[];
};

export type CaseEconomics = {
  revenue: number;
  billed: number;
  laborCost: number;
  materialCost: number;
  cost: number;
  contribution: number;
  coverage: number | null;
  usingEstimate: boolean;
};

export function invoiceNet(
  lines: { quantity: number; unitPrice: number }[],
): number {
  return Math.round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
}

export function quoteEconomics(
  lines: { quantity: number; unitPrice: number; costPrice: number }[],
): { sale: number; cost: number; coverage: number | null } {
  const sale = Math.round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const cost = Math.round(lines.reduce((sum, line) => sum + line.quantity * line.costPrice, 0));
  return { sale, cost, coverage: sale === 0 ? null : (sale - cost) / sale };
}

export function caseEconomics(input: EconomicsInput): CaseEconomics {
  const billed = input.invoices
    .filter((invoice) => invoice.status === "SENDT" || invoice.status === "BETALT" || invoice.status === "RYKKET" || invoice.status === "INKASSO")
    .reduce((sum, invoice) => sum + invoiceNet(invoice.lines), 0);

  const usingEstimate = billed === 0;
  const revenue = usingEstimate ? input.estimatedRevenue : billed;
  const laborCost = Math.round(
    input.timeEntries.reduce((sum, entry) => sum + entry.hours * entry.hourlyRate, 0),
  );
  const materialCost = Math.round(
    input.materials.reduce((sum, material) => {
      const unitCost =
        material.costPrice && material.costPrice > 0 ? material.costPrice : material.unitPrice;
      return sum + material.quantity * unitCost;
    }, 0),
  );
  const cost = laborCost + materialCost;
  const contribution = revenue - cost;
  const coverage = revenue === 0 ? null : contribution / revenue;

  return {
    revenue,
    billed,
    laborCost,
    materialCost,
    cost,
    contribution,
    coverage,
    usingEstimate,
  };
}

export function billedInvoiceNet(
  invoices: { status: string; lines: { quantity: number; unitPrice: number }[] }[],
): number {
  return invoices
    .filter((invoice) =>
      invoice.status === "SENDT" ||
      invoice.status === "BETALT" ||
      invoice.status === "RYKKET" ||
      invoice.status === "INKASSO",
    )
    .reduce((sum, invoice) => sum + invoiceNet(invoice.lines), 0);
}

export type ComposeInvoiceLine = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function composeInvoiceOffer(input: {
  caseNumber: string;
  title: string;
  estimatedRevenue: number;
  pricingMode: string;
  invoices: { status: string; lines: { quantity: number; unitPrice: number }[] }[];
  timeEntries: { hours: number; hourlyRate: number; billable?: boolean }[];
  materials: { name: string; quantity: number; unitPrice: number; billable?: boolean }[];
  extras: { title: string; amount: number; status: string }[];
}): { remaining: number; label: string; lines: ComposeInvoiceLine[] } {
  const billed = billedInvoiceNet(input.invoices);
  const extras = input.extras
    .filter((extra) => extra.status === "GODKENDT" && extra.amount)
    .map((extra) => ({
      description: `Ekstraarbejde: ${extra.title}`,
      quantity: 1,
      unitPrice: extra.amount,
    }));

  const consumption: ComposeInvoiceLine[] = [];
  if (input.pricingMode === "FORBRUG") {
    const labor = Math.round(
      input.timeEntries
        .filter((entry) => entry.billable !== false)
        .reduce((sum, entry) => sum + entry.hours * entry.hourlyRate, 0),
    );
    const materials = Math.round(
      input.materials
        .filter((material) => material.billable !== false)
        .reduce((sum, material) => sum + material.quantity * material.unitPrice, 0),
    );
    if (labor) consumption.push({ description: "Arbejdsløn efter forbrug", quantity: 1, unitPrice: labor });
    if (materials) consumption.push({ description: "Materialer efter forbrug", quantity: 1, unitPrice: materials });
  }

  const orderAmount =
    input.pricingMode === "FORBRUG"
      ? invoiceNet(consumption) + invoiceNet(extras)
      : input.estimatedRevenue + invoiceNet(extras);
  const remaining = Math.max(0, orderAmount - billed);
  const label = `${input.caseNumber}: ${input.title}`;
  const lines: ComposeInvoiceLine[] =
    input.pricingMode === "FORBRUG" && consumption.length
      ? [...consumption, ...extras]
      : [{ description: label, quantity: 1, unitPrice: remaining }, ...extras];

  if (!lines.length) {
    lines.push({ description: label, quantity: 1, unitPrice: remaining });
  } else if (input.pricingMode !== "FORBRUG") {
    lines[0] = { description: label, quantity: 1, unitPrice: remaining };
  }

  return { remaining, label, lines };
}

export function rollupEconomics(rows: CaseEconomics[]): CaseEconomics {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const billed = rows.reduce((sum, row) => sum + row.billed, 0);
  const laborCost = rows.reduce((sum, row) => sum + row.laborCost, 0);
  const materialCost = rows.reduce((sum, row) => sum + row.materialCost, 0);
  const cost = laborCost + materialCost;
  const contribution = revenue - cost;
  return {
    revenue,
    billed,
    laborCost,
    materialCost,
    cost,
    contribution,
    coverage: revenue === 0 ? null : contribution / revenue,
    usingEstimate: billed === 0,
  };
}
