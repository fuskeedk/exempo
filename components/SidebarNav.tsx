"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/min-dag", label: "Min dag", tour: "nav-min-dag" },
  { href: "/timesedler", label: "Timesedler" },
  { href: "/", label: "Overblik", exact: true, tour: "nav-overblik" },
  { href: "/sager", label: "Arbejdssedler", tour: "nav-sager" },
  { href: "/tilbud", label: "Tilbud", office: true, tour: "nav-tilbud" },
  { href: "/kalender", label: "Planlægning", office: true, tour: "nav-planlaegning" },
  { href: "/kunder", label: "Kunder", tour: "nav-kunder" },
  { href: "/varer", label: "Varer", office: true, module: "catalog" as const },
  { href: "/vognlager", label: "Vognlager", module: "van" as const },
  { href: "/serviceaftaler", label: "Serviceaftaler" },
];

const adminLinks = [
  { href: "/medarbejdere", label: "Medarbejdere" },
  { href: "/lon", label: "Løn" },
  { href: "/okonomi", label: "Omsætning" },
  { href: "/fakturaer", label: "Fakturaer", tour: "nav-fakturaer" },
  { href: "/rykkere", label: "Rykkere" },
  { href: "/indkob", label: "Indkøb" },
  { href: "/indstillinger", label: "Indstillinger", tour: "nav-indstillinger" },
];

const adminPrefixes = [
  "/administration",
  "/medarbejdere",
  "/lon",
  "/overenskomster",
  "/okonomi",
  "/fakturaer",
  "/rykkere",
  "/indkob",
  "/indstillinger",
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact || href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  office,
  catalog = false,
  vanStock = false,
}: {
  office: boolean;
  catalog?: boolean;
  vanStock?: boolean;
}) {
  const pathname = usePathname();
  const adminActive = adminPrefixes.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:px-4">
      {links
        .filter((link) => !link.office || office)
        .filter((link) => link.module !== "catalog" || catalog)
        .filter((link) => link.module !== "van" || vanStock)
        .map((link) => (
          <Link
            key={link.href}
            href={link.href}
            data-tour={link.tour}
            className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm ${
              isActive(pathname, link.href, link.exact) ? "bg-white/15 font-medium" : "hover:bg-white/10"
            }`}
          >
            {link.label}
          </Link>
        ))}
      {office ? (
        <>
          <Link
            href="/administration"
            className="mt-4 hidden px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d7c9a8]/80 hover:text-[#f4efe4] lg:block"
          >
            Administration
          </Link>
          <Link
            href="/administration"
            className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm lg:hidden ${
              adminActive ? "bg-white/15 font-medium" : "hover:bg-white/10"
            }`}
          >
            Administration
          </Link>
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-tour={link.tour}
              className={`hidden whitespace-nowrap rounded-xl px-3 py-2 text-sm lg:block ${
                isActive(pathname, link.href) ? "bg-white/15 font-medium" : "hover:bg-white/10"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </>
      ) : null}
    </nav>
  );
}
