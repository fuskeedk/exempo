import { addDays } from "date-fns";
import { canManageOffice } from "@/lib/auth";
import { weekStart } from "@/lib/dates";
import { serializeJob } from "@/lib/mobile-field";
import { isSession, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function GET(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;

  const office = canManageOffice(user.role);
  const weekFrom = weekStart(new Date());
  const weekTo = addDays(weekFrom, 7);
  const worker = await prisma.user.findUnique({ where: { id: user.id } });

  const jobs = await prisma.case.findMany({
    where: {
      state: { notIn: ["AFSLUTTET", "ANNULLERET"] },
      OR: [
        { assignedToId: user.id },
        ...(office ? [{ scheduledStart: { gte: weekFrom, lt: weekTo } }] : []),
      ],
    },
    orderBy: { scheduledStart: "asc" },
    include: { extraWorks: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, sku: true, name: true, barcode: true, unit: true },
  });
  const timeEntries = await prisma.timeEntry.findMany({
    where: office ? undefined : { userId: user.id },
    include: { case: true },
    orderBy: { date: "desc" },
    take: 40,
  });
  const absences = await prisma.absence.findMany({
    where: office ? undefined : { userId: user.id },
    orderBy: { date: "desc" },
    take: 20,
  });
  const klsTemplates = await prisma.klsTemplate.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, trade: true },
  });
  const cases = await prisma.case.findMany({
    where: office ? undefined : { assignedToId: user.id },
    orderBy: { createdAt: "desc" },
    include: { extraWorks: { orderBy: { createdAt: "desc" }, take: 3 } },
  });
  const timerCase = worker?.timerCaseId
    ? jobs.find((job) => job.id === worker.timerCaseId) ??
      (await prisma.case.findUnique({ where: { id: worker.timerCaseId } }))
    : null;

  return jsonOk({
    user,
    timer: timerCase && worker?.timerStartedAt
      ? {
          caseId: timerCase.id,
          startedAt: worker.timerStartedAt,
          caseNumber: timerCase.caseNumber,
          title: timerCase.title,
        }
      : null,
    products,
    klsTemplates,
    jobs: jobs.map(serializeJob),
    cases: cases.map(serializeJob),
    timeEntries: timeEntries.map((entry) => ({
      id: entry.id,
      caseId: entry.caseId,
      caseNumber: entry.case.caseNumber,
      hours: entry.hours,
      kind: entry.kind,
      note: entry.note,
      date: entry.date,
    })),
    absences: absences.map((item) => ({
      id: item.id,
      date: item.date,
      hours: item.hours,
      type: item.type,
      note: item.note,
    })),
    weekFrom,
    weekTo,
  });
}
