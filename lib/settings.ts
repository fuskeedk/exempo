import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const SETTING_DEFAULTS: Record<string, string> = {
  company_name: "Exempo",
  company_cvr: "",
  company_address: "",
  company_postal: "",
  company_city: "",
  company_phone: "",
  company_email: "",
  company_domain: "",
  company_bank_name: "",
  company_bank_reg: "",
  company_bank_account: "",
  company_bank_iban: "",
  company_bank_swift: "",
  company_logo: "",
  case_number_prefix: "EX",
  case_number_year: "1",
  case_number_digits: "4",
  case_number_next: "1",
  quote_number_prefix: "TIL",
  quote_number_year: "1",
  quote_number_digits: "4",
  quote_number_next: "1",
  invoice_number_prefix: "FAK",
  invoice_number_year: "1",
  invoice_number_digits: "4",
  invoice_number_next: "1",
  sproom_enabled: "0",
  sproom_api_token: "",
  sproom_webhook_secret: "",
  payroll_provider: "",
  payroll_period_start_day: "20",
  payroll_period_end_day: "21",
  danlon_company_id: "",
  danlon_api_key: "",
  dataloen_company_id: "",
  dataloen_api_key: "",
  accounting_provider: "",
  economic_agreement_grant: "",
  economic_app_secret: "",
  billy_api_key: "",
  billy_org_id: "",
  dinero_api_key: "",
  dinero_org_id: "",
  dinero_client_id: "",
  dinero_client_secret: "",
  feature_product_catalog: "0",
  feature_van_stock: "0",
};

export const SECRET_SETTING_KEYS = new Set([
  "sproom_api_token",
  "sproom_webhook_secret",
  "danlon_api_key",
  "dataloen_api_key",
  "economic_agreement_grant",
  "economic_app_secret",
  "billy_api_key",
  "dinero_api_key",
  "dinero_client_secret",
]);

export async function getSettings(): Promise<Record<string, string>> {
  const map = { ...SETTING_DEFAULTS };
  try {
    const rows = await prisma.setting.findMany();
    for (const row of rows) map[row.key] = row.value;
  } catch {
    return map;
  }
  return map;
}

export async function getSetting(key: string): Promise<string> {
  const settings = await getSettings();
  return settings[key] ?? "";
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function setSettings(values: Record<string, string | undefined>, opts?: { keepSecrets?: boolean }) {
  for (const [key, raw] of Object.entries(values)) {
    if (raw === undefined) continue;
    if (opts?.keepSecrets && SECRET_SETTING_KEYS.has(key) && raw.trim() === "") continue;
    await setSetting(key, raw);
  }
}

export function newWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

export function settingFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "on";
}

export function productCatalogEnabled(settings: Record<string, string> = {}) {
  return settingFlag(settings.feature_product_catalog);
}

export function vanStockEnabled(settings: Record<string, string> = {}) {
  return settingFlag(settings.feature_van_stock) && productCatalogEnabled(settings);
}

export function formFlag(formData: FormData, key: string) {
  return formData.getAll(key).some((value) => settingFlag(String(value)));
}
