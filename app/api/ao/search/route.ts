import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { aoSearchEnabled, isAoWholesaler, searchAoCatalog } from "@/lib/ao-catalog";
import { searchLocalCatalog } from "@/lib/catalog-search";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const local = await searchLocalCatalog(prisma, q, 8);
  const localItems = local.map((row) => ({
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    unit: row.unit,
    imageUrl: row.imageUrl,
    costPrice: row.costPrice,
    salePrice: row.salePrice,
    source: row.group || "Katalog",
  }));
  const seen = new Set(localItems.map((item) => item.sku));

  const agreements = await prisma.wholesalerAgreement.findMany({
    select: { name: true, excludedFromSearch: true, agreementNumber: true, username: true, password: true },
  });
  if (!aoSearchEnabled(agreements)) {
    return NextResponse.json({ items: localItems, disabled: localItems.length === 0 });
  }
  const row = agreements.find((item) => isAoWholesaler(item));
  const account = row?.agreementNumber ?? "";
  try {
    const remote = await searchAoCatalog(q, {
      account,
      auth: {
        username: row?.username ?? "",
        password: row?.password ?? "",
        account: account || undefined,
      },
      limit: 10,
    });
    const items = [
      ...localItems,
      ...remote
        .filter((item) => !seen.has(item.sku))
        .map((item) => ({ ...item, source: "AO" })),
    ];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({
      items: localItems,
      error: localItems.length ? undefined : "AO svarede ikke.",
    }, { status: localItems.length ? 200 : 502 });
  }
}
