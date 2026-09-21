"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageOffice, requireSession, type SessionUser } from "@/lib/auth";
import {
  atTimeOnDay,
  billedHours,
  dayBounds,
  expectedHoursForDay,
  fullDaySlot,
  parseDateInput,
  parseDayParam,
  shiftScheduleToDay,
  slotAtHour,
  overlapsDay,
} from "@/lib/dates";
import { isAbsenceKind, isAbsenceType } from "@/lib/catalog";
import { isTimeLocked, TIME_LOCKED_MESSAGE, type CaseState } from "@/lib/fsm";
import { parseKrToOre } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function calendarOwner(actor: SessionUser, forUserId?: string) {
  if (!forUserId || forUserId === actor.id) {
    const self = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!self) throw new Error("Bruger findes ikke.");
    return self;
  }
  if (!canManageOffice(actor.role)) {
    throw new Error("Du kan kun se din egen kalender.");
  }
  const worker = await prisma.user.findUnique({ where: { id: forUserId } });
  if (!worker || !worker.active) throw new Error("Medarbejderen findes ikke.");
  return worker;
}

export async function startTimerAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  if (caseId) {
    const sag = await prisma.case.findUnique({ where: { id: caseId }, select: { state: true } });
    if (sag && isTimeLocked(sag.state)) {
      throw new Error(TIME_LOCKED_MESSAGE);
    }
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { timerCaseId: caseId, timerStartedAt: new Date() },
  });
  revalidatePath("/min-dag");
  revalidatePath(`/sager/${caseId}`);
}

export async function stopTimerAction() {
  const user = await requireSession();
  const worker = await prisma.user.findUnique({ where: { id: user.id } });
  if (!worker?.timerCaseId || !worker.timerStartedAt) {
    throw new Error("Ingen aktiv timer.");
  }
  const sag = await prisma.case.findUnique({
    where: { id: worker.timerCaseId },
    select: { state: true },
  });
  if (sag && isTimeLocked(sag.state)) {
    throw new Error(TIME_LOCKED_MESSAGE);
  }
  const hours = Math.max(
    0.25,
    Math.round(((Date.now() - worker.timerStartedAt.getTime()) / 36e5) * 4) / 4,
  );
  await prisma.timeEntry.create({
    data: {
      caseId: worker.timerCaseId,
      userId: user.id,
      hours,
      hourlyRate: worker.hourlyRate,
      date: new Date(),
      kind: "ARBEJDE",
      note: "Stopur",
    },
  });
  const caseId = worker.timerCaseId;
  await prisma.user.update({
    where: { id: user.id },
    data: { timerCaseId: null, timerStartedAt: null },
  });
  revalidatePath("/min-dag");
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/tid");
}

export async function createExtraWorkAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  const title = str(formData, "title");
  if (!title) throw new Error("Titel på ekstraarbejde mangler.");
  await prisma.extraWork.create({
    data: {
      caseId,
      title,
      description: str(formData, "description"),
      amount: parseKrToOre(str(formData, "amount")),
      status: user.role === "MEDARBEJDER" ? "SENDT" : "KLADDE",
      createdById: user.id,
    },
  });
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/min-dag");
  if (str(formData, "redirect") === "1") {
    redirect(`/sager/${caseId}#opfoelgning`);
  }
}

export async function setExtraWorkStatusAction(formData: FormData) {
  const user = await requireSession();
  const id = str(formData, "extraWorkId");
  const status = str(formData, "status");
  const extra = await prisma.extraWork.update({
    where: { id },
    data: { status },
  });
  if (status === "GODKENDT" || status === "SENDT") {
    const sag = await prisma.case.findUnique({ where: { id: extra.caseId } });
    await prisma.caseEvent.create({
      data: {
        caseId: extra.caseId,
        fromState: sag?.state ?? null,
        toState: sag?.state ?? extra.status,
        note:
          status === "GODKENDT"
            ? `Ekstraarbejde godkendt: ${extra.title}`
            : `Ekstraarbejde sendt til kunden: ${extra.title}`,
        userId: user.id,
      },
    });
  }
  revalidatePath(`/sager/${extra.caseId}`);
  revalidatePath("/min-dag");
}

