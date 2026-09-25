import { parseDateInput } from "@/lib/dates";
import { isSession, jsonError, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const body = (await request.json().catch(() => null)) as {
    date?: string;
    type?: string;
    hours?: string;
    note?: string;
  } | null;
  const date = parseDateInput(String(body?.date ?? ""));
  if (!date) return jsonError("Dato mangler.");
  const hours = Number.parseFloat(String(body?.hours ?? "7.4").replace(",", ".")) || 7.4;
  const absence = await prisma.absence.create({
    data: {
      userId: user.id,
      date,
      hours,
      type: String(body?.type ?? "FERIE"),
      note: String(body?.note ?? ""),
    },
  });
  return jsonOk({ ok: true, absence });
}
