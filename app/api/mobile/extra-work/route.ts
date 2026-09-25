import { parseKrToOre } from "@/lib/money";
import { isSession, jsonError, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const body = (await request.json().catch(() => null)) as {
    caseId?: string;
    title?: string;
    description?: string;
    amount?: string;
  } | null;
  const caseId = String(body?.caseId ?? "");
  const title = String(body?.title ?? "").trim();
  if (!caseId || !title) return jsonError("Sag og titel er påkrævet.");
  const extra = await prisma.extraWork.create({
    data: {
      caseId,
      title,
      description: String(body?.description ?? ""),
      amount: parseKrToOre(String(body?.amount ?? "0")),
      status: user.role === "MEDARBEJDER" ? "SENDT" : "KLADDE",
      createdById: user.id,
    },
  });
  return jsonOk({ ok: true, extra });
}
