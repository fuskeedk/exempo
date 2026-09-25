import { KLS_STATUSES, type KlsStatus } from "@/lib/catalog";
import { canTransition } from "@/lib/fsm";
import { requireFieldCase } from "@/lib/mobile-field";
import { isSession, jsonError, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    caseId?: string;
    templateId?: string;
    reportId?: string;
    notes?: string;
    sign?: boolean;
    checks?: { id: string; status: string; comment: string }[];
  } | null;
  const caseId = String(body?.caseId ?? "");
  const sag = await requireFieldCase(user, caseId);
  if (sag instanceof Response) return sag;

  if (body?.action === "start") {
    const template = await prisma.klsTemplate.findUnique({
      where: { id: String(body.templateId ?? "") },
      include: { items: true },
    });
    if (!template) return jsonError("Skabelon mangler.");
    if (sag.klsReports.length > 0) return jsonError("Der findes allerede et KLS på sagen.");
    await prisma.$transaction(async (tx) => {
      await tx.klsReport.create({
        data: {
          caseId,
          templateId: template.id,
          checks: {
            create: template.items.map((item) => ({
              itemId: item.id,
              status: "PENDING",
            })),
          },
        },
      });
      if (sag.state === "I_GANG" && canTransition("I_GANG", "KLS").ok) {
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
    });
    return jsonOk({ ok: true });
  }

  const report = await prisma.klsReport.findUnique({
    where: { id: String(body?.reportId ?? sag.klsReports[0]?.id ?? "") },
    include: { checks: true, case: true },
  });
  if (!report) return jsonError("KLS findes ikke.");

  for (const check of report.checks) {
    const incoming = body?.checks?.find((item) => item.id === check.id);
    const status = incoming?.status || check.status;
    const next: KlsStatus = KLS_STATUSES.includes(status as KlsStatus) ? (status as KlsStatus) : "PENDING";
    await prisma.klsCheck.update({
      where: { id: check.id },
      data: { status: next, comment: incoming?.comment ?? check.comment },
    });
  }

  const sign = Boolean(body?.sign);
  if (sign) {
    const pending = report.checks.some((check) => {
      const incoming = body?.checks?.find((item) => item.id === check.id);
      return (incoming?.status || check.status) === "PENDING";
    });
    if (pending) return jsonError("Alle punkter skal tjekkes, før KLS kan underskrives.");
  }

  await prisma.klsReport.update({
    where: { id: report.id },
    data: {
      notes: String(body?.notes ?? ""),
      ...(sign ? { signedAt: new Date(), signedById: user.id } : {}),
    },
  });

  if (sign && report.case.state === "KLS" && canTransition("KLS", "KLAR_TIL_FAKTURA", { hasSignedKls: true }).ok) {
    await prisma.case.update({ where: { id: caseId }, data: { state: "KLAR_TIL_FAKTURA" } });
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

  return jsonOk({ ok: true });
}