export async function createAbsenceAction(formData: FormData) {
  const user = await requireSession();
  const date = parseDateInput(str(formData, "date"));
  const hours = Number.parseFloat(str(formData, "hours").replace(",", ".")) || expectedHoursForDay(date ?? new Date());
  if (!date) throw new Error("Dato mangler.");
  const owner = await calendarOwner(user, str(formData, "userId") || undefined);
  const typeRaw = str(formData, "type") || "FERIE";
  await prisma.absence.create({
    data: {
      userId: owner.id,
      date,
      hours,
      type: isAbsenceType(typeRaw) ? typeRaw : "FERIE",
      note: str(formData, "note"),
    },
  });
  revalidatePath("/tid");
  revalidatePath("/min-dag");
  revalidatePath("/kalender");
}

export async function saveTimesheetActivity(input: {
  intent: "plan" | "register";
  kind: "ARBEJDE" | "FRAVAER";
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  allDay: boolean;
  caseId?: string;
  note?: string;
  forUserId?: string;
  absenceType?: string;
  activityId?: string;
  source?: "case" | "activity";
}) {
  const user = await requireSession();
  const day = parseDayParam(input.date);
  const allDay = Boolean(input.allDay);
  const slot = allDay ? fullDaySlot(day) : {
    start: atTimeOnDay(day, input.startHour, input.startMinute),
    end: atTimeOnDay(day, input.endHour, input.endMinute),
  };
  const start = slot.start;
  const end = slot.end;
  if (end <= start) {
    throw new Error("Sluttid skal være efter start.");
  }
  const hours = billedHours(start, end, allDay);
  const note = (input.note ?? "").slice(0, 1500);
  const caseId = input.caseId?.trim() || "";
  const worker = await calendarOwner(user, input.forUserId);
  const office = canManageOffice(user.role);

  if (input.kind === "FRAVAER") {
    const requestedType = input.absenceType ?? "FERIE";
    const absenceType = isAbsenceType(requestedType) ? requestedType : "FERIE";
    const status = input.intent === "register" ? "REGISTRERET" : "PLANLAGT";
    let absenceId: string | undefined;
    if (input.intent === "register") {
      const absence = await prisma.absence.create({
        data: {
          userId: worker.id,
          date: day,
          hours: Math.max(0.25, hours),
          type: absenceType,
          note,
        },
      });
      absenceId = absence.id;
    }
    if (!allDay) {
      await prisma.calendarActivity.create({
        data: {
          userId: worker.id,
          start,
          end,
          kind: absenceType,
          status,
          note,
          allDay: false,
          absenceId,
        },
      });
    } else if (input.intent === "plan") {
      await prisma.calendarActivity.create({
        data: {
          userId: worker.id,
          start,
          end,
          kind: absenceType,
          status: "PLANLAGT",
          note,
          allDay: true,
        },
      });
    }
  } else if (input.intent === "plan") {
    if (caseId) {
      const sag = await prisma.case.findUnique({ where: { id: caseId } });
      if (!sag) throw new Error("Sagen findes ikke.");
      if (!office && sag.assignedToId && sag.assignedToId !== user.id) {
        throw new Error("Du kan kun booke sager på dig selv.");
      }
      const assignedToId = office ? worker.id : user.id;
      const nextState: CaseState =
        sag.state === "NY" || sag.state === "BESIGTIGELSE" ? "PLANLAGT" : (sag.state as CaseState);
      await prisma.$transaction(async (tx) => {
        await tx.case.update({
          where: { id: caseId },
          data: {
            assignedToId,
            scheduledStart: start,
            scheduledEnd: end,
            state: nextState,
          },
        });
        await tx.caseEvent.create({
          data: {
            caseId,
            fromState: sag.state,
            toState: nextState,
            note: note || (nextState !== sag.state ? "Sagen er lagt i kalenderen." : "Sagen er flyttet i kalenderen."),
            userId: user.id,
          },
        });
      });
    } else {
      await prisma.calendarActivity.create({
        data: {
          userId: worker.id,
          start,
          end,
          kind: "ARBEJDE",
          status: "PLANLAGT",
          note,
          allDay,
        },
      });
    }
  } else {
    if (caseId) {
      const sag = await prisma.case.findUnique({ where: { id: caseId }, select: { state: true, scheduledStart: true, scheduledEnd: true } });
      if (sag && isTimeLocked(sag.state)) {
        throw new Error(TIME_LOCKED_MESSAGE);
      }
    }
    const { start: dayStart, end: dayEnd } = dayBounds(day);
    let existing = input.activityId
      ? await prisma.calendarActivity.findUnique({ where: { id: input.activityId } })
      : null;
    if (!existing) {
      existing = await prisma.calendarActivity.findFirst({
        where: {
          userId: worker.id,
          kind: "ARBEJDE",
          caseId: caseId || null,
          start: { lt: end },
          end: { gt: start },
        },
        orderBy: { status: "desc" },
      });
    }
    if (existing) {
      let entryId = existing.timeEntryId;
      if (entryId) {
        await prisma.timeEntry.update({
          where: { id: entryId },
          data: {
            caseId: caseId || null,
            hours: Math.max(0.25, hours),
            date: day,
            note,
          },
        });
      } else {
        const entry = await prisma.timeEntry.create({
          data: {
            caseId: caseId || null,
            userId: worker.id,
            hours: Math.max(0.25, hours),
            hourlyRate: worker.hourlyRate,
            date: day,
            kind: "ARBEJDE",
            note,
          },
        });
        entryId = entry.id;
      }
      await prisma.calendarActivity.update({
        where: { id: existing.id },
        data: {
          start,
          end,
          caseId: caseId || existing.caseId,
          kind: "ARBEJDE",
          status: "REGISTRERET",
          note,
          allDay,
          timeEntryId: entryId,
        },
      });
    } else {
      const entry = await prisma.timeEntry.create({
        data: {
          caseId: caseId || null,
          userId: worker.id,
          hours: Math.max(0.25, hours),
          hourlyRate: worker.hourlyRate,
          date: day,
          kind: "ARBEJDE",
          note,
        },
      });
      existing = await prisma.calendarActivity.create({
        data: {
          userId: worker.id,
          caseId: caseId || null,
          start,
          end,
          kind: "ARBEJDE",
          status: "REGISTRERET",
          note,
          allDay,
          timeEntryId: entry.id,
        },
      });
    }

    if (caseId) {
      const sag = await prisma.case.findUnique({
        where: { id: caseId },
        select: { scheduledStart: true, scheduledEnd: true },
      });
      if (
        sag?.scheduledStart &&
        sag.scheduledEnd &&
        overlapsDay(sag.scheduledStart, sag.scheduledEnd, day)
      ) {
        await prisma.case.update({
          where: { id: caseId },
          data: { scheduledStart: null, scheduledEnd: null },
        });
      }
      await prisma.calendarActivity.deleteMany({
        where: {
          userId: worker.id,
          caseId,
          status: "PLANLAGT",
          start: { lt: dayEnd },
          end: { gt: dayStart },
          id: { not: existing.id },
        },
      });
    } else {
      await prisma.calendarActivity.deleteMany({
        where: {
          userId: worker.id,
          status: "PLANLAGT",
          start: { lt: dayEnd },
          end: { gt: dayStart },
          caseId: null,
          id: { not: existing.id },
        },
      });
    }
    const duplicates = await prisma.calendarActivity.findMany({
      where: {
        userId: worker.id,
        kind: "ARBEJDE",
        caseId: caseId || null,
        status: "REGISTRERET",
        start,
        end,
        id: { not: existing.id },
      },
    });
    for (const duplicate of duplicates) {
      await prisma.calendarActivity.delete({ where: { id: duplicate.id } });
      if (duplicate.timeEntryId) {
        await prisma.timeEntry.delete({ where: { id: duplicate.timeEntryId } }).catch(() => undefined);
      }
    }
  }

  if (caseId) revalidatePath(`/sager/${caseId}`);
  revalidatePath("/min-dag");
  revalidatePath("/tid");
  revalidatePath("/kalender");
  revalidatePath("/");
}

