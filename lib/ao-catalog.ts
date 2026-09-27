import { aoAuthedPost, canLoginAo, type AoCredentials } from "@/lib/ao-session";

export type { AoCredentials };

export type AoCatalogItem = {
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  url: string;
  imageUrl: string;
  costPrice: number;
  salePrice: number;
};

export type AoCatalogFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const AO_ORIGIN = "https://ao.dk";

export function isAoWholesaler(row: { name: string; excludedFromSearch?: boolean }) {
  if (row.excludedFromSearch) return false;
  return /\bao(?:\b|\s)|ao\s*johansen/i.test(row.name);
}

export function aoSearchEnabled(agreements: Array<{ name: string; excludedFromSearch?: boolean }>) {
  return agreements.some(isAoWholesaler);
}

function firstBarcode(value: unknown) {
  const raw = String(value ?? "");
  const parts = raw.split(/[|,;\s]+/).map((part) => part.replace(/\D/g, "")).filter((part) => part.length >= 8);
  return parts[0] ?? "";
}

function absoluteAoUrl(value: unknown) {
  const path = String(value ?? "").trim();
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${AO_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function aoImageUrl(raw: Record<string, unknown> | null | undefined) {
  if (!raw) return "";
  return absoluteAoUrl(
    raw.ImageUrlMedium ?? raw.ImageUrlSmall ?? raw.ImageUrlLarge ?? raw.imageUrl ?? raw.ImageUrl,
  );
}

function kronerToOre(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed * 100);
  }
  return 0;
}

function firstPrice(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const ore = kronerToOre(raw[key]);
    if (ore > 0) return ore;
  }
  return 0;
}

function asItem(raw: Record<string, unknown> | null | undefined): AoCatalogItem | null {
  if (!raw) return null;
  const sku = String(raw.Varenr ?? raw.ItemNumber ?? raw.itemNumber ?? "").trim();
  const name = String(raw.Name ?? raw.name ?? "").replace(/\s+/g, " ").trim();
  if (!sku || !name) return null;
  const unit = String(raw.Maalingsenhed ?? raw.MeasuringUnit ?? raw.itemunit ?? "stk").trim() || "stk";
  const costPrice = firstPrice(raw, ["Indkobspris", "Indkøbspris", "CostPrice", "NetPrice", "Nettopris"]);
  const salePrice =
    firstPrice(raw, ["Salgspris", "SalesPrice", "Price", "VeilPris", "VejlPris", "ListPrice"]) || costPrice;
  return {
    sku,
    barcode: firstBarcode(raw.EAN ?? raw.ean),
    name,
    unit: unit.toLowerCase(),
    url: absoluteAoUrl(raw.Url ?? raw.url) || `${AO_ORIGIN}/`,
    imageUrl: aoImageUrl(raw),
    costPrice,
    salePrice,
  };
}

async function readJson(response: Response) {
  if (!response.ok) return null;
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function aoGet(path: string, query: Record<string, string>, fetchImpl: AoCatalogFetch) {
  const url = new URL(path, AO_ORIGIN);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, value);
  }
  return fetchImpl(url, {
    headers: {
      Accept: "application/json",
      Referer: `${AO_ORIGIN}/`,
    },
    signal: AbortSignal.timeout(8_000),
  });
}

async function listPriceFor(sku: string, fetchImpl: AoCatalogFetch) {
  const payload = await readJson(await aoGet("/api/v2/ItemDetail/GetItemDetails", { productNumber: sku }, fetchImpl));
  if (!payload || typeof payload !== "object") return 0;
  const raw = payload as Record<string, unknown>;
  return firstPrice(raw, ["CampaignPrice", "Price", "Salgspris", "SalesPrice"]);
}

async function withListPrices(items: AoCatalogItem[], fetchImpl: AoCatalogFetch) {
  await Promise.all(
    items.map(async (item) => {
      if (item.salePrice > 0) return;
      const price = await listPriceFor(item.sku, fetchImpl);
      if (price > 0) item.salePrice = price;
    }),
  );
  return items;
}

export function applyAoNetPrice(item: AoCatalogItem, raw: Record<string, unknown>) {
  const costPrice = firstPrice(raw, ["DinPris", "Indkobspris", "Indkøbspris", "Nettopris", "NetPrice"]);
  const salePrice =
    firstPrice(raw, ["Udsalgspris"]) || firstPrice(raw, ["Listepris", "Salgspris", "SalesPrice", "Price"]) || costPrice;
  if (costPrice > 0) item.costPrice = costPrice;
  if (salePrice > 0) item.salePrice = salePrice;
  return item;
}

async function withNetPrices(items: AoCatalogItem[], fetchImpl: AoCatalogFetch, auth?: AoCredentials) {
  if (!items.length || !canLoginAo(auth) || !auth) return items;
  const payload = await aoAuthedPost(
    "/api/v2/Pris/HentPriserMedAvancer",
    items.map((item) => item.sku),
    auth,
    fetchImpl,
  );
  const rows = Array.isArray(payload) ? payload : [];
  const bySku = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const sku = String((row as { Varenr?: unknown }).Varenr ?? "").trim();
    if (sku) bySku.set(sku, row as Record<string, unknown>);
  }
  for (const item of items) {
    const row = bySku.get(item.sku);
    if (row) applyAoNetPrice(item, row);
  }
  return items;
}

export async function lookupAoProduct(
  code: string,
  opts: { fetch?: AoCatalogFetch; auth?: AoCredentials } = {},
): Promise<AoCatalogItem | null> {
  const query = code.trim();
  if (!query) return null;
  const fetchImpl = opts.fetch ?? fetch;
  const payload = await readJson(await aoGet("/api/v2/Produkt/GetSingleItemData", { productNumber: query }, fetchImpl));
  if (!payload || typeof payload !== "object" || "Message" in (payload as object)) return null;
  const item = asItem(payload as Record<string, unknown>);
  if (!item) return null;
  await withListPrices([item], fetchImpl);
  await withNetPrices([item], fetchImpl, opts.auth);
  return item;
}

export async function searchAoCatalog(
  query: string,
  opts: { fetch?: AoCatalogFetch; account?: string; auth?: AoCredentials; limit?: number } = {},
): Promise<AoCatalogItem[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const fetchImpl = opts.fetch ?? fetch;
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20);
  const items: AoCatalogItem[] = [];
  const seen = new Set<string>();

  const push = (item: AoCatalogItem | null) => {
    if (!item || seen.has(item.sku)) return;
    seen.add(item.sku);
    items.push(item);
  };

  if (/^\d{6,14}$/.test(term)) {
    push(await lookupAoProduct(term, { fetch: fetchImpl, auth: opts.auth }));
  }

  const payload = await readJson(
    await aoGet(
      "/api/v2/Soeg/QuickSearch",
      {
        q: term,
        a: "",
        start: "1",
        stop: String(limit),
        ...(opts.account ? { konto: opts.account } : {}),
      },
      fetchImpl,
    ),
  );
  const rows = payload && typeof payload === "object" ? (payload as { Produkter?: unknown }).Produkter : [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row && typeof row === "object") push(asItem(row as Record<string, unknown>));
    }
  }

  if (!items.length && /^\d{8,14}$/.test(term)) {
    push(await lookupAoProduct(term.replace(/^0+/, ""), { fetch: fetchImpl, auth: opts.auth }));
  }

  const page = items.slice(0, limit);
  await withListPrices(page, fetchImpl);
  await withNetPrices(page, fetchImpl, opts.auth);
  return page;
}
