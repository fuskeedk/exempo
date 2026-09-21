import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, defaultTenantSlug, getTenant } from "@/lib/platform";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};

export function logoExtension(mime: string, filename = "") {
  const fromMime = MIME_EXT[mime.toLowerCase()];
  if (fromMime) return fromMime;
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return null;
}

export function logoMime(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export function knownTenantSlug(slug: string) {
  const clean = slug.trim().toLowerCase();
  if (!clean) return "";
  if (clean === defaultTenantSlug() || getTenant(clean)) return clean;
  return "";
}

function logosRoot() {
  return path.join(dataDir(), "logos");
}

function tenantLogoDir(slug: string) {
  return path.join(logosRoot(), slug);
}

export function companyLogoSrc(slug: string, version = "") {
  if (!slug || !version) return "";
  return `/api/firma-logo/${encodeURIComponent(slug)}?v=${encodeURIComponent(version)}`;
}

export function companyLogoAbsoluteUrl(origin: string, slug: string, version = "") {
  const rel = companyLogoSrc(slug, version);
  if (!rel) return "";
  return `${origin.replace(/\/$/, "")}${rel}`;
}

export async function readCompanyLogo(slug: string, filename: string) {
  const tenant = knownTenantSlug(slug);
  const safe = path.basename(filename);
  if (!tenant || !safe || safe !== filename || safe.includes("..")) return null;
  const file = path.join(tenantLogoDir(tenant), safe);
  try {
    const data = await readFile(file);
    return { data, mime: logoMime(safe), filename: safe };
  } catch {
    return null;
  }
}

async function clearTenantLogos(slug: string) {
  const dir = tenantLogoDir(slug);
  try {
    const files = await readdir(dir);
    await Promise.all(files.map((file) => unlink(path.join(dir, file)).catch(() => undefined)));
  } catch {
    /* no previous logo */
  }
}

export async function saveCompanyLogo(slug: string, file: File) {
  const tenant = knownTenantSlug(slug);
  if (!tenant) throw new Error("Ukendt virksomhed.");
  if (file.size > LOGO_MAX_BYTES) throw new Error("Logoet må højst være 2 MB.");
  const ext = logoExtension(file.type, file.name);
  if (!ext) throw new Error("Logoet skal være PNG, JPG eller WebP.");
  const filename = `logo-${Date.now()}${ext}`;
  const dir = tenantLogoDir(tenant);
  await mkdir(dir, { recursive: true });
  await clearTenantLogos(tenant);
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return filename;
}

export async function removeCompanyLogo(slug: string) {
  const tenant = knownTenantSlug(slug);
  if (!tenant) return;
  await clearTenantLogos(tenant);
}