export async function moveTimesheetActivity(input: {
  activityId: string;
  date: string;
  fromDate?: string;
  forUserId?: string;
  hour?: number;
  minute?: number;
}) {
  const user = await requireSession();
  const worker = await calendarOwner(user, input.forUserId);
  const office = canManageOffice(user.role);
  const activity = await prisma.calendarActivity.findUnique({ where: { id: input.activityId } });
  if (!activity) throw new Error("Aktiviteten findes ikke.");
  if (!office && activity.userId !== user.id) {
    throw new Error("Du kan kun flytte din egen tid.");
  }
  if (activity.status === "REGISTRERET") {
    throw new Error("Registreret tid kan ikke flyttes. Slet den, og opret den igen.");
  }

  const toDay = parseDayParam(input.date);
  const fromDay = input.fromDate ? parseDayParam(input.fromDate) : toDay;
  const durationMs = Math.max(15 * 60 * 1000, activity.end.getTime() - activity.start.getTime());
  const hour = Number.isFinite(input.hour) ? Number(input.hour) : null;
  const slot =
    hour !== null
      ? slotAtHour(toDay, hour, durationMs, input.minute ?? 0)
      : shiftScheduleToDay(activity.start, activity.end, fromDay, toDay);
  if (slot.end <= slot.start) {
    throw new Error("Sluttid skal være efter start.");
  }

  await prisma.calendarActivity.update({
    where: { id: activity.id },
    data: {
      start: slot.start,
      end: slot.end,
      userId: worker.id,
    },
  });

  if (activity.caseId) revalidatePath(`/sager/${activity.caseId}`);
  revalidatePath("/min-dag");
  revalidatePath("/tid");
  revalidatePath("/kalender");
  revalidatePath("/");
}

