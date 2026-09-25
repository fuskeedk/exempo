import { isSession, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";

export const OPTIONS = mobileOptions;

export async function GET(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  return jsonOk({ user });
}
