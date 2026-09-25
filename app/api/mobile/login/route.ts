import bcrypt from "bcryptjs";
import { signSession } from "@/lib/auth";
import { isRole } from "@/lib/catalog";
import { jsonError, jsonOk, mobileOptions } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) return jsonError("Udfyld e-mail og adgangskode.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return jsonError("Forkert e-mail eller adgangskode.", 401);
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok || !isRole(user.role)) return jsonError("Forkert e-mail eller adgangskode.", 401);

  const session = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = await signSession(session);
  return jsonOk({ token, user: session });
}
