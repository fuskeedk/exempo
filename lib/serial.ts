export type SerialOptions = {
  prefix: string;
  includeYear: boolean;
  digits: number;
  n: number;
  year: number;
};

export function formatSerial({ prefix, includeYear, digits, n, year }: SerialOptions): string {
  const width = Number.isFinite(digits) && digits > 0 ? Math.min(8, Math.floor(digits)) : 4;
  const num = String(Math.max(1, Math.floor(n))).padStart(width, "0");
  const parts: string[] = [];
  const cleanPrefix = prefix.trim().replace(/-+$/g, "");
  if (cleanPrefix) parts.push(cleanPrefix);
  if (includeYear) parts.push(String(year));
  parts.push(num);
  return parts.join("-");
}

export function slugifyCompany(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,31}$/.test(slug);
}
