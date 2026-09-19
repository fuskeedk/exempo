"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canTransition } from "@/lib/fsm";
import { parseKrToOre } from "@/lib/money";
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
      const extras = await prisma.extraWork.findMany({
        where: { caseId, status: "GODKENDT" },
      });
      if (sag.pricingMode === "FORBRUG") {
        const labor = Math.round(
          sag.timeEntries
            .filter((entry) => entry.billable)
            .reduce((sum, entry) => sum + entry.hours * entry.hourlyRate, 0),
        );
        const materials = Math.round(
          sag.materials
            .filter((material) => material.billable)
            .reduce((sum, material) => sum + material.quantity * material.unitPrice, 0),
        );
        if (labor > 0) lines.push({ description: "Arbejdsløn efter forbrug", quantity: 1, unitPrice: labor });
        if (materials > 0) lines.push({ description: "Materialer efter forbrug", quantity: 1, unitPrice: materials });
      } else if (sag.estimatedRevenue > 0) {
        lines.push({
          description: `${sag.title} (${sag.caseNumber})`,
          quantity: 1,
          unitPrice: sag.estimatedRevenue,
        });
      }
      for (const extra of extras) {
        lines.push({ description: `Ekstraarbejde: ${extra.title}`, quantity: 1, unitPrice: extra.amount });
      }
    }

  if (lines.length === 0) {
    throw new Error("Fakturaen skal have mindst én linje.");
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      caseId,
      customerId: sag.customerId,
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
    if (invoice.kind !== "KREDITNOTA") {
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
  }

  if (status === "BETALT" && (invoice.case.state === "FAKTURERET" || invoice.kind === "KREDITNOTA")) {
    if (invoice.kind !== "KREDITNOTA") {
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
  }

  revalidatePath(`/fakturaer/${invoiceId}`);
  revalidatePath(`/sager/${invoice.caseId}`);
  revalidatePath("/fakturaer");
  revalidatePath("/okonomi");
  revalidatePath("/rykkere");
  revalidatePath("/");
}

export async function createCreditNoteAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const invoiceId = str(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, case: true },
  });
  if (!invoice) throw new Error("Fakturaen findes ikke.");
  if (invoice.kind === "KREDITNOTA") {
    throw new Error("Kan ikke kreditere en kreditnota.");
  }
  if (!["SENDT", "BETALT", "RYKKET", "INKASSO"].includes(invoice.status)) {
    throw new Error("Kun sendte eller betalte fakturaer kan krediteres.");
  }

  const credit = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      caseId: invoice.caseId,
      customerId: invoice.customerId ?? invoice.case.customerId,
      createdById: user.id,
      status: "KLADDE",
      kind: "KREDITNOTA",
      notes: `Kreditnota til ${invoice.invoiceNumber}`,
      dueAt: new Date(),
      lines: {
        create: invoice.lines.map((line) => ({
          description: `Kredit: ${line.description}`,
          quantity: line.quantity,
          unitPrice: -Math.abs(line.unitPrice),
        })),
      },
    },
  });

  revalidatePath(`/fakturaer/${invoiceId}`);
  revalidatePath("/fakturaer");
  redirect(`/fakturaer/${credit.id}`);
}
