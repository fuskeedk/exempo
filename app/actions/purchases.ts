"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { parseKrToOre } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { parsePurchaseTab } from "@/lib/purchases";
import { getSettings } from "@/lib/settings";
import { fetchInvoiceMail } from "@/lib/invoice-mail";
import { fetchSproomInbox, ingestPurchase } from "@/lib/sproom";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bounce(message: string, formData?: FormData, extra: Record<string, string> = {}): never {
  const fane = parsePurchaseTab(formData ? str(formData, "fane") : extra.fane);
  const params = new URLSearchParams({ fane, besked: message, ...extra });
  redirect(`/indkob?${params.toString()}`);
}

export async function createPurchaseAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const supplierName = str(formData, "supplierName");
  if (!supplierName) bounce("Leverandør er påkrævet.", formData);
  const amount = parseKrToOre(str(formData, "amount"));
  const description = str(formData, "description") || "Indkøb";
  const purchase = await ingestPurchase("MANUEL", {
    externalId: `manual-${Date.now()}`,
    supplierName,
    supplierCvr: str(formData, "supplierCvr"),
    invoiceNumber: str(formData, "invoiceNumber"),
    issuedAt: str(formData, "issuedAt") || new Date().toISOString(),
    grossAmount: amount,
    netAmount: Math.round(amount / 1.25),
    vatAmount: amount - Math.round(amount / 1.25),
    note: str(formData, "note"),
    lines: [{ description, quantity: 1, unitPrice: amount, amount }],
  });
  const caseId = str(formData, "caseId");
  if (caseId && purchase) {
    const sag = await prisma.case.findUnique({ where: { id: caseId } });
    if (sag) {
      const place = [sag.customerAddress, sag.customerCity].filter(Boolean).join(" ");
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          caseId,
          status: "AFVENTER",
          orderReference: place ? `${sag.caseNumber}/${place}` : sag.caseNumber,
          responsibleUserId: sag.projectLeaderId,
        },
      });
      revalidatePath(`/sager/${caseId}`);
    }
  }
  revalidatePath("/indkob");
  bounce("Indkøbet er registreret og afventer matching.", formData, {
    fane: caseId ? "afventer" : "indkomne",
  });
}

export async function assignPurchaseAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const caseId = str(formData, "caseId");
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) bounce("Indkøbet findes ikke.", formData);
  if (purchase.status === "GODKENDT" || purchase.status === "AFVIST") {
    bounce("Godkendte eller afviste indkøb kan ikke flyttes.", formData);
  }
  if (!caseId) {
    await prisma.purchase.update({
      where: { id },
      data: { caseId: null, status: "MODTAGET", orderReference: "" },
    });
    revalidatePath("/indkob");
    revalidatePath(`/indkob/${id}`);
    bounce("Indkøbet er fjernet fra sagen.", formData);
  }
  const sag = await prisma.case.findUnique({ where: { id: caseId } });
  if (!sag) bounce("Sagen findes ikke.", formData);
  const place = [sag.customerAddress, sag.customerCity].filter(Boolean).join(" ");
  await prisma.purchase.update({
    where: { id },
    data: {
      caseId,
      status: "AFVENTER",
      orderReference: place ? `${sag.caseNumber}/${place}` : sag.caseNumber,
      responsibleUserId: purchase.responsibleUserId || sag.projectLeaderId,
    },
  });
  revalidatePath("/indkob");
  revalidatePath(`/indkob/${id}`);
  revalidatePath(`/sager/${caseId}`);
  bounce(`Sat på ${sag.caseNumber}. Afventer godkendelse.`, formData, { fane: "afventer" });
}

export async function approvePurchaseAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!purchase) bounce("Indkøbet findes ikke.", formData);
  if (!purchase.caseId) bounce("Vælg en sag, før indkøbet godkendes.", formData);
  if (purchase.status === "GODKENDT") bounce("Indkøbet er allerede godkendt.", formData);

  await prisma.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id },
      data: { status: "GODKENDT", approvedById: user.id, decidedAt: new Date() },
    });
    if (purchase.lines.length === 0) {
      await tx.material.create({
        data: {
          caseId: purchase.caseId!,
          name: `${purchase.supplierName} ${purchase.invoiceNumber}`.trim(),
          quantity: 1,
          unitPrice: 0,
          costPrice: purchase.grossAmount,
          billable: false,
        },
      });
    } else {
      await tx.material.createMany({
        data: purchase.lines.map((line) => ({
          caseId: purchase.caseId!,
          name: line.description,
          quantity: line.quantity,
          unitPrice: 0,
          costPrice:
            line.quantity > 0 && line.amount
              ? Math.round(line.amount / line.quantity)
              : line.unitPrice || line.amount,
          billable: false,
        })),
      });
    }
  });

  revalidatePath("/indkob");
  revalidatePath(`/indkob/${id}`);
  revalidatePath(`/sager/${purchase.caseId}`);
  revalidatePath("/okonomi");
  bounce("Indkøbet er godkendt og belaster sagen.", formData, { fane: "behandlede" });
}

