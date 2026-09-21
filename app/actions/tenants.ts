"use server";

import { redirect } from "next/navigation";
import { lookupLogin } from "@/lib/platform";
import { provisionTenant } from "@/lib/provision";
import { isValidSlug, slugifyCompany } from "@/lib/serial";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createCompanyAction(formData: FormData) {
  const name = str(formData, "name");
  const slugRaw = str(formData, "slug") || slugifyCompany(name);
  const slug = slugRaw.toLowerCase();
  const adminName = str(formData, "adminName");
  const adminEmail = str(formData, "adminEmail").toLowerCase();
  const adminPassword = str(formData, "adminPassword");
  const casePrefix = str(formData, "casePrefix");
  const caseIncludeYear = str(formData, "caseIncludeYear") === "1";
  const caseDigits = Number.parseInt(str(formData, "caseDigits") || "5", 10);

  if (!name || !adminName || !adminEmail || !adminPassword) {
    redirect("/opret?error=Udfyld%20virksomhed%2C%20navn%2C%20e-mail%20og%20adgangskode.");
  }
  if (adminPassword.length < 8) {
    redirect("/opret?error=Adgangskoden%20skal%20v%C3%A6re%20mindst%208%20tegn.");
  }
  if (!isValidSlug(slug)) {
    redirect("/opret?error=V%C3%A6lg%20et%20kort%20firmanavn%20uden%20mellemrum.");
  }
  if (lookupLogin(adminEmail)) {
    redirect("/opret?error=E-mailen%20er%20allerede%20i%20brug.");
  }

  try {
    await provisionTenant({
      slug,
      name,
      adminName,
      adminEmail,
      adminPassword,
      casePrefix,
      caseIncludeYear,
      caseDigits: Number.isFinite(caseDigits) ? caseDigits : 5,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunne ikke oprette virksomheden.";
    redirect(`/opret?error=${encodeURIComponent(message)}`);
  }

  redirect("/login?created=1");
}
