"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireSession } from "@/lib/auth";
import { parseKrToOre } from "@/lib/money";
import { nextCaseNumber, nextQuoteNumber } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function linesFromForm(formData: FormData) {
  const descriptions = formData.getAll("lineDescription").map((value) => String(value).trim());
  const kinds = formData.getAll("lineKind").map((value) => String(value));
  const quantities = formData.getAll("lineQuantity").map((value) => String(value));
  const prices = formData.getAll("linePrice").map((value) => String(value));
  const costs = formData.getAll("lineCost").map((value) => String(value));
  return descriptions
    .map((description, index) => ({
      description,
      kind: kinds[index] || "YDELSE",
      quantity: Number.parseFloat(quantities[index]?.replace(",", ".") || "1") || 1,
      unitPrice: parseKrToOre(prices[index] ?? "0"),
      costPrice: parseKrToOre(costs[index] ?? "0"),
    }))
    .filter((line) => line.description);
}

export async function createQuoteAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const customerId = str(formData, "customerId");
  const title = str(formData, "title");
  if (!customerId || !title) throw new Error("Kunde og titel er påkrævet.");
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { addresses: true },
  });
  if (!customer) throw new Error("Kunden findes ikke.");
  const requestedAddress = str(formData, "addressId");
  const addressId = customer.addresses.some((item) => item.id === requestedAddress)
    ? requestedAddress
    : customer.addresses[0]?.id;
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: await nextQuoteNumber(),
      customerId,
      addressId,
      title,
      description: str(formData, "description"),
      trade: str(formData, "trade") || "ANDET",
      pricingMode: str(formData, "pricingMode") || "FAST_PRIS",
      createdById: user.id,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lines: { create: linesFromForm(formData) },
    },
  });
  revalidatePath("/tilbud");
  redirect(`/tilbud/${quote.id}`);
}

export async function setQuoteStatusAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "quoteId");
  const status = str(formData, "status");
  await prisma.quote.update({ where: { id }, data: { status } });
  revalidatePath(`/tilbud/${id}`);
  revalidatePath("/tilbud");
}

export async function convertQuoteToCaseAction(formData: FormData) {
  const user = await requireSession();
  const id = str(formData, "quoteId");
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, address: true, lines: true },
  });
  if (!quote) throw new Error("Tilbuddet findes ikke.");
  if (quote.status !== "GODKENDT") {
    throw new Error("Tilbuddet skal være godkendt, før det kan blive en ordre.");
  }
  const revenue = Math.round(
    quote.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
  );
  const cost = Math.round(
    quote.lines.reduce((sum, line) => sum + line.quantity * line.costPrice, 0),
  );
  const sag = await prisma.case.create({
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
      projectLeaderId: user.id,
      estimatedRevenue: revenue,
      estimatedCost: cost,
      events: {
        create: {
          fromState: null,
          toState: "NY",
          note: `Oprettet fra tilbud ${quote.quoteNumber}.`,
          userId: user.id,
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
  await prisma.quote.update({ where: { id }, data: { caseId: sag.id } });
  revalidatePath("/sager");
  revalidatePath("/tilbud");
  redirect(`/sager/${sag.id}`);
}
