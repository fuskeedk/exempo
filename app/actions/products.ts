"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { aoSearchEnabled, lookupAoProduct, searchAoCatalog, type AoCatalogItem } from "@/lib/ao-catalog";
import { requireProductCatalog } from "@/lib/modules";
import { parseKrToOre } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createProductAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  await requireProductCatalog(session);
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
  imageUrl?: string;
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
      imageUrl: product.imageUrl ?? "",
      quantity,
      unitPrice: product.salePrice,
      costPrice: product.costPrice,
      billable: product.billable,
    },
  });
  if (product.group === "EGNE") {
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

async function aoAccountNumber() {
  const agreements = await prisma.wholesalerAgreement.findMany({
    select: { name: true, excludedFromSearch: true, agreementNumber: true },
  });
  if (!aoSearchEnabled(agreements)) return null;
  return agreements.find((row) => /ao/i.test(row.name) && !row.excludedFromSearch)?.agreementNumber || "";
}

async function upsertAoProduct(item: AoCatalogItem) {
  const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        name: item.name,
        barcode: item.barcode || existing.barcode,
        unit: item.unit || existing.unit,
        imageUrl: item.imageUrl || existing.imageUrl,
        group: existing.group === "EGNE" ? existing.group : "GROSSIST",
        active: true,
      },
    });
  }
  return prisma.product.create({
    data: {
      sku: item.sku,
      barcode: item.barcode,
      name: item.name,
      unit: item.unit || "stk",
      imageUrl: item.imageUrl,
      group: "GROSSIST",
      costPrice: 0,
      salePrice: 0,
      billable: true,
      active: true,
    },
  });
}

export async function addCatalogMaterialAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL", "MEDARBEJDER"]);
  await requireProductCatalog(session);
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
  let product = await prisma.product.findFirst({
    where: {
      active: true,
      OR: [
        { barcode: code },
        { sku: code },
        ...(code.length >= 8 ? [{ barcode: { contains: code } }] : []),
      ],
    },
  });
  if (!product) {
    const account = await aoAccountNumber();
    if (account !== null) {
      const hit =
        (await lookupAoProduct(code)) ??
        (await searchAoCatalog(code, { account, limit: 5 })).find(
          (item) => item.sku === code || item.barcode === code || item.barcode.split("|").includes(code),
        ) ??
        (await searchAoCatalog(code, { account, limit: 1 }))[0];
      if (hit) product = await upsertAoProduct(hit);
    }
  }
  if (!product) throw new Error("Ingen vare matcher stregkode/varenr.");
  await attachProductToCase(caseId, product, quantity);
}

export async function addAoMaterialAction(formData: FormData) {
  await requireRole(["ADMIN", "PL", "MEDARBEJDER"]);
  const caseId = str(formData, "caseId");
  const sku = str(formData, "sku");
  const quantity = Number.parseFloat(str(formData, "quantity").replace(",", ".")) || 1;
  if (!sku) throw new Error("AO-varenr. mangler.");
  const account = await aoAccountNumber();
  if (account === null) throw new Error("AO-varesøgning er slået fra under Grossistaftaler.");
  const hit = (await lookupAoProduct(sku)) ?? (await searchAoCatalog(sku, { account, limit: 3 })).find((item) => item.sku === sku);
  if (!hit) throw new Error("AO-varen blev ikke fundet.");
  const product = await upsertAoProduct(hit);
  await attachProductToCase(caseId, product, quantity);
}
