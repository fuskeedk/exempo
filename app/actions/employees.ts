"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { EMPLOYEE_COLORS, isRole, isTrade } from "@/lib/catalog";
import { parseDayParam } from "@/lib/dates";
import { parseKrToOre } from "@/lib/money";
import { lookupLogin, registerLogin, unregisterLogin } from "@/lib/platform";
import { tenantPrisma } from "@/lib/prisma";
import { employeeStatusReason, isPayType } from "@/lib/employees";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : EMPLOYEE_COLORS[0];
}

function payrollFields(formData: FormData) {
  const apprenticeRaw = str(formData, "apprenticeStart");
  const payTypeRaw = str(formData, "payType");
  const payType = isPayType(payTypeRaw) ? payTypeRaw : "TIMER";
  return {
    payType,
    monthlySalary: parseKrToOre(str(formData, "monthlySalary")),
    wageRate: payType === "FUNKTIONAER" ? 0 : parseKrToOre(str(formData, "wageRate")),
    employeeNumber: str(formData, "employeeNumber"),
    agreementCode: str(formData, "agreementCode") || "NONE",
    apprenticeStep: payType === "FUNKTIONAER" ? 0 : Number.parseInt(str(formData, "apprenticeStep"), 10) || 0,
    apprenticeStart: payType === "FUNKTIONAER" ? null : apprenticeRaw ? parseDayParam(apprenticeRaw) : null,
    managerId: str(formData, "managerId") || null,
  };
}

function revalidateEmployeePaths(id?: string) {
  revalidatePath("/administration");
  revalidatePath("/medarbejdere");
  revalidatePath("/kalender");
  revalidatePath("/timesedler");
  revalidatePath("/lon");
  if (id) revalidatePath(`/medarbejdere/${id}`);
}

function bounce(path: string, message: string): never {
  redirect(`${path}?besked=${encodeURIComponent(message)}`);
}

export async function createEmployeeAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const db = tenantPrisma(session.tenantSlug);
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password") || "exempo123";
  const role = str(formData, "role") || "MEDARBEJDER";
  const trade = str(formData, "trade") || "ANDET";
  if (!name || !email) bounce("/medarbejdere/ny", "Navn og e-mail er påkrævet.");

  const taken = await db.user.findUnique({ where: { email } });
  if (taken) bounce("/medarbejdere/ny", "E-mail er allerede i brug.");
  const elsewhere = lookupLogin(email);
  if (elsewhere && elsewhere !== session.tenantSlug) {
    bounce("/medarbejdere/ny", "E-mailen bruges allerede af en anden virksomhed.");
  }

  const count = await db.user.count();
  await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: isRole(role) ? role : "MEDARBEJDER",
      trade: isTrade(trade) ? trade : "ANDET",
      phone: str(formData, "phone"),
      hourlyRate: parseKrToOre(str(formData, "hourlyRate")) || 45000,
      color: parseColor(str(formData, "color")) || EMPLOYEE_COLORS[count % EMPLOYEE_COLORS.length],
      ...payrollFields(formData),
    },
  });
  registerLogin(email, session.tenantSlug);

  revalidateEmployeePaths();
  redirect("/medarbejdere");
}

export async function updateEmployeeAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const db = tenantPrisma(session.tenantSlug);
  const id = str(formData, "employeeId") || str(formData, "id");
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const role = str(formData, "role") || "MEDARBEJDER";
  const trade = str(formData, "trade") || "ANDET";
  const editPath = id ? `/medarbejdere/${id}` : "/medarbejdere";
  if (!id) bounce("/medarbejdere", "Medarbejderen findes ikke.");
  if (!name || !email) bounce(editPath, "Navn og e-mail er påkrævet.");

  const user = await db.user.findUnique({ where: { id } });
  if (!user) bounce("/medarbejdere", "Medarbejderen findes ikke.");

  const taken = await db.user.findFirst({ where: { email, NOT: { id } } });
  if (taken) bounce(editPath, "E-mail er allerede i brug.");
  const elsewhere = lookupLogin(email);
  if (elsewhere && elsewhere !== session.tenantSlug) {
    bounce(editPath, "E-mailen bruges allerede af en anden virksomhed.");
  }

  await db.user.update({
    where: { id },
    data: {
      name,
      email,
      role: isRole(role) ? role : user.role,
      trade: isTrade(trade) ? trade : user.trade,
      phone: str(formData, "phone"),
      hourlyRate: parseKrToOre(str(formData, "hourlyRate")) || user.hourlyRate,
      color: parseColor(str(formData, "color")),
      ...payrollFields(formData),
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });
  if (email !== user.email) {
    unregisterLogin(user.email);
    registerLogin(email, session.tenantSlug);
  } else {
    registerLogin(email, session.tenantSlug);
  }

  revalidateEmployeePaths(id);
  redirect("/medarbejdere");
}

