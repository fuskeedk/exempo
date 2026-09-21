"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireSession } from "@/lib/auth";
import { MAIL_PURPOSE_LABELS } from "@/lib/catalog";
import { buildMailTestMessage, mailProfileFromAccount, parseMailAccountInput, sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { isEmail } from "@/lib/quote-email";
import { formatSerial } from "@/lib/serial";
import { formFlag, getSettings, SECRET_SETTING_KEYS, setSetting, setSettings } from "@/lib/settings";
import { lookupLogin, registerLogin, unregisterLogin } from "@/lib/platform";
import { removeCompanyLogo, saveCompanyLogo } from "@/lib/logo";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function revalidateSettings() {
  revalidatePath("/indstillinger");
  revalidatePath("/administration");
  revalidatePath("/indkob");
  revalidatePath("/fakturaer");
  revalidatePath("/tilbud");
  revalidatePath("/", "layout");
}

function settingsRedirect(message: string, extra: { error?: boolean; hash?: string } = {}): never {
  const key = extra.error ? "fejl" : "besked";
  const hash = extra.hash ? `#${extra.hash}` : "";
  redirect(`/indstillinger?${key}=${encodeURIComponent(message)}${hash}`);
}

function mailFields(formData: FormData) {
  return {
    name: str(formData, "name"),
    address: str(formData, "address"),
    purpose: str(formData, "purpose"),
    smtpHost: str(formData, "smtpHost"),
    smtpPort: str(formData, "smtpPort"),
    smtpUser: str(formData, "smtpUser"),
    smtpPassword: str(formData, "smtpPassword"),
    smtpEncryption: str(formData, "smtpEncryption"),
    imapHost: str(formData, "imapHost"),
    imapPort: str(formData, "imapPort"),
    imapUser: str(formData, "imapUser"),
    imapPassword: str(formData, "imapPassword"),
    imapFolder: str(formData, "imapFolder"),
  };
}

export async function saveCompanySettingsAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  await setSettings({
    company_name: str(formData, "company_name"),
    company_cvr: str(formData, "company_cvr"),
    company_address: str(formData, "company_address"),
    company_postal: str(formData, "company_postal"),
    company_city: str(formData, "company_city"),
    company_phone: str(formData, "company_phone"),
    company_email: str(formData, "company_email"),
    company_domain: str(formData, "company_domain"),
    company_bank_name: str(formData, "company_bank_name"),
    company_bank_reg: str(formData, "company_bank_reg"),
    company_bank_account: str(formData, "company_bank_account"),
    company_bank_iban: str(formData, "company_bank_iban"),
    company_bank_swift: str(formData, "company_bank_swift"),
  });
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    try {
      const filename = await saveCompanyLogo(session.tenantSlug, logo);
      await setSetting("company_logo", filename);
    } catch (error) {
      settingsRedirect(error instanceof Error ? error.message : "Logoet kunne ikke gemmes.");
    }
  }
  revalidateSettings();
  settingsRedirect("Virksomhedsoplysninger er gemt.");
}

export async function saveModulesSettingsAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const van = formFlag(formData, "feature_van_stock");
  const catalog = formFlag(formData, "feature_product_catalog") || van;
  await setSettings({
    feature_product_catalog: catalog ? "1" : "0",
    feature_van_stock: van ? "1" : "0",
  });
  revalidatePath("/");
  revalidatePath("/min-dag");
  revalidatePath("/sager");
  revalidatePath("/varer");
  revalidatePath("/vognlager");
  revalidateSettings();
  settingsRedirect("Modulerne er gemt.", { hash: "moduler" });
}

export async function removeCompanyLogoAction() {
  const session = await requireRole(["ADMIN", "PL"]);
  await removeCompanyLogo(session.tenantSlug);
  await setSetting("company_logo", "");
  revalidateSettings();
  settingsRedirect("Firmalogoet er fjernet.");
}

