"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageOffice, requireRole, requireSession } from "@/lib/auth";
import { isTrade, isPricingMode, isOrderType, canDeleteCase } from "@/lib/catalog";
import { defaultSlotOnDay, FULL_DAY_CLOCK_HOURS, parseDateInput, parseDayParam, shiftScheduleToDay, slotAtHour, atTimeOnDay } from "@/lib/dates";
import { canTransition, isCaseState, isTimeLocked, TIME_LOCKED_MESSAGE, type CaseState } from "@/lib/fsm";
import { parseKrToOre } from "@/lib/money";
import { nextCaseNumber } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";
import { materialPricePatch } from "@/lib/workorder";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bounceCase(caseId: string, message: string): never {
  redirect(`/sager/${caseId}?fejl=${encodeURIComponent(message)}`);
}

async function transitionContext(caseId: string) {
  const sag = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      invoices: { select: { id: true } },
    },
  });
  if (!sag) return null;
  return {
    sag,
    ctx: {
      hasInvoice: sag.invoices.length > 0,
      isScheduled: Boolean(sag.assignedToId && sag.scheduledStart && sag.scheduledEnd),
    },
  };
}

export async function createCaseAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const description = str(formData, "description");
  const customerId = str(formData, "customerId");
  let customerName = str(formData, "customerName") || str(formData, "contactName");
  let customerAddress = str(formData, "customerAddress");
  let customerPostal = str(formData, "customerPostal");
  let customerCity = str(formData, "customerCity");
  let customerPhone = str(formData, "customerPhone") || str(formData, "customerMobile");
  let customerEmail = str(formData, "customerEmail");
  let addressId: string | undefined;

  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { addresses: true },
    });
    if (customer) {
      customerName = customerName || customer.name;
      customerPhone = customerPhone || customer.phone;
      customerEmail = customerEmail || customer.email;
      const address =
        customer.addresses.find((item) => item.id === str(formData, "addressId")) ??
        customer.addresses[0];
      if (address && !customerAddress) {
        addressId = address.id;
        customerAddress = address.street;
        customerPostal = address.postal;
        customerCity = address.city;
      }
    }
  }

  if (str(formData, "sameInstall") !== "1") {
    customerAddress = str(formData, "installAddress") || customerAddress;
    customerPostal = str(formData, "installPostal") || customerPostal;
    customerCity = str(formData, "installCity") || customerCity;
  }

  const title =
    str(formData, "title") ||
    description.split("\n")[0].slice(0, 80) ||
    (customerName ? `Ordre · ${customerName}` : "");
  if (!title || !customerName || !customerAddress) {
    throw new Error("Kundenavn, adresse og arbejdsbeskrivelse er påkrævet.");
  }

  const trade = str(formData, "trade") || "ANDET";
  const workStart = parseDateInput(str(formData, "workStart"));
  const workEnd = parseDateInput(str(formData, "workEnd"));
  const followUpAt = parseDateInput(str(formData, "followUpAt"));
  const note = str(formData, "note");
  const projectLeaderId = str(formData, "projectLeaderId") || user.id;
  const assignedToId = str(formData, "assignedToId") || undefined;

  const caseNumber = await nextCaseNumber();
  const sag = await prisma.case.create({
    data: {
      caseNumber,
      title,
      description,
      customerId: customerId || undefined,
      addressId,
      customerName,
      customerAddress,
      customerPostal,
      customerCity,
      customerPhone,
      customerEmail,
      insuranceCompany: str(formData, "insuranceCompany"),
      claimNumber: str(formData, "claimNumber"),
      requisition: str(formData, "requisition"),
      referencePerson: str(formData, "referencePerson") || str(formData, "theirRef"),
      attn: str(formData, "attn") || str(formData, "attn2"),
      address2: str(formData, "address2"),
      country: str(formData, "country") || "DK",
      vatNumber: str(formData, "vatNumber") || str(formData, "vatNumber2"),
      billingAddress: str(formData, "billingAddress"),
      billingPostal: str(formData, "billingPostal"),
      billingCity: str(formData, "billingCity"),
      followUpAt,
      followUpNote: str(formData, "followUpNote"),
      confirmationText: str(formData, "confirmationText"),
      reverseCharge: str(formData, "reverseCharge") === "1",
      orderType: str(formData, "orderType") || "SKADE",
      pricingMode: isPricingMode(str(formData, "pricingMode")) ? str(formData, "pricingMode") : "FORBRUG",
      trade: isTrade(trade) ? trade : "ANDET",
      projectLeaderId,
      assignedToId,
      scheduledStart: workStart ? atTimeOnDay(workStart, 8) : undefined,
      scheduledEnd: workEnd ? atTimeOnDay(workEnd, 16) : undefined,
      estimatedRevenue: parseKrToOre(str(formData, "estimatedRevenue")),
      estimatedCost: parseKrToOre(str(formData, "estimatedCost")),
      events: {
        create: [
          {
            fromState: null,
            toState: "NY",
            note: "Sag oprettet.",
            userId: user.id,
          },
          ...(note
            ? [
                {
                  fromState: "NY",
                  toState: "NY",
                  note,
                  userId: user.id,
                },
              ]
            : []),
        ],
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/sager");
  redirect(`/sager/${sag.id}`);
}

export async function transitionCaseAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  const toState = str(formData, "toState");
  const note = str(formData, "note");
  const packed = await transitionContext(caseId);
  if (!packed || !isCaseState(toState)) {
    return bounceCase(caseId || "", "Ugyldig sag eller status.");
  }

  const reopening = toState === "I_GANG" && isTimeLocked(packed.sag.state);
  if (reopening && !canManageOffice(user.role)) {
    return bounceCase(caseId, "Kun projektleder eller admin kan genåbne sagen.");
  }
  const closingWork = toState === "AFSLUTTET" && packed.sag.state !== "FAKTURERET";
  const result = canTransition(packed.sag.state, toState, {
    ...packed.ctx,
    allowCloseWithoutInvoice: closingWork,
  });
  if (!result.ok) {
    return bounceCase(caseId, result.reason);
  }

  await prisma.$transaction([
    prisma.case.update({
      where: { id: caseId },
      data: { state: toState },
    }),
    prisma.caseEvent.create({
      data: {
        caseId,
        fromState: packed.sag.state,
        toState,
        note,
        userId: user.id,
      },
    }),
  ]);

  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/");
  revalidatePath("/kalender");
}

export async function updateCaseAction(formData: FormData) {
  const user = await requireSession();
  if (!canManageOffice(user.role)) {
    throw new Error("Kun projektleder kan rette sagsstamdata.");
  }
  const caseId = str(formData, "caseId");
  const trade = str(formData, "trade") || "ANDET";
  const pricingMode = str(formData, "pricingMode");
  await prisma.case.update({
    where: { id: caseId },
    data: {
      title: str(formData, "title"),
      description: str(formData, "description"),
      customerName: str(formData, "customerName"),
      customerAddress: str(formData, "customerAddress"),
      customerPostal: str(formData, "customerPostal"),
      customerCity: str(formData, "customerCity"),
      customerPhone: str(formData, "customerPhone"),
      customerEmail: str(formData, "customerEmail"),
      insuranceCompany: str(formData, "insuranceCompany"),
      claimNumber: str(formData, "claimNumber"),
      trade: isTrade(trade) ? trade : "ANDET",
      pricingMode: isPricingMode(pricingMode) ? pricingMode : undefined,
      estimatedRevenue: parseKrToOre(str(formData, "estimatedRevenue")),
      estimatedCost: parseKrToOre(str(formData, "estimatedCost")),
    },
  });
  revalidatePath(`/sager/${caseId}`);
}

export async function patchCaseAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const caseId = str(formData, "caseId");
  const section = str(formData, "section");
  const sag = await prisma.case.findUnique({ where: { id: caseId } });
  if (!sag) throw new Error("Sagen findes ikke.");

  if (section === "description") {
    await prisma.case.update({
      where: { id: caseId },
      data: {
        title: str(formData, "title") || sag.title,
        description: str(formData, "description"),
        requisition: str(formData, "requisition"),
        claimNumber: str(formData, "claimNumber"),
        orderType: isOrderType(str(formData, "orderType")) ? str(formData, "orderType") : sag.orderType,
      },
    });
  } else if (section === "staff") {
    await prisma.case.update({
      where: { id: caseId },
      data: {
        assignedToId: str(formData, "assignedToId") || null,
        projectLeaderId: str(formData, "projectLeaderId") || null,
      },
    });
  } else if (section === "price") {
    const pricingMode = str(formData, "pricingMode");
    const startDay = str(formData, "workStart");
    const endDay = str(formData, "workEnd");
    await prisma.case.update({
      where: { id: caseId },
      data: {
        pricingMode: isPricingMode(pricingMode) ? pricingMode : sag.pricingMode,
        estimatedRevenue: parseKrToOre(str(formData, "estimatedRevenue")),
        estimatedCost: parseKrToOre(str(formData, "estimatedCost")),
        scheduledStart: startDay
          ? atTimeOnDay(
              parseDayParam(startDay),
              sag.scheduledStart?.getHours() ?? 8,
              sag.scheduledStart?.getMinutes() ?? 0,
            )
          : null,
        scheduledEnd: endDay
          ? atTimeOnDay(
              parseDayParam(endDay),
              sag.scheduledEnd?.getHours() ?? 16,
              sag.scheduledEnd?.getMinutes() ?? 0,
            )
          : null,
      },
    });
  } else if (section === "followup") {
    const day = str(formData, "followUpAt");
    await prisma.case.update({
      where: { id: caseId },
      data: {
        followUpAt: day ? atTimeOnDay(parseDayParam(day), 8) : null,
        followUpNote: str(formData, "followUpNote"),
      },
    });
  } else {
    throw new Error("Ukendt sektion.");
  }

  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/sager");
  revalidatePath("/kalender");
  revalidatePath("/min-dag");
}

export async function assignCaseToCalendarAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  const start = parseDateInput(str(formData, "scheduledStart"));
  const end = parseDateInput(str(formData, "scheduledEnd"));
  if (!start || !end) {
    throw new Error("Vælg start og slut.");
  }
  if (end <= start) {
    throw new Error("Sluttid skal være efter start.");
  }

  const sag = await prisma.case.findUnique({ where: { id: caseId } });
  if (!sag) throw new Error("Sagen findes ikke.");

  const office = canManageOffice(user.role);
  let assignedToId = str(formData, "assignedToId");
  if (office) {
    if (!assignedToId) throw new Error("Vælg medarbejder, start og slut.");
  } else {
    if (sag.assignedToId && sag.assignedToId !== user.id) {
      throw new Error("Du kan kun booke sager på dig selv.");
    }
    assignedToId = user.id;
  }

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
    if (nextState !== sag.state) {
      await tx.caseEvent.create({
        data: {
          caseId,
          fromState: sag.state,
          toState: nextState,
          note: office ? "Sagen er lagt i kalenderen." : "Medarbejderen bookede sagen på sig selv.",
          userId: user.id,
        },
      });
    }
  });

  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/kalender");
  revalidatePath("/min-dag");
  revalidatePath("/tid");
  revalidatePath("/");
}

