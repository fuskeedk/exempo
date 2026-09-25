import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function attachProductToCase(
  caseId: string,
  product: {
    id: string;
    name: string;
    sku: string;
    salePrice: number;
    costPrice: number;
    billable: boolean;
    group: string;
  },
  quantity: number,
) {
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
