"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageOffice } from "@/lib/auth";
import { requireVanStock } from "@/lib/modules";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function qty(formData: FormData, key = "quantity") {
  return Number.parseFloat(str(formData, key).replace(",", ".")) || 0;
}

function bounce(path: string, message: string): never {
  redirect(`${path}?besked=${encodeURIComponent(message)}`);
}

export async function loadVanAction(formData: FormData) {
  const session = await requireSession();
  await requireVanStock(session);
  if (!canManageOffice(session.role)) bounce("/vognlager", "Kun kontoret kan lægge varer på vognen.");
  const userId = str(formData, "userId");
  const productId = str(formData, "productId");
  const quantity = qty(formData);
  if (!userId || !productId || quantity <= 0) bounce("/vognlager", "Vælg medarbejder, vare og antal.");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.group === "YDELSE") bounce("/vognlager", "Varen kan ikke lægges på vognen.");
  if (product.stock < quantity) bounce("/vognlager", `Der er kun ${product.stock} på lager.`);

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { stock: { decrement: Math.round(quantity) } },
    }),
    prisma.vanStock.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity },
      update: { quantity: { increment: quantity } },
    }),
  ]);
  revalidatePath("/vognlager");
  revalidatePath("/varer");
  bounce("/vognlager", "Varen er lagt på vognen.");
}

export async function returnVanAction(formData: FormData) {
  const session = await requireSession();
  await requireVanStock(session);
  if (!canManageOffice(session.role)) bounce("/vognlager", "Kun kontoret kan returnere til lager.");
  const id = str(formData, "id");
  const quantity = qty(formData);
  const row = await prisma.vanStock.findUnique({ where: { id }, include: { product: true } });
  if (!row) bounce("/vognlager", "Varelinjen findes ikke.");
  const take = Math.min(quantity > 0 ? quantity : row.quantity, row.quantity);
  await prisma.$transaction([
    prisma.vanStock.update({
      where: { id },
      data: { quantity: { decrement: take } },
    }),
    prisma.product.update({
      where: { id: row.productId },
      data: { stock: { increment: Math.round(take) } },
    }),
  ]);
  if (row.quantity - take <= 0) {
    await prisma.vanStock.delete({ where: { id } }).catch(() => undefined);
  }
  revalidatePath("/vognlager");
  revalidatePath("/varer");
  bounce("/vognlager", "Varen er tilbage på lager.");
}

export async function takeFromVanAction(formData: FormData) {
  const session = await requireSession();
  await requireVanStock(session);
  const caseId = str(formData, "caseId");
  const productId = str(formData, "productId");
  const quantity = qty(formData) || 1;
  const ownerId = canManageOffice(session.role) ? str(formData, "userId") || session.id : session.id;
  const next = str(formData, "next") || `/sager/${caseId}`;
  if (!caseId || !productId) bounce(next || "/min-dag", "Vælg en vare fra vognen.");

  const row = await prisma.vanStock.findUnique({
    where: { userId_productId: { userId: ownerId, productId } },
    include: { product: true },
  });
  if (!row || row.quantity < quantity) {
    bounce(next, "Der er ikke nok på vognen.");
  }

  await prisma.$transaction([
    prisma.material.create({
      data: {
        caseId,
        productId: row.productId,
        name: row.product.name,
        sku: row.product.sku,
        quantity,
        unitPrice: row.product.salePrice,
        costPrice: row.product.costPrice,
        billable: row.product.billable,
      },
    }),
    prisma.vanStock.update({
      where: { id: row.id },
      data: { quantity: { decrement: quantity } },
    }),
  ]);
  const leftover = await prisma.vanStock.findUnique({ where: { id: row.id } });
  if (leftover && leftover.quantity <= 0) {
    await prisma.vanStock.delete({ where: { id: row.id } }).catch(() => undefined);
  }
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/min-dag");
  revalidatePath("/vognlager");
}
