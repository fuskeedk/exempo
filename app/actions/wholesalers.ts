"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bounce(message: string) {
  redirect(`/indstillinger?besked=${encodeURIComponent(message)}#grossist`);
}

function payload(formData: FormData) {
  const name = str(formData, "name");
  if (!name) throw new Error("Grossistnavn er påkrævet.");
  return {
    name,
    agreementNumber: str(formData, "agreementNumber"),
    excludedFromSearch: str(formData, "excludedFromSearch") === "1",
    discountUntil: optionalDate(str(formData, "discountUntil")),
    ediEnabled: str(formData, "ediEnabled") === "1",
    ediReceivedAt: optionalDate(str(formData, "ediReceivedAt")),
    listPriceAt: optionalDate(str(formData, "listPriceAt")),
    loginUrl: str(formData, "loginUrl"),
    username: str(formData, "username"),
    note: str(formData, "note"),
  };
}

export async function createWholesalerAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const password = str(formData, "password");
  await prisma.wholesalerAgreement.create({
    data: { ...payload(formData), password },
  });
  revalidatePath("/indstillinger");
  bounce("Grossistaftalen er oprettet.");
}

export async function updateWholesalerAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const existing = await prisma.wholesalerAgreement.findUnique({ where: { id } });
  if (!existing) throw new Error("Aftalen findes ikke.");
  const password = str(formData, "password");
  await prisma.wholesalerAgreement.update({
    where: { id },
    data: {
      ...payload(formData),
      ...(password ? { password } : {}),
    },
  });
  revalidatePath("/indstillinger");
  bounce("Grossistaftalen er gemt.");
}

export async function deleteWholesalerAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  if (!id) return;
  await prisma.wholesalerAgreement.delete({ where: { id } }).catch(() => null);
  revalidatePath("/indstillinger");
  bounce("Grossistaftalen er slettet.");
}
