import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { CreateMenu } from "@/components/CreateMenu";
import { OnboardingTour, TourHelpButton } from "@/components/OnboardingTour";
import { SidebarNav } from "@/components/SidebarNav";
import { canManageOffice, type SessionUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/catalog";

export function AppShell({
  user,
  companyName,
  logoUrl,
  showTour,
  catalog,
  vanStock,
  children,
}: {
  user: SessionUser;
  companyName?: string;
  logoUrl?: string;
  showTour?: boolean;
  catalog?: boolean;
  vanStock?: boolean;
  children: React.ReactNode;
}) {
  const office = canManageOffice(user.role);
  const brand = companyName || "Exempo";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <OnboardingTour
        autoStart={Boolean(showTour)}
        role={user.role}
        companyName={brand}
        userName={user.name}
      />
      <aside className="no-print bg-pine text-[#f4efe4]">
        <div className="flex items-center justify-between px-6 py-6 lg:block">
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
        <div className="mt-auto hidden border-t border-white/10 px-6 py-5 lg:block">
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
      <div className="min-h-screen">
        <div className="no-print flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <div>
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted">{user.email}</p>
            <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
          </div>
          <div className="flex items-center gap-3">
            <TourHelpButton className="text-sm text-pine-2" />
            <form action={logoutAction}>
              <button type="submit" className="text-sm text-pine-2">
                Log ud
              </button>
            </form>
          </div>
        </div>
        <main className="px-4 py-6 sm:px-8 sm:py-8">
          {office ? (
            <div className="wo-createbar no-print">
              <CreateMenu />
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
