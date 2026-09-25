import { addDays } from "date-fns";
import { canManageOffice } from "@/lib/auth";
import { STATE_LABELS, isCaseState } from "@/lib/fsm";
import { weekStart } from "@/lib/dates";
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

  return jsonOk({
    user,
    timer: worker?.timerCaseId
      ? { caseId: worker.timerCaseId, startedAt: worker.timerStartedAt }
      : null,
    products,
    jobs: jobs.map((job) => ({
      id: job.id,
      caseNumber: job.caseNumber,
      title: job.title,
      state: job.state,
      stateLabel: isCaseState(job.state) ? STATE_LABELS[job.state] : job.state,
      customerName: job.customerName,
      address: `${job.customerAddress}, ${job.customerPostal} ${job.customerCity}`.trim(),
      phone: job.customerPhone,
      scheduledStart: job.scheduledStart,
      extraWorks: job.extraWorks.map((extra) => ({
        id: extra.id,
        title: extra.title,
        amount: extra.amount,
        status: extra.status,
      })),
    })),
  });
}
