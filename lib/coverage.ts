export type EconomicsInput = {
  estimatedRevenue: number;
  invoices: { status: string; lines: { quantity: number; unitPrice: number }[] }[];
  timeEntries: { hours: number; hourlyRate: number }[];
  materials: { quantity: number; unitPrice: number }[];
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

export function caseEconomics(input: EconomicsInput): CaseEconomics {
  const billed = input.invoices
    .filter((invoice) => invoice.status === "SENDT" || invoice.status === "BETALT")
    .reduce((sum, invoice) => sum + invoiceNet(invoice.lines), 0);

  const usingEstimate = billed === 0;
  const revenue = usingEstimate ? input.estimatedRevenue : billed;
  const laborCost = Math.round(
    input.timeEntries.reduce((sum, entry) => sum + entry.hours * entry.hourlyRate, 0),
  );
  const materialCost = Math.round(
    input.materials.reduce((sum, material) => sum + material.quantity * material.unitPrice, 0),
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
