import { randomBytes } from "node:crypto";
import { nextCaseNumber } from "@/lib/numbers";
import { currentTenantSlug, enterTenant, prisma, tenantPrisma } from "@/lib/prisma";

export function newShareToken() {
  return randomBytes(18).toString("base64url");
}

export function customerQuotePath(slug: string, token: string) {
  return `/t/${encodeURIComponent(slug)}/${token}`;
}

export async function ensureQuoteShareToken(quoteId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { shareToken: true } });
  if (!quote) return "";
  if (quote.shareToken) return quote.shareToken;
  const shareToken = newShareToken();
  await prisma.quote.update({ where: { id: quoteId }, data: { shareToken } });
  return shareToken;
}

export async function convertApprovedQuoteToCase(
  quoteId: string,
  actorUserId?: string | null,
  slug?: string | null,
) {
  if (slug) enterTenant(slug);
  const db = tenantPrisma(slug || currentTenantSlug());
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { customer: true, address: true, lines: true, cases: true },
  });
  if (!quote) return { ok: false as const, reason: "Tilbuddet findes ikke." };
  if (quote.status !== "GODKENDT") {
    return { ok: false as const, reason: "Tilbuddet skal være godkendt, før det kan blive en ordre." };
  }
  if (quote.cases.length > 0 || quote.caseId) {
    return { ok: true as const, caseId: quote.caseId || quote.cases[0].id, created: false };
  }

  const actor =
    (actorUserId
      ? await db.user.findUnique({ where: { id: actorUserId }, select: { id: true } })
      : null) ??
    (quote.createdById
      ? await db.user.findUnique({ where: { id: quote.createdById }, select: { id: true } })
      : null) ??
    (await db.user.findFirst({
      where: { active: true, role: { in: ["ADMIN", "PL"] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }));

  const revenue = Math.round(quote.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const cost = Math.round(quote.lines.reduce((sum, line) => sum + line.quantity * line.costPrice, 0));
  const sag = await db.case.create({
    data: {
      caseNumber: await nextCaseNumber(),
      title: quote.title,
      description: quote.description,
      customerId: quote.customerId,
      addressId: quote.addressId,
      quoteId: quote.id,
      customerName: quote.customer.name,
      customerAddress: quote.address?.street ?? "",
      customerPostal: quote.address?.postal ?? "",
      customerCity: quote.address?.city ?? "",
      customerPhone: quote.customer.phone,
      customerEmail: quote.customer.email,
      trade: quote.trade,
      pricingMode: quote.pricingMode,
      projectLeaderId: actor?.id ?? null,
      estimatedRevenue: revenue,
      estimatedCost: cost,
      events: {
        create: {
          fromState: null,
          toState: "NY",
          note: quote.approvedName
            ? `Oprettet fra tilbud ${quote.quoteNumber}. Godkendt af ${quote.approvedName}.`
            : `Oprettet fra tilbud ${quote.quoteNumber}.`,
          userId: actor?.id ?? null,
        },
      },
      materials: {
        create: quote.lines
          .filter((line) => line.kind !== "TIMER")
          .map((line) => ({
            name: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            costPrice: line.costPrice,
          })),
      },
    },
  });
  await db.quote.update({ where: { id: quote.id }, data: { caseId: sag.id } });
  return { ok: true as const, caseId: sag.id, created: true };
}

export async function applyCustomerQuoteDecision(
  quoteId: string,
  decision: "godkend" | "afvis",
  opts: { name: string; note?: string; slug?: string | null } = { name: "" },
) {
  if (opts.slug) enterTenant(opts.slug);
  const db = tenantPrisma(opts.slug || currentTenantSlug());
  const quote = await db.quote.findUnique({ where: { id: quoteId } });
  if (!quote) return { ok: false as const, reason: "Tilbuddet findes ikke." };
  if (quote.status === "GODKENDT") return { ok: false as const, reason: "Tilbuddet er allerede godkendt." };
  if (quote.status === "AFVIST") return { ok: false as const, reason: "Tilbuddet er allerede afvist." };
  if (quote.status !== "SENDT") return { ok: false as const, reason: "Tilbuddet er ikke sendt endnu." };
  if (quote.validUntil && quote.validUntil.getTime() < Date.now()) {
    return { ok: false as const, reason: "Tilbuddets gyldighed er udløbet." };
  }

  const name = opts.name.trim();
  if (decision === "afvis") {
    await db.quote.update({
      where: { id: quote.id },
      data: {
        status: "AFVIST",
        rejectedNote: opts.note?.trim() || "Afvist af kunden",
        approvedName: name,
      },
    });
    return { ok: true as const, created: false, caseId: quote.caseId };
  }

  if (!name) return { ok: false as const, reason: "Skriv navn, før I godkender." };
  await db.quote.update({
    where: { id: quote.id },
    data: { status: "GODKENDT", approvedAt: new Date(), approvedName: name, rejectedNote: "" },
  });
  const converted = await convertApprovedQuoteToCase(quote.id, quote.createdById, opts.slug);
  return converted;
}
