"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { parseDateInput } from "@/lib/dates";
import { parseKrToOre } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function startTimerAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  await prisma.user.update({
    where: { id: user.id },
    data: { timerCaseId: caseId, timerStartedAt: new Date() },
  });
  revalidatePath("/min-dag");
  revalidatePath(`/sager/${caseId}`);
}

export async function stopTimerAction() {
  const user = await requireSession();
  const worker = await prisma.user.findUnique({ where: { id: user.id } });
  if (!worker?.timerCaseId || !worker.timerStartedAt) {
    throw new Error("Ingen aktiv timer.");
  }
  const hours = Math.max(
    0.25,
    Math.round(((Date.now() - worker.timerStartedAt.getTime()) / 36e5) * 4) / 4,
  );
  await prisma.timeEntry.create({
    data: {
      caseId: worker.timerCaseId,
      userId: user.id,
      hours,
      hourlyRate: worker.hourlyRate,
      date: new Date(),
      kind: "ARBEJDE",
      note: "Stopur",
    },
  });
  const caseId = worker.timerCaseId;
  await prisma.user.update({
    where: { id: user.id },
    data: { timerCaseId: null, timerStartedAt: null },
  });
  revalidatePath("/min-dag");
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/tid");
}

export async function createExtraWorkAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  const title = str(formData, "title");
  if (!title) throw new Error("Titel på ekstraarbejde mangler.");
  await prisma.extraWork.create({
    data: {
      caseId,
      title,
      description: str(formData, "description"),
      amount: parseKrToOre(str(formData, "amount")),
      status: user.role === "MEDARBEJDER" ? "SENDT" : "KLADDE",
      createdById: user.id,
    },
  });
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/min-dag");
}

export async function setExtraWorkStatusAction(formData: FormData) {
  const user = await requireSession();
  const id = str(formData, "extraWorkId");
  const status = str(formData, "status");
  const extra = await prisma.extraWork.update({
    where: { id },
    data: { status },
  });
  if (status === "GODKENDT" || status === "SENDT") {
    const sag = await prisma.case.findUnique({ where: { id: extra.caseId } });
    await prisma.caseEvent.create({
      data: {
        caseId: extra.caseId,
        fromState: sag?.state ?? null,
        toState: sag?.state ?? extra.status,
        note:
          status === "GODKENDT"
            ? `Ekstraarbejde godkendt: ${extra.title}`
            : `Ekstraarbejde sendt til kunden: ${extra.title}`,
        userId: user.id,
      },
    });
  }
  revalidatePath(`/sager/${extra.caseId}`);
  revalidatePath("/min-dag");
}

export async function createAbsenceAction(formData: FormData) {
  const user = await requireSession();
  const date = parseDateInput(str(formData, "date"));
  const hours = Number.parseFloat(str(formData, "hours").replace(",", ".")) || 7.4;
  if (!date) throw new Error("Dato mangler.");
  await prisma.absence.create({
    data: {
      userId: user.id,
      date,
      hours,
      type: str(formData, "type") || "FERIE",
      note: str(formData, "note"),
    },
  });
  revalidatePath("/tid");
  revalidatePath("/min-dag");
  revalidatePath("/kalender");
}

export async function createReminderAction(formData: FormData) {
  const user = await requireSession();
  if (user.role === "MEDARBEJDER") throw new Error("Kun kontoret kan sende rykkere.");
  const invoiceId = str(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Fakturaen findes ikke.");
  const level = Math.min(3, (invoice.reminderLevel || 0) + 1);
  await prisma.reminder.create({
    data: {
      invoiceId,
      level,
      note: str(formData, "note") || `Rykker ${level}`,
    },
  });
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: level >= 3 ? "INKASSO" : "RYKKET", reminderLevel: level },
  });
  revalidatePath("/fakturaer");
  revalidatePath("/rykkere");
  revalidatePath(`/fakturaer/${invoiceId}`);
}

export async function createAgreementAction(formData: FormData) {
  const user = await requireSession();
  if (user.role === "MEDARBEJDER") throw new Error("Kun kontoret kan oprette serviceaftaler.");
  const customerId = str(formData, "customerId");
  const title = str(formData, "title");
  const nextVisit = parseDateInput(str(formData, "nextVisit"));
  if (!customerId || !title || !nextVisit) throw new Error("Kunde, titel og næste besøg er påkrævet.");
  await prisma.serviceAgreement.create({
    data: {
      customerId,
      title,
      description: str(formData, "description"),
      trade: str(formData, "trade") || "ANDET",
      intervalMonths: Number.parseInt(str(formData, "intervalMonths") || "12", 10),
      nextVisit,
      estimatedRevenue: parseKrToOre(str(formData, "estimatedRevenue")),
    },
  });
  revalidatePath("/serviceaftaler");
}

export async function spawnAgreementCaseAction(formData: FormData) {
  const user = await requireSession();
  const id = str(formData, "agreementId");
  const agreement = await prisma.serviceAgreement.findUnique({
    where: { id },
    include: { customer: { include: { addresses: true } } },
  });
  if (!agreement) throw new Error("Aftalen findes ikke.");
  const address = agreement.customer.addresses[0];
  const { nextCaseNumber } = await import("@/lib/numbers");
  const sag = await prisma.case.create({
    data: {
      caseNumber: await nextCaseNumber(),
      title: agreement.title,
      description: agreement.description,
      customerId: agreement.customerId,
      addressId: address?.id,
      customerName: agreement.customer.name,
      customerAddress: address?.street ?? "",
      customerPostal: address?.postal ?? "",
      customerCity: address?.city ?? "",
      customerPhone: agreement.customer.phone,
      customerEmail: agreement.customer.email,
      trade: agreement.trade,
      orderType: "SERVICE",
      pricingMode: "FAST_PRIS",
      projectLeaderId: user.id,
      estimatedRevenue: agreement.estimatedRevenue,
      events: {
        create: {
          fromState: null,
          toState: "NY",
          note: "Oprettet fra serviceaftale.",
          userId: user.id,
        },
      },
    },
  });
  const next = new Date(agreement.nextVisit);
  next.setMonth(next.getMonth() + agreement.intervalMonths);
  await prisma.serviceAgreement.update({ where: { id }, data: { nextVisit: next } });
  revalidatePath("/serviceaftaler");
  revalidatePath("/sager");
  redirect(`/sager/${sag.id}`);
}
