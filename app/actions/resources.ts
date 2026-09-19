"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { parseDateInput } from "@/lib/dates";
import { parseKrToOre } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createResourceAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const name = str(formData, "name");
  if (!name) throw new Error("Navn på ressource mangler.");
  await prisma.resource.create({
    data: {
      name,
      type: str(formData, "type") || "UDSTYR",
      dailyRate: parseKrToOre(str(formData, "dailyRate")),
      color: str(formData, "color") || "#8a6d3b",
    },
  });
  revalidatePath("/kalender");
}

export async function bookResourceAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const resourceId = str(formData, "resourceId");
  const caseId = str(formData, "caseId");
  const start = parseDateInput(str(formData, "start"));
  const end = parseDateInput(str(formData, "end"));
  if (!resourceId || !start || !end) {
    throw new Error("Vælg ressource, start og slut.");
  }
  if (end <= start) throw new Error("Sluttid skal være efter start.");
  await prisma.resourceBooking.create({
    data: {
      resourceId,
      caseId,
      start,
      end,
      note: str(formData, "note"),
    },
  });
  revalidatePath("/kalender");
  if (caseId) revalidatePath(`/sager/${caseId}`);
}