export async function moveCaseOnCalendar(input: {
  caseId: string;
  date: string;
  fromDate?: string;
  assignedToId?: string;
  hour?: number;
  minute?: number;
}) {
  const user = await requireSession();
  const sag = await prisma.case.findUnique({ where: { id: input.caseId } });
  if (!sag) throw new Error("Sagen findes ikke.");

  const office = canManageOffice(user.role);
  if (!office && sag.assignedToId && sag.assignedToId !== user.id) {
    throw new Error("Du kan kun flytte dine egne sager.");
  }

  const toDay = parseDayParam(input.date);
  const fromDay = input.fromDate ? parseDayParam(input.fromDate) : toDay;
  let assignedToId = sag.assignedToId;
  if (office && input.assignedToId) {
    assignedToId = input.assignedToId;
  } else if (!office) {
    assignedToId = user.id;
  }
  if (!assignedToId) {
    throw new Error("Vælg en medarbejder at lægge sagen på.");
  }

  const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!assignee || !assignee.active) {
    throw new Error("Medarbejderen findes ikke.");
  }

  const durationMs =
    sag.scheduledStart && sag.scheduledEnd
      ? sag.scheduledEnd.getTime() - sag.scheduledStart.getTime()
      : FULL_DAY_CLOCK_HOURS * 60 * 60 * 1000;
  const hour = Number.isFinite(input.hour) ? Number(input.hour) : null;
  const slot =
    hour !== null
      ? slotAtHour(toDay, hour, durationMs, input.minute ?? 0)
      : sag.scheduledStart && sag.scheduledEnd
        ? shiftScheduleToDay(sag.scheduledStart, sag.scheduledEnd, fromDay, toDay)
        : defaultSlotOnDay(toDay);

  if (slot.end <= slot.start) {
    throw new Error("Sluttid skal være efter start.");
  }

  const nextState: CaseState =
    !sag.scheduledStart && (sag.state === "NY" || sag.state === "BESIGTIGELSE")
      ? "PLANLAGT"
      : (sag.state as CaseState);

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: sag.id },
      data: {
        assignedToId,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        state: nextState,
      },
    });
    if (nextState !== sag.state) {
      await tx.caseEvent.create({
        data: {
          caseId: sag.id,
          fromState: sag.state,
          toState: nextState,
          note: "Sagen er lagt i kalenderen.",
          userId: user.id,
        },
      });
    } else if (
      sag.assignedToId !== assignedToId ||
      sag.scheduledStart?.getTime() !== slot.start.getTime() ||
      sag.scheduledEnd?.getTime() !== slot.end.getTime()
    ) {
      await tx.caseEvent.create({
        data: {
          caseId: sag.id,
          fromState: sag.state,
          toState: sag.state,
          note: "Sagen er flyttet i kalenderen.",
          userId: user.id,
        },
      });
    }
  });

  revalidatePath(`/sager/${sag.id}`);
  revalidatePath("/kalender");
  revalidatePath("/min-dag");
  revalidatePath("/tid");
  revalidatePath("/");
}

