"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageOffice, requireRole, requireSession } from "@/lib/auth";
import { parseKrToOre } from "@/lib/money";
import { listAgreements } from "@/lib/payroll-store";
import { tenantPrisma } from "@/lib/prisma";
import { isTimesheetPeriod, type TimesheetPeriod } from "@/lib/timesheets";
import { previewTimesheet, timesheetBillableHours } from "@/lib/timesheet-preview";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function pctField(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(str(formData, key), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(200, value));
}

function revalidatePayroll() {
  revalidatePath("/timesedler");
  revalidatePath("/lon");
  revalidatePath("/overenskomster");
  revalidatePath("/medarbejdere");
  revalidatePath("/min-dag");
}

export async function submitTimesheetAction(formData: FormData) {
  const session = await requireSession();
  const db = tenantPrisma(session.tenantSlug);
  const periodRaw = str(formData, "period") || "UGE";
  const period: TimesheetPeriod = isTimesheetPeriod(periodRaw) ? periodRaw : "UGE";
  const dato = str(formData, "dato") || new Date().toISOString().slice(0, 10);
  const around = new Date(`${dato}T12:00:00`);
  const forUserId = str(formData, "userId") || session.id;
  if (forUserId !== session.id && !canManageOffice(session.role)) {
    redirect(`/timesedler?periode=${period}&dato=${dato}&besked=${encodeURIComponent("Du kan kun aflevere dine egne timer.")}`);
  }

  const preview = await previewTimesheet(forUserId, period, around, db);
  if (!preview) {
    redirect(`/timesedler?periode=${period}&dato=${dato}&besked=${encodeURIComponent("Medarbejderen findes ikke.")}`);
  }
  const existing = await db.timesheet.findUnique({
    where: { userId_period_start: { userId: forUserId, period, start: preview.start } },
  });
  if (existing?.status === "GODKENDT") {
    redirect(`/timesedler?periode=${period}&dato=${dato}&besked=${encodeURIComponent("Perioden er allerede godkendt.")}`);
  }
  if (timesheetBillableHours(preview) <= 0) {
    redirect(
      `/timesedler?periode=${period}&dato=${dato}&besked=${encodeURIComponent(
        preview.payType === "FUNKTIONAER"
          ? "Funktionærer afleverer lønperioden med fast månedsløn. Sæt månedsløn på medarbejderen først."
          : "Der er ingen registreret tid eller sygeløn i perioden.",
      )}`,
    );
  }

  const payload = {
    end: preview.end,
    status: "AFLEVERET" as const,
    note: str(formData, "note"),
    rejectNote: "",
    submittedAt: new Date(),
    approvedAt: null,
    approvedById: null,
    agreementCode: preview.rates.code,
    agreementName: preview.rates.name,
    wageRate: preview.wageOre,
    costRate: preview.worker.hourlyRate,
    payType: preview.payType,
    monthlySalary: preview.monthlySalary,
    apprenticeStep: preview.apprenticeStep,
    normalHours: preview.normalHours,
    overtime50Hours: preview.overtime50Hours,
    overtime100Hours: preview.overtime100Hours,
    absenceHours: preview.absenceHours,
    sickHours: preview.sickHours,
    childSickHours: preview.childSickHours,
    normalOre: preview.normalOre,
    overtimeOre: preview.overtimeOre,
    sickOre: preview.sickOre,
    holidayPayOre: preview.holidayPayOre,
    shOre: preview.shOre,
    fritvalgOre: preview.fritvalgOre,
    pensionEmployerOre: preview.pensionEmployerOre,
    pensionEmployeeOre: preview.pensionEmployeeOre,
    employerCostOre: preview.employerCostOre,
    daysJson: JSON.stringify(preview.days.map((day) => ({ date: day.date.toISOString(), hours: day.hours }))),
  };

  await db.timesheet.upsert({
    where: { userId_period_start: { userId: forUserId, period, start: preview.start } },
    create: { userId: forUserId, period, start: preview.start, ...payload },
    update: payload,
  });

  revalidatePayroll();
  redirect(`/timesedler?periode=${period}&dato=${dato}&besked=${encodeURIComponent("Timesedlen er afleveret til godkendelse.")}`);
}

