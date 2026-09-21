import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { aoSearchEnabled, searchAoCatalog } from "@/lib/ao-catalog";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const agreements = await prisma.wholesalerAgreement.findMany({
    select: { name: true, excludedFromSearch: true, agreementNumber: true },
  });
  if (!aoSearchEnabled(agreements)) {
    return NextResponse.json({ items: [], disabled: true });
  }
  const account = agreements.find((row) => /ao/i.test(row.name) && !row.excludedFromSearch)?.agreementNumber ?? "";
  try {
    const items = await searchAoCatalog(q, { account, limit: 10 });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: "AO svarede ikke." }, { status: 502 });
  }
}
