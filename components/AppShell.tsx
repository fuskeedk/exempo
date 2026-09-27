import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { CreateMenu } from "@/components/CreateMenu";
import { MobileNav, type MobileNavLink } from "@/components/MobileNav";
import { NotificationBell } from "@/components/NotificationBell";
import { OnboardingTour, TourHelpButton } from "@/components/OnboardingTour";
import { SidebarNav } from "@/components/SidebarNav";
import { canManageOffice, type SessionUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/catalog";
import type { InboxItem } from "@/lib/inbox";

const fieldLinks: MobileNavLink[] = [
  { href: "/min-dag", label: "Min dag", icon: "day", tour: "nav-min-dag" },
  { href: "/timesedler", label: "Timesedler", icon: "time" },
  { href: "/", label: "Overblik", icon: "overview", exact: true, tour: "nav-overblik" },
  { href: "/sager", label: "Arbejdssedler", icon: "jobs", tour: "nav-sager" },
  { href: "/tilbud", label: "Tilbud", icon: "quotes", tour: "nav-tilbud" },
  { href: "/kalender", label: "Planlægning", icon: "plan", tour: "nav-planlaegning" },
  { href: "/kunder", label: "Kunder", icon: "customers", tour: "nav-kunder" },
  { href: "/varer", label: "Varer", icon: "goods" },
  { href: "/vognlager", label: "Vognlager", icon: "van" },
  { href: "/serviceaftaler", label: "Serviceaftaler", icon: "service" },
];

const adminLinks: MobileNavLink[] = [
  { href: "/medarbejdere", label: "Medarbejdere", icon: "people" },
  { href: "/lon", label: "Løn", icon: "pay" },
  { href: "/okonomi", label: "Omsætning", icon: "money" },
  { href: "/fakturaer", label: "Fakturaer", icon: "invoice", tour: "nav-fakturaer" },
  { href: "/rykkere", label: "Rykkere", icon: "reminder" },
  { href: "/indkob", label: "Indkøb", icon: "purchase" },
  { href: "/indstillinger", label: "Indstillinger", icon: "settings", tour: "nav-indstillinger" },
];

export function AppShell({
  user,
  companyName,
  logoUrl,
  showTour,
  catalog,
  vanStock,
  inbox = [],
  children,
}: {
  user: SessionUser;
  companyName?: string;
  logoUrl?: string;
  showTour?: boolean;
  catalog?: boolean;
  vanStock?: boolean;
  inbox?: InboxItem[];
  children: React.ReactNode;
}) {
  const office = canManageOffice(user.role);
  const brand = companyName || "Exempo";
  const links = fieldLinks
    .filter((link) => office || !["/tilbud", "/kalender"].includes(link.href))
    .filter((link) => link.href !== "/varer" || catalog)
    .filter((link) => link.href !== "/vognlager" || vanStock);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <OnboardingTour
        autoStart={Boolean(showTour)}
        role={user.role}
        companyName={brand}
        userName={user.name}
      />
      <aside className="no-print hidden bg-pine text-[#f4efe4] lg:flex lg:flex-col">
        <div className="px-6 py-6">
          <Link href="/" className="block" data-tour="nav-brand">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brand} className="max-h-12 max-w-[180px] object-contain" />
            ) : (
              <p className="font-serif text-3xl tracking-tight">{brand}</p>
            )}
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#d7c9a8]">
              Ordrestyring
            </p>
          </Link>
        </div>
        <SidebarNav office={office} catalog={catalog} vanStock={vanStock} />
        <div className="mt-auto border-t border-white/10 px-6 py-5">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-[#d7c9a8]">{user.email}</p>
          <p className="text-xs text-[#d7c9a8]">{ROLE_LABELS[user.role]}</p>
          <TourHelpButton className="tour-help" />
          <form action={logoutAction} className="mt-2">
            <button type="submit" className="text-sm text-[#f0d9b8] underline-offset-4 hover:underline">
              Log ud
            </button>
          </form>
        </div>
      </aside>
      <MobileNav
        brand={brand}
        logoUrl={logoUrl}
        userName={user.name}
        userEmail={user.email}
        userRole={ROLE_LABELS[user.role]}
        tabs={[
          { href: "/min-dag", label: "Min dag", icon: "day" },
          { href: "/timesedler", label: "Tid", icon: "time" },
          { href: "/", label: "Overblik", icon: "overview", exact: true },
          { href: "/sager", label: "Sager", icon: "jobs" },
        ]}
        links={links}
        adminLinks={office ? adminLinks : []}
        createItems={
          office
            ? [
                { href: "/tilbud/ny", label: "Tilbud" },
                { href: "/sager/ny", label: "Sag" },
                { href: "/kunder/ny", label: "Kunde" },
                { href: "/ekstra/ny", label: "Ekstraarbejde" },
              ]
            : []
        }
        help={<TourHelpButton className="text-sm underline-offset-4 hover:underline" />}
        notify={<NotificationBell items={inbox} variant="header" />}
      />
      <div className="min-h-screen">
        <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(4.25rem+env(safe-area-inset-top))] sm:px-8 lg:px-8 lg:py-8 lg:pb-8 lg:pt-8">
          <div className="wo-createbar wo-createbar-desktop no-print">
            <NotificationBell items={inbox} />
            {office ? <CreateMenu /> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
