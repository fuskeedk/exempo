"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageOffice, requireRole, requireSession } from "@/lib/auth";
import { isTrade } from "@/lib/catalog";
import { parseDateInput } from "@/lib/dates";
import { canTransition, isCaseState, type CaseState } from "@/lib/fsm";
import { parseKrToOre } from "@/lib/money";
import { nextCaseNumber } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function transitionContext(caseId: string) {
  const sag = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      klsReports: true,
      invoices: { select: { id: true } },
    },
  });
  if (!sag) return null;
  return {
    sag,
    ctx: {
      hasSignedKls: sag.klsReports.some((report) => report.signedAt),
      hasInvoice: sag.invoices.length > 0,
      isScheduled: Boolean(sag.assignedToId && sag.scheduledStart && sag.scheduledEnd),
    },
  };
}

export async function createCaseAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const title = str(formData, "title");
  if (!title) throw new Error("Titel er påkrævet.");

  const trade = str(formData, "trade") || "ANDET";
  const customerId = str(formData, "customerId");
  let customerName = str(formData, "customerName");
  let customerAddress = str(formData, "customerAddress");
  let customerPostal = str(formData, "customerPostal");
  let customerCity = str(formData, "customerCity");
  let customerPhone = str(formData, "customerPhone");
  let customerEmail = str(formData, "customerEmail");
  let addressId: string | undefined;

  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { addresses: true },
    });
    if (customer) {
      customerName = customer.name;
      customerPhone = customer.phone;
      customerEmail = customer.email;
      const address =
        customer.addresses.find((item) => item.id === str(formData, "addressId")) ??
        customer.addresses[0];
      if (address) {
        addressId = address.id;
        customerAddress = address.street;
        customerPostal = address.postal;
        customerCity = address.city;
      }
    }
  }

  if (!title || !customerName || !customerAddress) {
    throw new Error("Titel, kundenavn og adresse er påkrævet.");
  }

  const caseNumber = await nextCaseNumber();
  const sag = await prisma.case.create({
    data: {
      caseNumber,
      title,
      description: str(formData, "description"),
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
      referencePerson: str(formData, "referencePerson"),
      orderType: str(formData, "orderType") || "SKADE",
      pricingMode: str(formData, "pricingMode") || "FAST_PRIS",
      trade: isTrade(trade) ? trade : "ANDET",
      projectLeaderId: user.id,
      estimatedRevenue: parseKrToOre(str(formData, "estimatedRevenue")),
      estimatedCost: parseKrToOre(str(formData, "estimatedCost")),
      events: {
        create: {
          fromState: null,
          toState: "NY",
          note: "Sag oprettet.",
          userId: user.id,
        },
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
    throw new Error("Ugyldig sag eller status.");
  }

  const result = canTransition(packed.sag.state, toState, packed.ctx);
  if (!result.ok) {
    throw new Error(result.reason);
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
      estimatedRevenue: parseKrToOre(str(formData, "estimatedRevenue")),
      estimatedCost: parseKrToOre(str(formData, "estimatedCost")),
    },
  });
  revalidatePath(`/sager/${caseId}`);
}

export async function assignCaseToCalendarAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const caseId = str(formData, "caseId");
  const assignedToId = str(formData, "assignedToId");
  const start = parseDateInput(str(formData, "scheduledStart"));
  const end = parseDateInput(str(formData, "scheduledEnd"));
  if (!assignedToId || !start || !end) {
    throw new Error("Vælg medarbejder, start og slut.");
  }
  if (end <= start) {
    throw new Error("Sluttid skal være efter start.");
  }

  const sag = await prisma.case.findUnique({ where: { id: caseId } });
  if (!sag) throw new Error("Sagen findes ikke.");

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
          note: "Sagen er lagt i kalenderen.",
          userId: user.id,
        },
      });
    }
  });

  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/kalender");
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

  await prisma.timeEntry.create({
    data: {
      caseId,
      userId: user.id,
      hours,
      hourlyRate: worker.hourlyRate,
      date,
      kind: str(formData, "kind") || "ARBEJDE",
      note: str(formData, "note"),
    },
  });
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/okonomi");
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