export async function saveNumberSettingsAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const casePrefix = str(formData, "case_number_prefix");
  const caseYear = str(formData, "case_number_year") === "1" ? "1" : "0";
  const caseDigits = str(formData, "case_number_digits") || "5";
  const caseNext = str(formData, "case_number_next") || "1";
  await setSettings({
    case_number_prefix: casePrefix,
    case_number_year: caseYear,
    case_number_digits: caseDigits,
    case_number_next: caseNext,
    quote_number_prefix: str(formData, "quote_number_prefix"),
    quote_number_year: str(formData, "quote_number_year") === "1" ? "1" : "0",
    quote_number_digits: str(formData, "quote_number_digits") || caseDigits,
    quote_number_next: str(formData, "quote_number_next") || "1",
    invoice_number_prefix: str(formData, "invoice_number_prefix"),
    invoice_number_year: str(formData, "invoice_number_year") === "1" ? "1" : "0",
    invoice_number_digits: str(formData, "invoice_number_digits") || caseDigits,
    invoice_number_next: str(formData, "invoice_number_next") || "1",
  });
  revalidateSettings();
  const preview = formatSerial({
    prefix: casePrefix,
    includeYear: caseYear === "1",
    digits: Number.parseInt(caseDigits, 10),
    n: Number.parseInt(caseNext, 10) || 1,
    year: new Date().getFullYear(),
  });
  settingsRedirect(`Nummerserier gemt. Næste sag bliver ${preview}.`);
}

export async function saveSproomSettingsAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  await setSettings(
    {
      sproom_enabled: str(formData, "sproom_enabled") === "1" ? "1" : "0",
      sproom_api_token: str(formData, "sproom_api_token"),
      sproom_webhook_secret: str(formData, "sproom_webhook_secret"),
    },
    { keepSecrets: true },
  );
  revalidateSettings();
  settingsRedirect("Sproom-opsætning er gemt.");
}

export async function savePayrollSettingsAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  await setSettings(
    {
      payroll_provider: str(formData, "payroll_provider"),
      payroll_period_start_day: String(Math.max(1, Math.min(28, Number.parseInt(str(formData, "payroll_period_start_day"), 10) || 20))),
      payroll_period_end_day: String(Math.max(1, Math.min(28, Number.parseInt(str(formData, "payroll_period_end_day"), 10) || 21))),
      danlon_company_id: str(formData, "danlon_company_id"),
      danlon_api_key: str(formData, "danlon_api_key"),
      dataloen_company_id: str(formData, "dataloen_company_id"),
      dataloen_api_key: str(formData, "dataloen_api_key"),
    },
    { keepSecrets: true },
  );
  revalidatePath("/timesedler");
  revalidatePath("/lon");
  revalidateSettings();
  settingsRedirect("Lønperioden og integrationen er gemt.", { hash: "lon" });
}

export async function saveAccountingSettingsAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  await setSettings(
    {
      accounting_provider: str(formData, "accounting_provider"),
      economic_agreement_grant: str(formData, "economic_agreement_grant"),
      economic_app_secret: str(formData, "economic_app_secret"),
      billy_api_key: str(formData, "billy_api_key"),
      billy_org_id: str(formData, "billy_org_id"),
      dinero_api_key: str(formData, "dinero_api_key"),
      dinero_org_id: str(formData, "dinero_org_id"),
      dinero_client_id: str(formData, "dinero_client_id"),
      dinero_client_secret: str(formData, "dinero_client_secret"),
    },
    { keepSecrets: true },
  );
  revalidateSettings();
  settingsRedirect("Bogførings-integration er gemt.");
}

export async function testIntegrationAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const kind = str(formData, "kind");
  const settings = await getSettings();
  const filled = (key: string) => Boolean(settings[key]);
  const messages: Record<string, string> = {
    sproom: filled("sproom_api_token")
      ? "Sproom-nøglen er gemt. Nye e-fakturaer lander under Indkøb via webhook eller 'Hent fra Sproom'."
      : "Udfyld Sproom API-token, før forbindelsen kan testes.",
    danlon: filled("danlon_api_key") && filled("danlon_company_id")
      ? "Danløn-nøgler er gemt. Timer eksporteres, når lønkørslen startes."
      : "Udfyld virksomheds-id og API-nøgle til Danløn.",
    dataloen: filled("dataloen_api_key") && filled("dataloen_company_id")
      ? "Dataløn-nøgler er gemt."
      : "Udfyld virksomheds-id og API-nøgle til Dataløn.",
    economic: filled("economic_agreement_grant") && filled("economic_app_secret")
      ? "E-conomic-nøgler er gemt. Fakturaer kan bogføres derfra."
      : "Udfyld aftale-token og app secret til e-conomic.",
    billy: filled("billy_api_key")
      ? "Billy-nøglen er gemt."
      : "Udfyld Billy API-nøgle.",
    dinero: filled("dinero_api_key") && filled("dinero_org_id")
      ? "Dinero-nøgler er gemt."
      : "Udfyld organisations-id og API-nøgle til Dinero.",
  };
  settingsRedirect(messages[kind] ?? "Ukendt integration.");
}

