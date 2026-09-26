import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { MobileNav } from "@/components/MobileNav";
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
      <aside className="no-print hidden bg-pine text-[#f4efe4] lg:flex lg:flex-col">
        <div className="px-6 py-6">
          <Link href="/" className="block">
            <p className="font-serif text-3xl tracking-tight">Exempo</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#d7c9a8]">
              Ordrestyring
            </p>
          </Link>
        </div>
        <nav className="space-y-1 px-4 pb-4">
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
        <div className="mt-auto border-t border-white/10 px-6 py-5">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-[#d7c9a8]">{ROLE_LABELS[user.role]}</p>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="text-sm text-[#f0d9b8] underline-offset-4 hover:underline">
              Log ud
            </button>
          </form>
        </div>
      </aside>
      <MobileNav
        brand="Exempo"
        userName={user.name}
        userEmail={user.email}
        userRole={ROLE_LABELS[user.role]}
        tabs={[
          { href: "/min-dag", label: "Min dag", icon: "day" },
          { href: "/tid", label: "Tid", icon: "time" },
          { href: "/", label: "Overblik", icon: "overview", exact: true },
          { href: "/sager", label: "Sager", icon: "jobs" },
        ]}
        links={[
          { href: "/min-dag", label: "Min dag", icon: "day" },
          { href: "/", label: "Overblik", icon: "overview", exact: true },
          { href: "/sager", label: "Arbejdssedler", icon: "jobs" },
          { href: "/tilbud", label: "Tilbud", icon: "quotes" },
          { href: "/kalender", label: "Planlægning", icon: "plan" },
          { href: "/kunder", label: "Kunder", icon: "customers" },
          { href: "/varer", label: "Varer", icon: "goods" },
          { href: "/tid", label: "Tid", icon: "time" },
          { href: "/fakturaer", label: "Fakturaer", icon: "invoice" },
          { href: "/rykkere", label: "Rykkere", icon: "reminder" },
          { href: "/serviceaftaler", label: "Serviceaftaler", icon: "service" },
          { href: "/okonomi", label: "Dækningsgrad", icon: "money" },
          { href: "/medarbejdere", label: "Medarbejdere", icon: "people" },
        ]}
        createItems={[
          { href: "/sager/ny", label: "Sag" },
          { href: "/kunder/ny", label: "Kunde" },
        ]}
      />
      <div className="min-h-screen">
        <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(4.25rem+env(safe-area-inset-top))] sm:px-8 lg:px-8 lg:py-8 lg:pb-8 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
