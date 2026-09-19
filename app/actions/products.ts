"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { parseKrToOre } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createProductAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const name = str(formData, "name");
  const sku = str(formData, "sku");
  if (!name || !sku) throw new Error("Varenavn og varenr. er påkrævet.");
  await prisma.product.create({
    data: {
      name,
      sku,
      barcode: str(formData, "barcode"),
      unit: str(formData, "unit") || "stk",
      group: str(formData, "group") || "EGNE",
      costPrice: parseKrToOre(str(formData, "costPrice")),
      salePrice: parseKrToOre(str(formData, "salePrice")),
      stock: Math.round(Number.parseFloat(str(formData, "stock").replace(",", ".")) || 0),
      billable: str(formData, "billable") !== "0",
    },
  });
  revalidatePath("/varer");
}

async function attachProductToCase(caseId: string, product: {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  costPrice: number;
  billable: boolean;
  group: string;
}, quantity: number) {
  await prisma.material.create({
    data: {
      caseId,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity,
      unitPrice: product.salePrice,
      costPrice: product.costPrice,
      billable: product.billable,
    },
  });
  if (product.group !== "YDELSE") {
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: { decrement: Math.round(quantity) } },
    });
  }
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/min-dag");
  revalidatePath("/okonomi");
  revalidatePath("/varer");
}

export async function addCatalogMaterialAction(formData: FormData) {
  await requireRole(["ADMIN", "PL", "MEDARBEJDER"]);
  const caseId = str(formData, "caseId");
  const productId = str(formData, "productId");
  const quantity = Number.parseFloat(str(formData, "quantity").replace(",", ".")) || 1;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Varen findes ikke.");
  await attachProductToCase(caseId, product, quantity);
}

export async function addMaterialByBarcodeAction(formData: FormData) {
  await requireRole(["ADMIN", "PL", "MEDARBEJDER"]);
  const caseId = str(formData, "caseId");
  const code = str(formData, "barcode");
  const quantity = Number.parseFloat(str(formData, "quantity").replace(",", ".")) || 1;
  if (!code) throw new Error("Stregkode eller varenr. mangler.");
  const product = await prisma.product.findFirst({
    where: {
      active: true,
      OR: [{ barcode: code }, { sku: code }],
    },
  });
  if (!product) throw new Error("Ingen vare matcher stregkode/varenr.");
  await attachProductToCase(caseId, product, quantity);
}
