import { jsonOk, mobileOptions } from "@/lib/mobile-auth";

export const OPTIONS = mobileOptions;

export async function GET() {
  return jsonOk({ ok: true, name: "Exempo", version: "1.0.0" });
}
