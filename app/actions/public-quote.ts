"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultTenantSlug, getTenant } from "@/lib/platform";
import { enterTenant, tenantPrisma } from "@/lib/prisma";
import { applyCustomerQuoteDecision, customerQuotePath } from "@/lib/quotes";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function openTenant(slug: string) {
  const clean = slug.trim().toLowerCase();
  if (clean !== defaultTenantSlug() && !getTenant(clean)) return null;
  enterTenant(clean);
  return clean;
}

function bounce(slug: string, token: string, message: string): never {
  redirect(`${customerQuotePath(slug, token)}?besked=${encodeURIComponent(message)}`);
}

export async function customerDecideQuoteAction(formData: FormData) {
  const slug = str(formData, "slug");
  const token = str(formData, "token");
  const decision = str(formData, "decision") === "afvis" ? "afvis" : "godkend";
  const name = str(formData, "name");
  const tenant = openTenant(slug);
  if (!tenant || !token) bounce(slug || "exempo", token || "x", "Linket er ugyldigt.");

  const db = tenantPrisma(tenant);
  const quote = await db.quote.findUnique({ where: { shareToken: token } });
  if (!quote) bounce(tenant, token, "Tilbuddet findes ikke længere.");

  const applied = await applyCustomerQuoteDecision(quote.id, decision, {
    name,
    note: str(formData, "note"),
    slug: tenant,
  });
  if (!applied.ok) bounce(tenant, token, applied.reason);

  revalidatePath("/tilbud");
  revalidatePath("/sager");
  bounce(
    tenant,
    token,
    decision === "afvis"
      ? "Tak. Vi har noteret, at I ikke ønsker tilbuddet."
      : applied.created
        ? "Tak. Tilbuddet er godkendt, og vi opretter arbejdet."
        : "Tak. Tilbuddet er godkendt.",
  );
}
