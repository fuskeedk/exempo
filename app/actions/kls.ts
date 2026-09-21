"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { KLS_STATUSES, type KlsStatus } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export type KlsActionResult = { error?: string };

export async function startKlsAction(formData: FormData): Promise<KlsActionResult> {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  const templateId = str(formData, "templateId");
  const sag = await prisma.case.findUnique({
    where: { id: caseId },
    include: { klsReports: true },
  });
  const template = await prisma.klsTemplate.findUnique({
    where: { id: templateId },
    include: { items: true },
  });
  if (!sag || !template) return { error: "Sag eller skabelon mangler." };
  if (sag.klsReports.length > 0) return { error: "Der findes allerede et KLS på sagen." };

  await prisma.klsReport.create({
    data: {
      caseId,
      templateId,
      checks: {
        create: template.items.map((item) => ({
          itemId: item.id,
          status: "PENDING",
        })),
      },
    },
  });
  await prisma.caseEvent.create({
    data: {
      caseId,
      fromState: sag.state,
      toState: sag.state,
      note: `KLS tilføjet (${template.name}).`,
      userId: user.id,
    },
  });

  revalidatePath(`/sager/${caseId}`);
  return {};
}

export async function saveKlsAction(formData: FormData): Promise<KlsActionResult> {
  const user = await requireSession();
  const reportId = str(formData, "reportId");
  const caseId = str(formData, "caseId");
  const notes = str(formData, "notes");
  const sign = str(formData, "sign") === "1";

  const report = await prisma.klsReport.findUnique({
    where: { id: reportId },
    include: { checks: { include: { item: true } }, case: true },
  });
  if (!report) return { error: "KLS findes ikke." };

  for (const check of report.checks) {
    const status = str(formData, `status-${check.id}`) || "PENDING";
    const comment = str(formData, `comment-${check.id}`);
    const next: KlsStatus = KLS_STATUSES.includes(status as KlsStatus)
      ? (status as KlsStatus)
      : "PENDING";
    await prisma.klsCheck.update({
      where: { id: check.id },
      data: { status: next, comment },
    });
  }

  const data: {
    notes: string;
    signedAt?: Date;
    signedById?: string;
  } = { notes };

  if (sign) {
    const pending = report.checks.some((check) => {
      const status = str(formData, `status-${check.id}`) || check.status;
      return status === "PENDING";
    });
    if (pending) {
      await prisma.klsReport.update({ where: { id: reportId }, data: { notes } });
      return {
        error: "Alle punkter skal sættes til OK, Afvigelse eller Ikke relevant, før KLS kan underskrives.",
      };
    }
    data.signedAt = new Date();
    data.signedById = user.id;
  }

  await prisma.klsReport.update({ where: { id: reportId }, data });

  if (sign) {
    await prisma.caseEvent.create({
      data: {
        caseId,
        fromState: report.case.state,
        toState: report.case.state,
        note: "KLS underskrevet.",
        userId: user.id,
      },
    });
  }

  revalidatePath(`/sager/${caseId}`);
  return {};
}

function parseItems(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function bounceKls(message: string): never {
  redirect(`/indstillinger?besked=${encodeURIComponent(message)}#kls`);
}

export async function createKlsTemplateAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const name = str(formData, "name");
  const trade = str(formData, "trade") || "ANDET";
  const items = parseItems(str(formData, "items"));
  if (!name) bounceKls("Skemaet skal have et navn.");
  if (items.length === 0) bounceKls("Tilføj mindst ét tjekpunkt.");
  await prisma.klsTemplate.create({
    data: {
      name,
      trade,
      items: { create: items.map((label, sortOrder) => ({ label, sortOrder })) },
    },
  });
  revalidatePath("/indstillinger");
  revalidatePath("/sager");
  bounceKls("KLS-skemaet er oprettet.");
}

export async function deleteKlsTemplateAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const used = await prisma.klsReport.count({ where: { templateId: id } });
  if (used > 0) bounceKls("Skemaet kan ikke slettes, mens det bruges på en sag.");
  await prisma.klsTemplate.delete({ where: { id } });
  revalidatePath("/indstillinger");
  revalidatePath("/sager");
  bounceKls("KLS-skemaet er slettet.");
}
