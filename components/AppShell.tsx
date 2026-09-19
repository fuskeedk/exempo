import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/catalog";

const links = [
  { href: "/min-dag", label: "Min dag" },
  { href: "/", label: "Overblik" },
  { href: "/sager", label: "Arbejdssedler" },
  { href: "/tilbud", label: "Tilbud" },
  { href: "/kalender", label: "Planlægning" },
  { href: "/kunder", label: "Kunder" },
  { href: "/varer", label: "Varer" },
  { href: "/tid", label: "Tid" },
  { href: "/fakturaer", label: "Fakturaer" },
  { href: "/rykkere", label: "Rykkere" },
  { href: "/serviceaftaler", label: "Serviceaftaler" },
  { href: "/okonomi", label: "Dækningsgrad" },
  { href: "/medarbejdere", label: "Medarbejdere" },
];

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print bg-pine text-[#f4efe4]">
        <div className="flex items-center justify-between px-6 py-6 lg:block">
          <Link href="/" className="block">
            <p className="font-serif text-3xl tracking-tight">Exempo</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#d7c9a8]">
              Ordrestyring
            </p>
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:px-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 px-6 py-5 lg:block">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-[#d7c9a8]">{ROLE_LABELS[user.role]}</p>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="text-sm text-[#f0d9b8] underline-offset-4 hover:underline">
              Log ud
            </button>
          </form>
        </div>
      </aside>
      <div className="min-h-screen">
        <div className="no-print flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <div>
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-pine-2">
              Log ud
            </button>
          </form>
        </div>
        <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
