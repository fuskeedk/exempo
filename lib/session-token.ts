import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/lib/catalog";
import { isRole } from "@/lib/catalog";

export const SESSION_COOKIE = "exempo_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantSlug: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET mangler.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    tenantSlug: user.tenantSlug,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = payload.sub;
    const name = typeof payload.name === "string" ? payload.name : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const role = typeof payload.role === "string" && isRole(payload.role) ? payload.role : null;
    const tenantSlug = typeof payload.tenantSlug === "string" && payload.tenantSlug ? payload.tenantSlug : "exempo";
    if (!id || !name || !email || !role) return null;
    return { id, name, email, role, tenantSlug };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export function canManageOffice(role: Role): boolean {
  return role === "ADMIN" || role === "PL";
}

export function canSeePayroll(role: Role): boolean {
  return role === "ADMIN";
}

export function canSeeCoverage(role: Role): boolean {
  return role === "ADMIN" || role === "PL";
}

export function canSeeCaseCoverage(user: SessionUser, projectLeaderId: string | null): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "PL") return projectLeaderId === user.id;
  return false;
}

export function coverageCaseWhere(user: SessionUser): { projectLeaderId?: string } {
  return user.role === "PL" ? { projectLeaderId: user.id } : {};
}
