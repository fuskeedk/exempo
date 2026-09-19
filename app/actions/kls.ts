"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { KLS_STATUSES, type KlsStatus } from "@/lib/catalog";
import { canTransition } from "@/lib/fsm";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function startKlsAction(formData: FormData) {
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
  if (!sag || !template) throw new Error("Sag eller skabelon mangler.");
  if (sag.klsReports.length > 0) throw new Error("Der findes allerede et KLS på sagen.");

  await prisma.$transaction(async (tx) => {
    await tx.klsReport.create({
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
    if (sag.state === "I_GANG") {
      const result = canTransition("I_GANG", "KLS");
      if (result.ok) {
        await tx.case.update({ where: { id: caseId }, data: { state: "KLS" } });
        await tx.caseEvent.create({
          data: {
            caseId,
            fromState: "I_GANG",
            toState: "KLS",
            note: "KLS startet.",
            userId: user.id,
          },
        });
      }
    }
  });

  revalidatePath(`/sager/${caseId}`);
}

export async function saveKlsAction(formData: FormData) {
  const user = await requireSession();
  const reportId = str(formData, "reportId");
  const caseId = str(formData, "caseId");
  const notes = str(formData, "notes");
  const sign = str(formData, "sign") === "1";

  const report = await prisma.klsReport.findUnique({
    where: { id: reportId },
    include: { checks: { include: { item: true } }, case: true },
  });
  if (!report) throw new Error("KLS findes ikke.");

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
      throw new Error("Alle punkter skal tjekkes, før KLS kan underskrives.");
    }
    data.signedAt = new Date();
    data.signedById = user.id;
  }

  await prisma.klsReport.update({ where: { id: reportId }, data });

  if (sign && report.case.state === "KLS") {
    const result = canTransition("KLS", "KLAR_TIL_FAKTURA", { hasSignedKls: true });
    if (result.ok) {
      await prisma.case.update({
        where: { id: caseId },
        data: { state: "KLAR_TIL_FAKTURA" },
      });
      await prisma.caseEvent.create({
        data: {
          caseId,
          fromState: "KLS",
          toState: "KLAR_TIL_FAKTURA",
          note: "KLS underskrevet.",
          userId: user.id,
        },
      });
    }
  }

  revalidatePath(`/sager/${caseId}`);
}
