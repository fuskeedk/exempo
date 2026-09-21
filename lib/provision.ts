import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { SETTING_DEFAULTS, newWebhookSecret } from "@/lib/settings";
import {
  dataDir,
  ensureDefaultTenant,
  registerLogin,
  tenantDbFile,
  upsertTenant,
} from "@/lib/platform";
import { tenantPrisma } from "@/lib/prisma";
import { isValidSlug } from "@/lib/serial";
import { seedWholesalerAgreements } from "@/lib/wholesalers";
import { ensureDefaultKlsTemplates } from "@/lib/kls-catalog";
import { seedAgreements } from "@/lib/payroll-store";

function prismaBin() {
  return path.join(process.cwd(), "node_modules", ".bin", "prisma");
}

export function pushTenantSchema(dbFile: string) {
  mkdirSync(path.dirname(dbFile), { recursive: true });
  execFileSync(prismaBin(), ["db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${dbFile.replaceAll("\\", "/")}` },
    stdio: "pipe",
  });
}

export function ensureTemplateDb(): string {
  const file = path.join(dataDir(), "tenant-template.db");
  if (!existsSync(file)) {
    pushTenantSchema(file);
  }
  return file;
}

export async function provisionTenant(input: {
  slug: string;
  name: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  casePrefix?: string;
  caseIncludeYear?: boolean;
  caseDigits?: number;
}) {
  const slug = input.slug.trim().toLowerCase();
  if (!isValidSlug(slug)) {
    throw new Error("Vælg et kort firmanavn uden mellemrum (fx nordbyg).");
  }
  ensureDefaultTenant();
  const dbFile = tenantDbFile(slug);
  if (existsSync(dbFile)) {
    throw new Error("Virksomheden findes allerede.");
  }

  const template = ensureTemplateDb();
  mkdirSync(path.dirname(dbFile), { recursive: true });
  copyFileSync(template, dbFile);
  pushTenantSchema(dbFile);

  const db = tenantPrisma(slug);
  const email = input.adminEmail.trim().toLowerCase();
  await db.user.create({
    data: {
      name: input.adminName.trim(),
      email,
      passwordHash: await bcrypt.hash(input.adminPassword, 10),
      role: "ADMIN",
      trade: "ADMINISTRATION",
    },
  });

  const prefix = input.casePrefix ?? "";
  const includeYear = input.caseIncludeYear ?? false;
  const digits = String(input.caseDigits ?? 5);
  await db.setting.createMany({
    data: Object.entries({
      ...SETTING_DEFAULTS,
      company_name: input.name.trim(),
      company_email: email,
      sproom_webhook_secret: newWebhookSecret(),
      case_number_prefix: prefix,
      case_number_year: includeYear ? "1" : "0",
      case_number_digits: digits,
      quote_number_prefix: prefix ? "TIL" : "",
      quote_number_year: includeYear ? "1" : "0",
      quote_number_digits: digits,
      invoice_number_prefix: prefix ? "FAK" : "",
      invoice_number_year: includeYear ? "1" : "0",
      invoice_number_digits: digits,
    }).map(([key, value]) => ({ key, value })),
  });

  upsertTenant({
    slug,
    name: input.name.trim(),
    dbFile,
    createdAt: new Date().toISOString(),
  });
  registerLogin(email, slug);
  await seedWholesalerAgreements(db);
  await seedAgreements(db);
  await ensureDefaultKlsTemplates(db);
  return { slug, email };
}
