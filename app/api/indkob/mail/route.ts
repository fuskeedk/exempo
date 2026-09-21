import { NextResponse } from "next/server";
import { fetchInvoiceMailAllTenants } from "@/lib/invoice-mail";

function isLocalhost(request: Request) {
  const host = request.headers.get("host") || "";
  return /^127\.0\.0\.1(?::\d+)?$/.test(host) || /^localhost(?::\d+)?$/i.test(host);
}

export async function POST(request: Request) {
  if (!isLocalhost(request)) {
    return NextResponse.json({ error: "Kun localhost." }, { status: 403 });
  }
  const results = await fetchInvoiceMailAllTenants();
  return NextResponse.json({ ok: true, results });
}

export async function GET(request: Request) {
  return POST(request);
}
