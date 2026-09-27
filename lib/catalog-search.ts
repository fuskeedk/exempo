import type { PrismaClient } from "@prisma/client";

export async function searchLocalCatalog(db: PrismaClient, query: string, limit = 8) {
  const term = query.trim();
  if (term.length < 2) return [];
  return db.product.findMany({
    where: {
      active: true,
      OR: [
        { sku: { contains: term } },
        { barcode: { contains: term } },
        { name: { contains: term } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
    select: {
      sku: true,
      barcode: true,
      name: true,
      unit: true,
      imageUrl: true,
      costPrice: true,
      salePrice: true,
      group: true,
    },
  });
}
