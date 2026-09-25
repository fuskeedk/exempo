import { NextResponse } from "next/server";
import { readSessionToken, type SessionUser } from "@/lib/auth";

export function applyCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return response;
}

export function jsonOk(data: unknown, status = 200) {
  return applyCors(NextResponse.json(data, { status }));
}

export function jsonError(message: string, status = 400) {
  return applyCors(NextResponse.json({ error: message }, { status }));
}

export function mobileOptions() {
  return applyCors(new NextResponse(null, { status: 204 }));
}

export async function requireBearer(request: Request): Promise<SessionUser | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return jsonError("Log ind igen.", 401);
  const user = await readSessionToken(token);
  if (!user) return jsonError("Sessionen er udløbet.", 401);
  return user;
}

export function isSession(value: SessionUser | NextResponse): value is SessionUser {
  return !(value instanceof NextResponse);
}
