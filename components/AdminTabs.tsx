"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/administration", label: "Overblik", match: (path: string) => path === "/administration" },
  { href: "/medarbejdere", label: "Medarbejdere", match: (path: string) => path.startsWith("/medarbejdere") },
  { href: "/lon", label: "Løn", match: (path: string) => path.startsWith("/lon") || path.startsWith("/overenskomster") },
  { href: "/okonomi", label: "Omsætning", match: (path: string) => path.startsWith("/okonomi") },
  { href: "/fakturaer", label: "Fakturaer", match: (path: string) => path.startsWith("/fakturaer") },
  { href: "/rykkere", label: "Rykkere", match: (path: string) => path.startsWith("/rykkere") },
  { href: "/indkob", label: "Indkøb", match: (path: string) => path.startsWith("/indkob") },
  { href: "/indstillinger", label: "Indstillinger", match: (path: string) => path.startsWith("/indstillinger") },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${
              active ? "bg-pine text-[#f4efe4]" : "text-ink hover:bg-paper"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