export async function rescheduleCaseAction(formData: FormData) {
  await moveCaseOnCalendar({
    caseId: str(formData, "caseId"),
    date: str(formData, "date"),
    fromDate: str(formData, "fromDate") || undefined,
    assignedToId: str(formData, "assignedToId") || undefined,
  });
}

export async function resizeCaseOnCalendar(input: {
  caseId: string;
  date: string;
  endHour: number;
  endMinute: number;
}) {
  const user = await requireSession();
  const sag = await prisma.case.findUnique({ where: { id: input.caseId } });
  if (!sag) throw new Error("Sagen findes ikke.");
  if (!canManageOffice(user.role) && sag.assignedToId && sag.assignedToId !== user.id) {
    throw new Error("Du kan kun ændre dine egne sager.");
  }
  if (!sag.scheduledStart || !sag.scheduledEnd) {
    throw new Error("Sagen er ikke planlagt.");
  }

  const day = parseDayParam(input.date);
  const snappedMinute = Math.round(input.endMinute / 15) * 15;
  const end =
    snappedMinute >= 60
      ? atTimeOnDay(day, input.endHour + 1, 0)
      : atTimeOnDay(day, input.endHour, Math.max(0, snappedMinute));
  const start = sag.scheduledStart;
  if (end.getTime() - start.getTime() < 15 * 60 * 1000) {
    throw new Error("En booking skal være mindst 15 minutter.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: sag.id },
      data: { scheduledEnd: end },
    });
    await tx.caseEvent.create({
      data: {
        caseId: sag.id,
        fromState: sag.state,
        toState: sag.state,
        note: "Planlagt sluttid er ændret.",
        userId: user.id,
      },
    });
  });

  revalidatePath(`/sager/${sag.id}`);
  revalidatePath("/kalender");
  revalidatePath("/min-dag");
  revalidatePath("/");
}

