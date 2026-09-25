import { isSession, jsonError, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const body = (await request.json().catch(() => null)) as { caseId?: string; action?: string } | null;
  const action = body?.action === "stop" ? "stop" : "start";

  if (action === "start") {
    const caseId = String(body?.caseId ?? "");
    if (!caseId) return jsonError("Sag mangler.");
    await prisma.user.update({
      where: { id: user.id },
      data: { timerCaseId: caseId, timerStartedAt: new Date() },
    });
    return jsonOk({ ok: true, running: true, caseId });
  }

  const worker = await prisma.user.findUnique({ where: { id: user.id } });
  if (!worker?.timerCaseId || !worker.timerStartedAt) {
    return jsonError("Ingen aktiv timer.");
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
  await prisma.user.update({
    where: { id: user.id },
    data: { timerCaseId: null, timerStartedAt: null },
  });
  return jsonOk({ ok: true, running: false, hours });
}