export async function resizeTimesheetActivity(input: {
  activityId: string;
  date: string;
  endHour: number;
  endMinute: number;
  forUserId?: string;
}) {
  const user = await requireSession();
  const office = canManageOffice(user.role);
  const activity = await prisma.calendarActivity.findUnique({ where: { id: input.activityId } });
  if (!activity) throw new Error("Aktiviteten findes ikke.");
  if (!office && activity.userId !== user.id) {
    throw new Error("Du kan kun ændre din egen tid.");
  }
  if (activity.status === "REGISTRERET") {
    throw new Error("Registreret tid kan ikke trækkes. Slet den, og opret den igen.");
  }

  const day = parseDayParam(input.date);
  const snappedMinute = Math.round(input.endMinute / 15) * 15;
  const end =
    snappedMinute >= 60
      ? atTimeOnDay(day, input.endHour + 1, 0)
      : atTimeOnDay(day, input.endHour, Math.max(0, snappedMinute));
  if (end.getTime() - activity.start.getTime() < 15 * 60 * 1000) {
    throw new Error("En booking skal være mindst 15 minutter.");
  }

  await prisma.calendarActivity.update({
    where: { id: activity.id },
    data: { end },
  });

  if (activity.caseId) revalidatePath(`/sager/${activity.caseId}`);
  revalidatePath("/min-dag");
  revalidatePath("/kalender");
  revalidatePath("/");
}