export async function addTimeEntryAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  const hours = Number.parseFloat(str(formData, "hours").replace(",", "."));
  const date = parseDateInput(str(formData, "date"));
  if (!date || Number.isNaN(hours) || hours <= 0) {
    throw new Error("Angiv gyldige timer og dato.");
  }
  const worker = await prisma.user.findUnique({ where: { id: user.id } });
  if (!worker) throw new Error("Bruger findes ikke.");
  if (caseId) {
    const sag = await prisma.case.findUnique({ where: { id: caseId }, select: { state: true } });
    if (sag && isTimeLocked(sag.state)) {
      throw new Error(TIME_LOCKED_MESSAGE);
    }
  }

  await prisma.timeEntry.create({
    data: {
      caseId: caseId || null,
      userId: user.id,
      hours,
      hourlyRate: worker.hourlyRate,
      date,
      kind: str(formData, "kind") || "ARBEJDE",
      note: str(formData, "note"),
    },
  });
  if (caseId) revalidatePath(`/sager/${caseId}`);
  revalidatePath("/okonomi");
  revalidatePath("/tid");
  revalidatePath("/min-dag");
}

export async function addMaterialAction(formData: FormData) {
  await requireRole(["ADMIN", "PL", "MEDARBEJDER"]);
  const caseId = str(formData, "caseId");
  const name = str(formData, "name");
  const quantity = Number.parseFloat(str(formData, "quantity").replace(",", ".")) || 1;
  if (!name) throw new Error("Materialenavn mangler.");
  await prisma.material.create({
    data: {
      caseId,
      name,
      quantity,
      unitPrice: parseKrToOre(str(formData, "unitPrice")),
      costPrice: parseKrToOre(str(formData, "costPrice")),
    },
  });
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/okonomi");
}