export async function overheadPurchaseAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  await prisma.purchase.update({
    where: { id },
    data: {
      status: "DRIFT",
      caseId: null,
      approvedById: user.id,
      decidedAt: new Date(),
    },
  });
  revalidatePath("/indkob");
  revalidatePath(`/indkob/${id}`);
  bounce("Indkøbet er godkendt som drift — belaster ikke en sag.", formData, { fane: "behandlede" });
}

export async function rejectPurchaseAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const note = str(formData, "note");
  await prisma.purchase.update({
    where: { id },
    data: {
      status: "AFVIST",
      approvedById: user.id,
      decidedAt: new Date(),
      note,
    },
  });
  revalidatePath("/indkob");
  revalidatePath(`/indkob/${id}`);
  bounce("Indkøbet er afvist.", formData, { fane: str(formData, "fane") || "behandlede" });
}

export async function addPurchaseFollowUpAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const note = str(formData, "note");
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) bounce("Indkøbet findes ikke.", formData);
  const nextStatus =
    purchase.status === "MODTAGET" || purchase.status === "DELVIST" ? "DELVIST" : purchase.status;
  await prisma.purchase.update({
    where: { id },
    data: {
      followUpNote: note,
      followUpAt: note ? new Date() : null,
      status: nextStatus,
    },
  });
  revalidatePath("/indkob");
  revalidatePath(`/indkob/${id}`);
  bounce(note ? "Opfølgning er gemt." : "Opfølgning er fjernet.", formData, {
    fane: nextStatus === "DELVIST" ? "delvist" : str(formData, "fane"),
  });
}

export async function assignPurchaseResponsibleAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const responsibleUserId = str(formData, "responsibleUserId") || null;
  await prisma.purchase.update({
    where: { id },
    data: { responsibleUserId },
  });
  revalidatePath("/indkob");
  revalidatePath(`/indkob/${id}`);
  bounce("Ansvarlig er opdateret.", formData);
}

export async function exportPurchasesAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const ids = formData.getAll("ids").map((value) => String(value)).filter(Boolean);
  if (ids.length === 0) bounce("Vælg mindst én indkøbsfaktura.", formData);
  await prisma.purchase.updateMany({
    where: { id: { in: ids } },
    data: { exportedAt: new Date() },
  });
  revalidatePath("/indkob");
  bounce(`Eksporterede ${ids.length} indkøbsfakturaer.`, formData);
}

export async function syncInvoiceMailAction(formData?: FormData) {
  await requireRole(["ADMIN", "PL"]);
  try {
    const result = await fetchInvoiceMail();
    if (result.errors.length && result.processed === 0) {
      bounce(result.errors[0], formData);
    }
    const extras = result.matched ? ` ${result.matched} blev matchet til sag.` : "";
    bounce(
      result.processed
        ? `Hentede ${result.processed} indkøbsfakturaer fra mail.${extras}`
        : "Ingen nye fakturaer på faktura-mailen.",
      formData,
      { fane: "indkomne" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunne ikke hente fakturaer fra mail.";
    bounce(message, formData);
  }
}

export async function syncSproomAction(formData?: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const settings = await getSettings();
  if (!settings.sproom_api_token) {
    bounce("Sæt Sproom API-token under Indstillinger først.", formData);
  }
  try {
    const docs = await fetchSproomInbox(settings.sproom_api_token);
    let created = 0;
    for (const doc of docs) {
      const before = await prisma.purchase.count({
        where: { source: "SPROOM", externalId: doc.externalId },
      });
      await ingestPurchase("SPROOM", doc);
      const after = await prisma.purchase.count({
        where: { source: "SPROOM", externalId: doc.externalId },
      });
      if (before === 0 && after > 0) created += 1;
    }
    bounce(
      created ? `Hentede ${created} nye indkøb fra Sproom.` : "Ingen nye dokumenter i Sproom.",
      formData,
      { fane: "indkomne" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunne ikke hente fra Sproom.";
    bounce(message, formData);
  }
}
