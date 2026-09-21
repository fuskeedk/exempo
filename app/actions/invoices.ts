"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canDeleteInvoice, isInvoiceKind } from "@/lib/catalog";
import { parseDayParam } from "@/lib/dates";
import { canTransition } from "@/lib/fsm";
import { parseKrToOre } from "@/lib/money";
import { nextInvoiceNumber } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeNext(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("://") ? value : fallback;
}

export async function createInvoiceAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const caseId = str(formData, "caseId");
  const sag = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      timeEntries: true,
      materials: true,
    },
  });
  if (!sag) throw new Error("Sagen findes ikke.");
  const kind = isInvoiceKind(str(formData, "kind")) ? str(formData, "kind") : "FAKTURA";

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

    if (lines.length === 0 && kind !== "ACONTO") {
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
    lines.push({
      description:
        kind === "ACONTO"
          ? `Aconto · ${sag.caseNumber}`
          : `${sag.title} (${sag.caseNumber})`.trim() || sag.caseNumber,
      quantity: 1,
      unitPrice: kind === "ACONTO" ? 0 : sag.estimatedRevenue || 0,
    });
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      caseId,
      customerId: sag.customerId,
      createdById: user.id,
      status: "KLADDE",
      kind,
      notes: str(formData, "notes"),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      lines: { create: lines },
    },
  });

  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/fakturaer");
  redirect(`/fakturaer/${invoice.id}?linjer=1`);
}

export async function updateInvoiceDraftAction(input: {
  invoiceId: string;
  kind: string;
  notes: string;
  dueAt?: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  closeOrder?: boolean;
}) {
  await requireRole(["ADMIN", "PL"]);
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new Error("Fakturaen findes ikke.");
  if (invoice.status !== "KLADDE") {
    throw new Error("Kun kladder kan redigeres. Sæt fakturaen tilbage til kladde.");
  }

  const kind =
    invoice.kind === "KREDITNOTA"
      ? "KREDITNOTA"
      : isInvoiceKind(input.kind) && input.kind !== "KREDITNOTA"
        ? input.kind
        : "FAKTURA";

  const lines = input.lines
    .map((line) => ({
      description: line.description.trim(),
      quantity: Number.isFinite(line.quantity) ? line.quantity : 0,
      unitPrice: Math.round(line.unitPrice || 0),
    }))
    .filter((line) => line.description);
  if (lines.length === 0) {
    lines.push({
      description: kind === "ACONTO" ? "Aconto" : "Ydelse",
      quantity: 1,
      unitPrice: 0,
    });
  }

  const dueAt = input.dueAt?.trim() ? parseDayParam(input.dueAt) : null;

  await prisma.$transaction([
    prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        kind,
        notes: (input.notes ?? "").slice(0, 4000),
        dueAt,
        lines: { create: lines },
      },
    }),
  ]);

  if (input.closeOrder && kind !== "KREDITNOTA") {
    const sag = await prisma.case.findUnique({ where: { id: invoice.caseId } });
    if (sag) {
      const next = canTransition(sag.state, "KLAR_TIL_FAKTURA", { hasInvoice: true, isScheduled: Boolean(sag.scheduledStart) });
      if (next.ok) {
        await prisma.case.update({
          where: { id: sag.id },
          data: { state: "KLAR_TIL_FAKTURA" },
        });
        await prisma.caseEvent.create({
          data: {
            caseId: sag.id,
            fromState: sag.state,
            toState: "KLAR_TIL_FAKTURA",
            note: `Slutfaktura ${invoice.invoiceNumber} er gjort klar. Sagen færdigmeldes.`,
          },
        });
      }
    }
  }

  revalidatePath(`/fakturaer/${invoice.id}`);
  revalidatePath(`/sager/${invoice.caseId}`);
  revalidatePath("/fakturaer");
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

export async function createCaseCreditNoteAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const caseId = str(formData, "caseId");
  const sag = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      invoices: {
        include: { lines: true },
        orderBy: { issuedAt: "desc" },
      },
    },
  });
  if (!sag) throw new Error("Sagen findes ikke.");

  const source = sag.invoices.find(
    (invoice) =>
      invoice.kind !== "KREDITNOTA" &&
      ["SENDT", "BETALT", "RYKKET", "INKASSO"].includes(invoice.status),
  );

  const credit = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      caseId,
      customerId: sag.customerId,
      createdById: user.id,
      status: "KLADDE",
      kind: "KREDITNOTA",
      notes: source ? `Kreditnota til ${source.invoiceNumber}` : `Kreditnota til ${sag.caseNumber}`,
      dueAt: new Date(),
      lines: {
        create: source
          ? source.lines.map((line) => ({
              description: `Kredit: ${line.description}`,
              quantity: line.quantity,
              unitPrice: -Math.abs(line.unitPrice),
            }))
          : [
              {
                description: `Kreditnota · ${sag.caseNumber} · ${sag.title}`,
                quantity: 1,
                unitPrice: sag.estimatedRevenue ? -Math.abs(sag.estimatedRevenue) : 0,
              },
            ],
      },
    },
  });

  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/fakturaer");
  redirect(`/fakturaer/${credit.id}`);
}

export async function deleteInvoiceDraftAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const invoiceId = str(formData, "invoiceId");
  const next = safeNext(str(formData, "next"), "/fakturaer");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Fakturaen findes ikke.");
  if (!canDeleteInvoice(invoice.status)) {
    throw new Error("Kun kladder kan slettes.");
  }
  await prisma.invoice.delete({ where: { id: invoiceId } });
  revalidatePath("/fakturaer");
  revalidatePath(`/sager/${invoice.caseId}`);
  revalidatePath("/okonomi");
  revalidatePath("/");
  redirect(next);
}
