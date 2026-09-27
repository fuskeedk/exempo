import { NextResponse } from "next/server";
import { notifyIdleCasesAllTenants } from "@/lib/office-notify";

function allowed(request: Request) {
  const host = request.headers.get("host") || "";
  const local = /^127\.0\.0\.1(?::\d+)?$/.test(host) || /^localhost(?::\d+)?$/i.test(host);
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("x-cron-secret") || "";
  return local || (Boolean(secret) && header === secret);
}

export async function POST(request: Request) {
  if (!allowed(request)) {
    return NextResponse.json({ error: "Ikke tilladt." }, { status: 403 });
  }
  const idle = await notifyIdleCasesAllTenants();
  return NextResponse.json({ ok: true, idle });
}

export async function GET(request: Request) {
  return POST(request);
}