export async function deleteTimesheetActivity(input: {
  activityId?: string;
  caseId?: string;
  source?: "case" | "activity";
  forUserId?: string;
}) {
  const user = await requireSession();
  const worker = await calendarOwner(user, input.forUserId);
  const office = canManageOffice(user.role);

  if (input.activityId) {
    const activity = await prisma.calendarActivity.findUnique({ where: { id: input.activityId } });
    if (!activity) throw new Error("Aktiviteten findes ikke.");
    if (!office && activity.userId !== user.id) {
      throw new Error("Du kan kun slette din egen tid.");
    }
    if (office && activity.userId !== worker.id && activity.userId !== user.id) {
      throw new Error("Aktiviteten tilhører en anden medarbejder.");
    }
    await removeLinkedTime(activity);
    await prisma.calendarActivity.delete({ where: { id: activity.id } });
    if (activity.caseId) revalidatePath(`/sager/${activity.caseId}`);
  } else if (input.source === "case" && input.caseId) {
    const sag = await prisma.case.findUnique({ where: { id: input.caseId } });
    if (!sag) throw new Error("Sagen findes ikke.");
    if (!office && sag.assignedToId && sag.assignedToId !== user.id) {
      throw new Error("Du kan kun slette din egen planlagte tid.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.case.update({
        where: { id: sag.id },
        data: { scheduledStart: null, scheduledEnd: null },
      });
      await tx.caseEvent.create({
        data: {
          caseId: sag.id,
          fromState: sag.state,
          toState: sag.state,
          note: "Planlagt tid er fjernet fra kalenderen.",
          userId: user.id,
        },
      });
    });
    revalidatePath(`/sager/${sag.id}`);
  } else {
    throw new Error("Der er ikke noget at slette.");
  }

  revalidatePath("/min-dag");
  revalidatePath("/tid");
  revalidatePath("/kalender");
  revalidatePath("/");
}

async function removeLinkedTime(activity: {
  userId: string;
  start: Date;
  end: Date;
  caseId: string | null;
  kind: string;
  status: string;
  timeEntryId: string | null;
  absenceId: string | null;
}) {
  if (activity.timeEntryId) {
    await prisma.timeEntry.deleteMany({ where: { id: activity.timeEntryId } });
  } else if (activity.status === "REGISTRERET" && !isAbsenceKind(activity.kind)) {
    const hours = Math.round(((activity.end.getTime() - activity.start.getTime()) / 3_600_000) * 4) / 4;
    const { start, end } = dayBounds(activity.start);
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: activity.userId,
        date: { gte: start, lt: end },
        kind: "ARBEJDE",
        caseId: activity.caseId,
      },
      orderBy: { createdAt: "desc" },
    });
    const match = entries.find((entry) => Math.abs(entry.hours - hours) < 0.05);
    if (match) await prisma.timeEntry.delete({ where: { id: match.id } });
  }

  if (activity.absenceId) {
    await prisma.absence.deleteMany({ where: { id: activity.absenceId } });
  } else if (activity.status === "REGISTRERET" && isAbsenceKind(activity.kind)) {
    const { start, end } = dayBounds(activity.start);
    const found = await prisma.absence.findFirst({
      where: {
        userId: activity.userId,
        date: { gte: start, lt: end },
        type: activity.kind,
      },
      orderBy: { createdAt: "desc" },
    });
    if (found) await prisma.absence.delete({ where: { id: found.id } });
  }
}

export async function createReminderAction(formData: FormData) {
  const user = await requireSession();
  if (user.role === "MEDARBEJDER") throw new Error("Kun kontoret kan sende rykkere.");
  const invoiceId = str(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Fakturaen findes ikke.");
  const level = Math.min(3, (invoice.reminderLevel || 0) + 1);
  await prisma.reminder.create({
    data: {
      invoiceId,
      level,
      note: str(formData, "note") || `Rykker ${level}`,
    },
  });
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: level >= 3 ? "INKASSO" : "RYKKET", reminderLevel: level },
  });
  revalidatePath("/fakturaer");
  revalidatePath("/rykkere");
  revalidatePath(`/fakturaer/${invoiceId}`);
}