async function employeeGuard(
  sessionId: string,
  target: { id: string; role: string; active: boolean },
  db: ReturnType<typeof tenantPrisma>,
  action: "deactivate" | "delete",
) {
  const remainingActiveAdmins = await db.user.count({
    where: { active: true, role: "ADMIN", NOT: { id: target.id } },
  });
  const [timeEntries, invoices, timesheets] = await Promise.all([
    db.timeEntry.count({ where: { userId: target.id } }),
    db.invoice.count({ where: { createdById: target.id } }),
    db.timesheet.count({ where: { userId: target.id } }),
  ]);
  return employeeStatusReason({
    isSelf: sessionId === target.id,
    isActiveAdmin: target.active && target.role === "ADMIN",
    remainingActiveAdmins,
    timeEntries,
    invoices,
    timesheets,
    action,
  });
}

export async function toggleEmployeeAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const db = tenantPrisma(session.tenantSlug);
  const id = str(formData, "employeeId") || str(formData, "id");
  const user = await db.user.findUnique({ where: { id } });
  if (!user) bounce("/medarbejdere", "Medarbejderen findes ikke.");
  if (user.active) {
    const blocked = await employeeGuard(session.id, user, db, "deactivate");
    if (blocked) bounce("/medarbejdere", blocked);
  }
  await db.user.update({
    where: { id },
    data: {
      active: !user.active,
      ...(user.active ? { timerCaseId: null, timerStartedAt: null } : {}),
    },
  });
  revalidateEmployeePaths(id);
  bounce(
    "/medarbejdere",
    user.active
      ? `${user.name} er deaktiveret og kan ikke logge ind.`
      : `${user.name} er aktiveret igen.`,
  );
}

export async function deleteEmployeeAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const db = tenantPrisma(session.tenantSlug);
  const id = str(formData, "employeeId") || str(formData, "id");
  const user = await db.user.findUnique({ where: { id } });
  if (!user) bounce("/medarbejdere", "Medarbejderen findes ikke.");
  const blocked = await employeeGuard(session.id, user, db, "delete");
  if (blocked) bounce("/medarbejdere", blocked);

  await db.$transaction([
    db.case.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
    db.case.updateMany({ where: { projectLeaderId: id }, data: { projectLeaderId: null } }),
    db.caseEvent.updateMany({ where: { userId: id }, data: { userId: null } }),
    db.document.updateMany({ where: { uploadedById: id }, data: { uploadedById: null } }),
    db.quote.updateMany({ where: { createdById: id }, data: { createdById: null } }),
    db.extraWork.updateMany({ where: { createdById: id }, data: { createdById: null } }),
    db.klsReport.updateMany({ where: { signedById: id }, data: { signedById: null } }),
    db.invoice.updateMany({ where: { createdById: id }, data: { createdById: null } }),
    db.purchase.updateMany({ where: { responsibleUserId: id }, data: { responsibleUserId: null } }),
    db.purchase.updateMany({ where: { approvedById: id }, data: { approvedById: null } }),
    db.user.updateMany({ where: { managerId: id }, data: { managerId: null } }),
    db.user.delete({ where: { id } }),
  ]);
  unregisterLogin(user.email);
  revalidateEmployeePaths();
  bounce("/medarbejdere", `${user.name} er slettet.`);
}