export async function updateProfileAction(formData: FormData) {
  const session = await requireSession();
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const phone = str(formData, "phone");
  const password = str(formData, "password");
  if (!name || !email) throw new Error("Navn og e-mail er påkrævet.");

  const taken = await prisma.user.findFirst({ where: { email, NOT: { id: session.id } } });
  if (taken) throw new Error("E-mail er allerede i brug i virksomheden.");
  const otherTenant = lookupLogin(email);
  if (otherTenant && otherTenant !== session.tenantSlug) {
    throw new Error("E-mailen bruges allerede af en anden virksomhed.");
  }

  await prisma.user.update({
    where: { id: session.id },
    data: {
      name,
      email,
      phone,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });
  if (email !== session.email) {
    unregisterLogin(session.email);
    registerLogin(email, session.tenantSlug);
  }
  revalidateSettings();
  settingsRedirect("Din bruger er opdateret. Log evt. ind igen, hvis e-mailen er ændret.");
}

export async function createMailAccountAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const parsed = parseMailAccountInput(mailFields(formData));
  if ("error" in parsed) settingsRedirect(parsed.error, { error: true, hash: "mail" });
  const taken = await prisma.mailAccount.findFirst({ where: { address: parsed.data.address } });
  if (taken) settingsRedirect("Adressen er allerede oprettet.", { error: true, hash: "mail" });
  await prisma.mailAccount.create({ data: parsed.data });
  revalidateSettings();
  settingsRedirect(`Mailkontoen ${parsed.data.address} er tilføjet.`, { hash: "mail" });
}

export async function updateMailAccountAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const existing = id ? await prisma.mailAccount.findUnique({ where: { id } }) : null;
  if (!existing) settingsRedirect("Mailkontoen findes ikke.", { error: true, hash: "mail" });
  const parsed = parseMailAccountInput(mailFields(formData), existing);
  if ("error" in parsed) settingsRedirect(parsed.error, { error: true, hash: "mail" });
  const taken = await prisma.mailAccount.findFirst({
    where: { address: parsed.data.address, NOT: { id: existing.id } },
  });
  if (taken) settingsRedirect("Adressen er allerede oprettet.", { error: true, hash: "mail" });
  await prisma.mailAccount.update({ where: { id: existing.id }, data: parsed.data });
  revalidateSettings();
  settingsRedirect(`Mailkontoen ${parsed.data.address} er gemt.`, { hash: "mail" });
}

export async function sendTestMailAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const to = (str(formData, "to") || session.email).trim().toLowerCase();
  if (!id) settingsRedirect("Vælg en mailkonto at teste.", { error: true, hash: "mail" });
  if (!isEmail(to)) settingsRedirect("Skriv en gyldig e-mail at sende testen til.", { error: true, hash: "mail" });

  const [account, settings] = await Promise.all([
    prisma.mailAccount.findUnique({ where: { id } }),
    getSettings(),
  ]);
  if (!account) settingsRedirect("Mailkontoen findes ikke.", { error: true, hash: "mail" });
  const profile = mailProfileFromAccount(account, settings.company_name);
  if (!profile) {
    settingsRedirect("Udfyld SMTP-vært og adgangskode på kontoen, før I kan sende testmail.", {
      error: true,
      hash: "mail",
    });
  }

  const purpose =
    MAIL_PURPOSE_LABELS[account.purpose as keyof typeof MAIL_PURPOSE_LABELS] ?? account.purpose;
  const message = buildMailTestMessage({
    fromName: profile.fromName,
    fromEmail: profile.fromEmail,
    purposeLabel: purpose,
  });
  try {
    await sendMail({
      profile,
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 180) : "Ukendt SMTP-fejl.";
    settingsRedirect(`Testmail fejlede: ${detail}`, { error: true, hash: "mail" });
  }
  settingsRedirect(`Testmail er sendt til ${to} fra ${profile.fromEmail}. Tjek indbakken og spam.`, { hash: "mail" });
}

export async function deleteMailAccountAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  if (!id) return;
  await prisma.mailAccount.delete({ where: { id } }).catch(() => null);
  revalidateSettings();
  settingsRedirect("Mailkontoen er fjernet.", { hash: "mail" });
}
