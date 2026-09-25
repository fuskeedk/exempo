import { canManageOffice, type SessionUser } from "@/lib/auth";
import { STATE_LABELS, allowedTransitions, isCaseState } from "@/lib/fsm";
import { jsonError } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const FIELD_TRANSITIONS = ["BESIGTIGELSE", "PLANLAGT", "I_GANG", "KLS"] as const;

export async function requireFieldCase(user: SessionUser, caseId: string) {
  const sag = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      extraWorks: { orderBy: { createdAt: "desc" }, take: 20 },
      materials: { orderBy: { createdAt: "desc" }, take: 30 },
      timeEntries: { include: { user: true }, orderBy: { date: "desc" }, take: 30 },
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
      klsReports: {
        include: {
          template: true,
          signedBy: true,
          checks: { include: { item: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!sag) return jsonError("Sagen findes ikke.", 404);
  if (!canManageOffice(user.role) && sag.assignedToId !== user.id) {
    return jsonError("Du har ikke adgang til sagen.", 403);
  }
  return sag;
}

export function fieldTransitions(state: string, role: string) {
  if (!isCaseState(state)) return [];
  const next = allowedTransitions(state);
  if (role === "MEDARBEJDER") {
    return next.filter((item) => (FIELD_TRANSITIONS as readonly string[]).includes(item));
  }
  return next;
}

export function serializeJob(job: {
  id: string;
  caseNumber: string;
  title: string;
  state: string;
  customerName: string;
  customerAddress: string;
  customerPostal: string;
  customerCity: string;
  customerPhone: string;
  scheduledStart: Date | null;
  scheduledEnd?: Date | null;
  description?: string;
  extraWorks?: { id: string; title: string; amount: number; status: string }[];
}) {
  return {
    id: job.id,
    caseNumber: job.caseNumber,
    title: job.title,
    description: job.description ?? "",
    state: job.state,
    stateLabel: isCaseState(job.state) ? STATE_LABELS[job.state] : job.state,
    customerName: job.customerName,
    address: `${job.customerAddress}, ${job.customerPostal} ${job.customerCity}`.trim(),
    phone: job.customerPhone,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd ?? null,
    extraWorks: (job.extraWorks ?? []).map((extra) => ({
      id: extra.id,
      title: extra.title,
      amount: extra.amount,
      status: extra.status,
    })),
  };
}
