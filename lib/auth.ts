import { redirect } from "next/navigation";
import type { Role } from "@/lib/catalog";
import { enterTenant } from "@/lib/prisma";
import {
  canManageOffice,
  canSeePayroll,
  canSeeCaseCoverage,
  canSeeCoverage,
  coverageCaseWhere,
  getSession as readCookieSession,
  readSessionToken,
  SESSION_COOKIE,
  signSession,
  type SessionUser,
} from "@/lib/session-token";

export {
  canManageOffice,
  canSeePayroll,
  canSeeCaseCoverage,
  canSeeCoverage,
  coverageCaseWhere,
  readSessionToken,
  SESSION_COOKIE,
  signSession,
  type SessionUser,
};

export async function getSession(): Promise<SessionUser | null> {
  const session = await readCookieSession();
  if (session) enterTenant(session.tenantSlug);
  return session;
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  enterTenant(session.tenantSlug);
  return session;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    redirect("/");
  }
  return session;
}