export async function createAgreementAction(formData: FormData) {
  const user = await requireSession();
  if (user.role === "MEDARBEJDER") throw new Error("Kun kontoret kan oprette serviceaftaler.");
  const customerId = str(formData, "customerId");
  const title = str(formData, "title");
  const nextVisit = parseDateInput(str(formData, "nextVisit"));
  if (!customerId || !title || !nextVisit) throw new Error("Kunde, titel og næste besøg er påkrævet.");
  await prisma.serviceAgreement.create({
    data: {
      customerId,
      title,
      description: str(formData, "description"),
      trade: str(formData, "trade") || "ANDET",
      intervalMonths: Number.parseInt(str(formData, "intervalMonths") || "12", 10),
      nextVisit,
      estimatedRevenue: parseKrToOre(str(formData, "estimatedRevenue")),
    },
  });
  revalidatePath("/serviceaftaler");
}

export async function spawnAgreementCaseAction(formData: FormData) {
  const user = await requireSession();
  const id = str(formData, "agreementId");
  const agreement = await prisma.serviceAgreement.findUnique({
    where: { id },
    include: { customer: { include: { addresses: true } } },
  });
  if (!agreement) throw new Error("Aftalen findes ikke.");
  const address = agreement.customer.addresses[0];
  const { nextCaseNumber } = await import("@/lib/numbers");
  const sag = await prisma.case.create({
    data: {
      caseNumber: await nextCaseNumber(),
      title: agreement.title,
      description: agreement.description,
      customerId: agreement.customerId,
      addressId: address?.id,
      customerName: agreement.customer.name,
      customerAddress: address?.street ?? "",
      customerPostal: address?.postal ?? "",
      customerCity: address?.city ?? "",
      customerPhone: agreement.customer.phone,
      customerEmail: agreement.customer.email,
      trade: agreement.trade,
      orderType: "SERVICE",
      pricingMode: "FAST_PRIS",
      projectLeaderId: user.id,
      estimatedRevenue: agreement.estimatedRevenue,
      events: {
        create: {
          fromState: null,
          toState: "NY",
          note: "Oprettet fra serviceaftale.",
          userId: user.id,
        },
      },
    },
  });
  const next = new Date(agreement.nextVisit);
  next.setMonth(next.getMonth() + agreement.intervalMonths);
  await prisma.serviceAgreement.update({ where: { id }, data: { nextVisit: next } });
  revalidatePath("/serviceaftaler");
  revalidatePath("/sager");
  redirect(`/sager/${sag.id}`);
}

const ACTIVITY_CASE_SELECT = {
  id: true,
  caseNumber: true,
  title: true,
  customerName: true,
  customerAddress: true,
  customerCity: true,
  claimNumber: true,
} as const;

export async function searchActivityCases(query: string) {
  const user = await requireSession();
  const office = canManageOffice(user.role);
  const q = query.trim();
  return prisma.case.findMany({
    where: {
      AND: [
        { state: { notIn: ["AFSLUTTET", "ANNULLERET"] } },
        office
          ? {}
          : {
              OR: [{ assignedToId: user.id }, { assignedToId: null }, { projectLeaderId: user.id }],
            },
        q
          ? {
              OR: [
                { caseNumber: { contains: q } },
                { title: { contains: q } },
                { customerName: { contains: q } },
                { customerAddress: { contains: q } },
                { customerCity: { contains: q } },
                { claimNumber: { contains: q } },
              ],
            }
          : {},
      ],
    },
    select: ACTIVITY_CASE_SELECT,
    orderBy: { caseNumber: "desc" },
    take: 40,
  });
}
