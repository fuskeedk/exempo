export type AoCatalogItem = {
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  url: string;
  imageUrl: string;
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

function asItem(raw: Record<string, unknown> | null | undefined): AoCatalogItem | null {
  if (!raw) return null;
  const sku = String(raw.Varenr ?? raw.ItemNumber ?? raw.itemNumber ?? "").trim();
  const name = String(raw.Name ?? raw.name ?? "").replace(/\s+/g, " ").trim();
  if (!sku || !name) return null;
  const unit = String(raw.Maalingsenhed ?? raw.MeasuringUnit ?? raw.itemunit ?? "stk").trim() || "stk";
  return {
    sku,
    barcode: firstBarcode(raw.EAN ?? raw.ean),
    name,
    unit: unit.toLowerCase(),
    url: absoluteAoUrl(raw.Url ?? raw.url) || `${AO_ORIGIN}/`,
    imageUrl: aoImageUrl(raw),
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

export async function lookupAoProduct(
  code: string,
  opts: { fetch?: AoCatalogFetch } = {},
): Promise<AoCatalogItem | null> {
  const query = code.trim();
  if (!query) return null;
  const fetchImpl = opts.fetch ?? fetch;
  const payload = await readJson(await aoGet("/api/v2/Produkt/GetSingleItemData", { productNumber: query }, fetchImpl));
  if (!payload || typeof payload !== "object" || "Message" in (payload as object)) return null;
  return asItem(payload as Record<string, unknown>);
}

export async function searchAoCatalog(
  query: string,
  opts: { fetch?: AoCatalogFetch; account?: string; limit?: number } = {},
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
    push(await lookupAoProduct(term, { fetch: fetchImpl }));
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
    push(await lookupAoProduct(term.replace(/^0+/, ""), { fetch: fetchImpl }));
  }

  return items.slice(0, limit);
}