export async function decideTimesheetAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const db = tenantPrisma(session.tenantSlug);
  const id = str(formData, "id");
  const decision = str(formData, "decision");
  const sheet = await db.timesheet.findUnique({ where: { id }, include: { user: true } });
  if (!sheet) redirect("/lon?besked=" + encodeURIComponent("Timesedlen findes ikke."));
  if (session.role === "PL" && sheet.user.managerId && sheet.user.managerId !== session.id) {
    redirect("/lon?besked=" + encodeURIComponent("Du kan kun godkende timer for dine medarbejdere."));
  }
  if (decision === "godkend") {
    await db.timesheet.update({
      where: { id },
      data: { status: "GODKENDT", approvedAt: new Date(), approvedById: session.id, rejectNote: "" },
    });
  } else {
    await db.timesheet.update({
      where: { id },
      data: {
        status: "AFVIST",
        approvedAt: null,
        approvedById: session.id,
        rejectNote: str(formData, "rejectNote") || "Afvist",
      },
    });
  }
  revalidatePayroll();
  redirect(`/lon?besked=${encodeURIComponent(decision === "godkend" ? "Timesedlen er godkendt." : "Timesedlen er sendt tilbage.")}`);
}

export async function reopenTimesheetAction(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const db = tenantPrisma(session.tenantSlug);
  const id = str(formData, "id");
  await db.timesheet.update({
    where: { id },
    data: { status: "AFVIST", approvedAt: null, rejectNote: "Åbnet igen til ny aflevering." },
  });
  revalidatePayroll();
  redirect("/lon?besked=" + encodeURIComponent("Timesedlen er åbnet igen."));
}

export async function saveAgreementAction(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const db = tenantPrisma(session.tenantSlug);
  const code = str(formData, "code");
  const agreements = await listAgreements(db);
  const current = agreements.find((row) => row.code === code);
  if (!current) redirect("/overenskomster?besked=" + encodeURIComponent("Overenskomsten findes ikke."));

  const apprentices = current.apprentices.map((row) => ({
    ...row,
    wageOre: parseKrToOre(str(formData, `apprentice_${row.step}`)) || row.wageOre,
  }));

  await db.collectiveAgreement.update({
    where: { code },
    data: {
      pensionEmployerBps: Number.parseInt(str(formData, "pensionEmployerBps"), 10) || 0,
      pensionEmployeeBps: Number.parseInt(str(formData, "pensionEmployeeBps"), 10) || 0,
      holidayPayBps: Number.parseInt(str(formData, "holidayPayBps"), 10) || 0,
      shBps: Number.parseInt(str(formData, "shBps"), 10) || 0,
      fritvalgBps: Number.parseInt(str(formData, "fritvalgBps"), 10) || 0,
      overtimeFirstHours: Number.parseInt(str(formData, "overtimeFirstHours"), 10) || 0,
      overtimeFirstPct: Number.parseInt(str(formData, "overtimeFirstPct"), 10) || 0,
      overtimeRestPct: Number.parseInt(str(formData, "overtimeRestPct"), 10) || 0,
      overtimeFirstAddonOre: parseKrToOre(str(formData, "overtimeFirstAddon")),
      overtimeRestAddonOre: parseKrToOre(str(formData, "overtimeRestAddon")),
      sickPayPct: pctField(formData, "sickPayPct", current.sickPayPct),
      childSickPayPct: pctField(formData, "childSickPayPct", current.childSickPayPct),
      apprenticeJson: JSON.stringify(apprentices),
      notes: str(formData, "notes") || current.notes,
    },
  });
  revalidatePayroll();
  redirect(`/overenskomster?kode=${code}&besked=${encodeURIComponent("Satser er gemt.")}`);
}