export async function deleteMaterialAction(formData: FormData) {
  await requireRole(["ADMIN", "PL", "MEDARBEJDER"]);
  const id = str(formData, "id");
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) return;
  await prisma.material.delete({ where: { id } });
  revalidatePath(`/sager/${material.caseId}`);
  revalidatePath("/okonomi");
}

export async function updateMaterialPriceAction(formData: FormData) {
  await requireRole(["ADMIN", "PL", "MEDARBEJDER"]);
  const id = str(formData, "id");
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) throw new Error("Materialet findes ikke.");
  const next = materialPricePatch(
    { costPrice: material.costPrice, unitPrice: material.unitPrice },
    {
      costPrice: str(formData, "costPrice") || undefined,
      markup: str(formData, "markup") || undefined,
      unitPrice: str(formData, "unitPrice") || undefined,
    },
  );
  await prisma.material.update({
    where: { id },
    data: { costPrice: next.costPrice, unitPrice: next.unitPrice },
  });
  revalidatePath(`/sager/${material.caseId}`);
  revalidatePath("/okonomi");
}

export async function addCaseNoteAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  const title = str(formData, "title");
  const body = str(formData, "body");
  const sag = await prisma.case.findUnique({ where: { id: caseId } });
  if (!sag) throw new Error("Sagen findes ikke.");
  const note = [title, body].filter(Boolean).join("\n");
  if (!note) throw new Error("Skriv en note.");
  await prisma.caseEvent.create({
    data: {
      caseId,
      fromState: sag.state,
      toState: sag.state,
      note,
      userId: user.id,
    },
  });
  revalidatePath(`/sager/${caseId}`);
}

export async function deleteCaseAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const sag = await prisma.case.findUnique({
    where: { id },
    include: {
      invoices: { select: { status: true } },
      documents: { select: { filename: true } },
    },
  });
  if (!sag) throw new Error("Sagen findes ikke.");
  if (!canDeleteCase(sag.invoices)) {
    throw new Error("Sagen kan ikke slettes, fordi der er sendte fakturaer.");
  }

  await prisma.$transaction([
    prisma.purchase.updateMany({ where: { caseId: id }, data: { caseId: null } }),
    prisma.quote.updateMany({ where: { caseId: id }, data: { caseId: null } }),
    prisma.resourceBooking.updateMany({ where: { caseId: id }, data: { caseId: "" } }),
    prisma.case.delete({ where: { id } }),
  ]);

  const uploadDir = path.join(process.cwd(), "uploads");
  await Promise.all(
    sag.documents.map(async (doc) => {
      if (!doc.filename || doc.filename.includes("..") || doc.filename.includes("/") || doc.filename.includes("\\")) {
        return;
      }
      try {
        await unlink(path.join(uploadDir, doc.filename));
      } catch {
        /* file may already be gone */
      }
    }),
  );

  revalidatePath("/sager");
  revalidatePath("/");
  revalidatePath("/okonomi");
  revalidatePath("/kalender");
  revalidatePath("/min-dag");
  redirect(`/sager?besked=${encodeURIComponent(`Sagen ${sag.caseNumber} er slettet.`)}`);
}
