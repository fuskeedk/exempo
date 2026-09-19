"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { EMPLOYEE_COLORS, isRole, isTrade } from "@/lib/catalog";
import { parseKrToOre } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createEmployeeAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password") || "exempo123";
  const role = str(formData, "role") || "MEDARBEJDER";
  const trade = str(formData, "trade") || "ANDET";
  if (!name || !email) throw new Error("Navn og e-mail er påkrævet.");

  const count = await prisma.user.count();
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: isRole(role) ? role : "MEDARBEJDER",
      trade: isTrade(trade) ? trade : "ANDET",
      phone: str(formData, "phone"),
      hourlyRate: parseKrToOre(str(formData, "hourlyRate")) || 45000,
      color: EMPLOYEE_COLORS[count % EMPLOYEE_COLORS.length],
    },
  });

  revalidatePath("/medarbejdere");
  revalidatePath("/kalender");
  redirect("/medarbejdere");
}

export async function toggleEmployeeAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("Medarbejderen findes ikke.");
  await prisma.user.update({
    where: { id },
    data: { active: !user.active },
  });
  revalidatePath("/medarbejdere");
  revalidatePath("/kalender");
}
