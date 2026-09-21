import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type TenantRecord = {
  slug: string;
  name: string;
  dbFile: string;
  createdAt: string;
};

export type PlatformFile = {
  tenants: TenantRecord[];
  logins: Record<string, string>;
};

export function dataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const raw = process.env.DATABASE_URL || "file:./data/exempo.db";
  if (raw.startsWith("file:")) {
    const file = raw.slice("file:".length);
    const abs =
      path.isAbsolute(file) || /^[A-Za-z]:[\\/]/.test(file)
        ? file
        : path.resolve(/* turbopackIgnore: true */ process.cwd(), file);
    return path.dirname(abs);
  }
  return path.join(process.cwd(), "data");
}

export function defaultTenantSlug(): string {
  return process.env.DEFAULT_TENANT || "exempo";
}

export function defaultTenantDbFile(): string {
  const raw = process.env.DATABASE_URL || `file:${path.join(dataDir(), "exempo.db")}`;
  if (raw.startsWith("file:")) {
    const file = raw.slice("file:".length);
    return path.isAbsolute(file) || /^[A-Za-z]:[\\/]/.test(file)
      ? file
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), file);
  }
  return path.join(dataDir(), "exempo.db");
}

export function tenantDbFile(slug: string): string {
  if (slug === defaultTenantSlug()) return defaultTenantDbFile();
  return path.join(dataDir(), "tenants", `${slug}.db`);
}

export function tenantDatabaseUrl(slug: string): string {
  return `file:${tenantDbFile(slug).replaceAll("\\", "/")}`;
}

function platformPath(): string {
  return path.join(dataDir(), "platform.json");
}

function emptyPlatform(): PlatformFile {
  return { tenants: [], logins: {} };
}

export function readPlatform(): PlatformFile {
  const file = platformPath();
  if (!existsSync(file)) return emptyPlatform();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as PlatformFile;
    return {
      tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [],
      logins: parsed.logins && typeof parsed.logins === "object" ? parsed.logins : {},
    };
  } catch {
    return emptyPlatform();
  }
}

export function writePlatform(platform: PlatformFile) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(platformPath(), `${JSON.stringify(platform, null, 2)}\n`, "utf8");
}

export function getTenant(slug: string): TenantRecord | undefined {
  return readPlatform().tenants.find((tenant) => tenant.slug === slug);
}

export function lookupLogin(email: string): string | null {
  const slug = readPlatform().logins[email.trim().toLowerCase()];
  return slug || null;
}

export function registerLogin(email: string, slug: string) {
  const platform = readPlatform();
  platform.logins[email.trim().toLowerCase()] = slug;
  writePlatform(platform);
}

export function unregisterLogin(email: string) {
  const platform = readPlatform();
  delete platform.logins[email.trim().toLowerCase()];
  writePlatform(platform);
}

export function upsertTenant(record: TenantRecord) {
  const platform = readPlatform();
  const index = platform.tenants.findIndex((tenant) => tenant.slug === record.slug);
  if (index >= 0) platform.tenants[index] = record;
  else platform.tenants.push(record);
  writePlatform(platform);
}

export function ensureDefaultTenant(name = "Exempo") {
  const slug = defaultTenantSlug();
  const existing = getTenant(slug);
  if (existing) return existing;
  const record: TenantRecord = {
    slug,
    name,
    dbFile: defaultTenantDbFile(),
    createdAt: new Date().toISOString(),
  };
  upsertTenant(record);
  return record;
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
