import { parseDateInput } from "@/lib/dates";
import { requireFieldCase } from "@/lib/mobile-field";
import { isSession, jsonError, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const body = (await request.json().catch(() => null)) as {
    caseId?: string;
    hours?: string;
    date?: string;
    kind?: string;
    note?: string;
  } | null;
  const caseId = String(body?.caseId ?? "");
  const sag = await requireFieldCase(user, caseId);
  if (sag instanceof Response) return sag;
  const hours = Number.parseFloat(String(body?.hours ?? "").replace(",", "."));
  const date = parseDateInput(String(body?.date ?? "")) ?? new Date();
  if (Number.isNaN(hours) || hours <= 0) return jsonError("Angiv gyldige timer.");
  const worker = await prisma.user.findUnique({ where: { id: user.id } });
  if (!worker) return jsonError("Bruger findes ikke.");
  await prisma.timeEntry.create({
    data: {
      caseId,
      userId: user.id,
      hours,
      hourlyRate: worker.hourlyRate,
      date,
      kind: String(body?.kind ?? "ARBEJDE"),
      note: String(body?.note ?? ""),
    },
  });
  return jsonOk({ ok: true, hours });
}
