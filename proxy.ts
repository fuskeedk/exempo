import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, canManageOffice, readSessionToken } from "@/lib/session-token";

const OFFICE_PATHS = [
  "/tilbud",
  "/varer",
  "/fakturaer",
  "/rykkere",
  "/okonomi",
  "/medarbejdere",
  "/administration",
  "/kalender",
  "/indkob",
  "/indstillinger",
  "/lon",
  "/overenskomster",
];

function isOfficePath(pathname: string) {
  return OFFICE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/login" ||
    pathname === "/opret" ||
    pathname.startsWith("/t/") ||
    pathname.startsWith("/api/sproom") ||
    pathname.startsWith("/api/tilbud/svar") ||
    pathname.startsWith("/api/indkob/mail") ||
    pathname.startsWith("/api/firma-logo")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isOfficePath(pathname) && !canManageOffice(session.role)) {
    return NextResponse.redirect(new URL("/min-dag", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
