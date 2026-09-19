const dkk = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const dkkExact = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Amounts are stored in øre. */
export function formatKr(ore: number, exact = false): string {
  const kr = ore / 100;
  return exact ? dkkExact.format(kr) : dkk.format(kr);
}

export function parseKrToOre(input: string): number {
  const normalized = input.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

export function percent(value: number): string {
  return `${Math.round(value * 1000) / 10} %`.replace(".", ",");
}

export const VAT_RATE = 0.25;
