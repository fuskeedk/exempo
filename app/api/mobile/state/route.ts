import { canTransition, isCaseState } from "@/lib/fsm";
import { fieldTransitions, requireFieldCase } from "@/lib/mobile-field";
import { isSession, jsonError, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const body = (await request.json().catch(() => null)) as {
    caseId?: string;
    toState?: string;
    note?: string;
  } | null;
  const caseId = String(body?.caseId ?? "");
  const toState = String(body?.toState ?? "");
  const sag = await requireFieldCase(user, caseId);
  if (sag instanceof Response) return sag;
  if (!isCaseState(toState) || !fieldTransitions(sag.state, user.role).includes(toState)) {
    return jsonError("Overgangen er ikke tilladt i marken.");
  }
  const signed = sag.klsReports.some((report) => report.signedAt);
  const result = canTransition(sag.state, toState, {
    hasSignedKls: signed,
    isScheduled: Boolean(sag.assignedToId && sag.scheduledStart),
  });
  if (!result.ok) return jsonError(result.reason);
  await prisma.case.update({ where: { id: caseId }, data: { state: toState } });
  await prisma.caseEvent.create({
    data: {
      caseId,
      fromState: sag.state,
      toState,
      note: String(body?.note ?? "Opdateret fra appen."),
      userId: user.id,
    },
  });
  return jsonOk({ ok: true, state: toState });
}
