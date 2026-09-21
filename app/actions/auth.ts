"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { isRole } from "@/lib/catalog";
import {
  defaultTenantSlug,
  ensureDefaultTenant,
  lookupLogin,
  readPlatform,
  registerLogin,
} from "@/lib/platform";
import { enterTenant, tenantPrisma } from "@/lib/prisma";

async function bootstrapDefaultLogins() {
  ensureDefaultTenant();
  const platform = readPlatform();
  if (Object.keys(platform.logins).length > 0) return;
  const slug = defaultTenantSlug();
  const users = await tenantPrisma(slug).user.findMany({ select: { email: true } });
  for (const user of users) registerLogin(user.email, slug);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/login?error=Udfyld%20e-mail%20og%20adgangskode.");
  }

  await bootstrapDefaultLogins();
  const mapped = lookupLogin(email);
  let slug = mapped ?? defaultTenantSlug();
  let user = await tenantPrisma(slug).user.findUnique({ where: { email } });
  if (!user?.active && !mapped) {
    slug = defaultTenantSlug();
    user = await tenantPrisma(slug).user.findUnique({ where: { email } });
  }
  if (!user?.active) {
    redirect("/login?error=Forkert%20e-mail%20eller%20adgangskode.");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok || !isRole(user.role)) {
    redirect("/login?error=Forkert%20e-mail%20eller%20adgangskode.");
  }

  enterTenant(slug);
  registerLogin(user.email, slug);

  const token = await signSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantSlug: slug,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: 0,
  });
  redirect("/login");
}
