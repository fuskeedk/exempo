"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { isRole } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/login?error=Udfyld%20e-mail%20og%20adgangskode.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    redirect("/login?error=Forkert%20e-mail%20eller%20adgangskode.");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok || !isRole(user.role)) {
    redirect("/login?error=Forkert%20e-mail%20eller%20adgangskode.");
  }

  const token = await signSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
