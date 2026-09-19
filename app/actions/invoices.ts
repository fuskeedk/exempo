"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canTransition } from "@/lib/fsm";
import { parseKrToOre, VAT_RATE } from "@/lib/money";
import { nextInvoiceNumber } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createInvoiceAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const caseId = str(formData, "caseId");
  const sag = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      timeEntries: true,
      materials: true,
      klsReports: true,
    },
  });
  if (!sag) throw new Error("Sagen findes ikke.");

  const descriptions = formData.getAll("lineDescription").map((value) => String(value).trim());
  const quantities = formData.getAll("lineQuantity").map((value) => String(value));
  const prices = formData.getAll("linePrice").map((value) => String(value));

  const lines = descriptions
    .map((description, index) => ({
      description,
      quantity: Number.parseFloat(quantities[index]?.replace(",", ".") || "1") || 1,
      unitPrice: parseKrToOre(prices[index] ?? "0"),
    }))
    .filter((line) => line.description);

  if (lines.length === 0) {
    const labor = Math.round(
      sag.timeEntries.reduce((sum, entry) => sum + entry.hours * entry.hourlyRate, 0),
    );
    const materials = Math.round(
      sag.materials.reduce((sum, material) => sum + material.quantity * material.unitPrice, 0),
    );
    if (labor > 0) {
      lines.push({ description: "Arbejdsløn", quantity: 1, unitPrice: labor });
    }
    if (materials > 0) {
      lines.push({ description: "Materialer", quantity: 1, unitPrice: materials });
    }
    if (lines.length === 0 && sag.estimatedRevenue > 0) {
      const net = Math.round(sag.estimatedRevenue / (1 + VAT_RATE));
      lines.push({ description: sag.title, quantity: 1, unitPrice: net });
    }
  }

  if (lines.length === 0) {
    throw new Error("Fakturaen skal have mindst én linje.");
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      caseId,
      createdById: user.id,
      status: "KLADDE",
      notes: str(formData, "notes"),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      lines: { create: lines },
    },
  });

  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/fakturaer");
  redirect(`/fakturaer/${invoice.id}`);
}

export async function setInvoiceStatusAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const invoiceId = str(formData, "invoiceId");
  const status = str(formData, "status");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { case: { include: { invoices: true } } },
  });
  if (!invoice) throw new Error("Fakturaen findes ikke.");
  if (!["KLADDE", "SENDT", "BETALT"].includes(status)) {
    throw new Error("Ugyldig fakturastatus.");
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      paidAt: status === "BETALT" ? new Date() : invoice.paidAt,
    },
  });

  if (status === "SENDT" || status === "BETALT") {
    const result = canTransition(invoice.case.state, "FAKTURERET", { hasInvoice: true });
    if (result.ok) {
      await prisma.case.update({
        where: { id: invoice.caseId },
        data: { state: "FAKTURERET" },
      });
      await prisma.caseEvent.create({
        data: {
          caseId: invoice.caseId,
          fromState: invoice.case.state,
          toState: "FAKTURERET",
          note: `Faktura ${invoice.invoiceNumber} ${status === "BETALT" ? "betalt" : "sendt"}.`,
          userId: user.id,
        },
      });
    }
  }

  if (status === "BETALT" && invoice.case.state === "FAKTURERET") {
    const close = canTransition("FAKTURERET", "AFSLUTTET", { hasInvoice: true });
    if (close.ok) {
      await prisma.case.update({
        where: { id: invoice.caseId },
        data: { state: "AFSLUTTET" },
      });
      await prisma.caseEvent.create({
        data: {
          caseId: invoice.caseId,
          fromState: "FAKTURERET",
          toState: "AFSLUTTET",
          note: "Faktura betalt. Sag lukket.",
          userId: user.id,
        },
      });
    }
  }

  revalidatePath(`/fakturaer/${invoiceId}`);
  revalidatePath(`/sager/${invoice.caseId}`);
  revalidatePath("/fakturaer");
  revalidatePath("/okonomi");
  revalidatePath("/");
}
