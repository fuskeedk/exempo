"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";

export type MobileNavLink = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  tour?: string;
};

export type MobileTab = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
};

const ICONS = {
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  day: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5L15 14" />
    </>
  ),
  overview: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </>
  ),
  jobs: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 4.5h6v3H9zM8 11h8M8 15h6" />
    </>
  ),
  quotes: (
    <>
      <path d="M7 3.5h7.5L19 8v12.5H7z" />
      <path d="M14.5 3.5V8H19M9 12h6M9 16h4" />
    </>
  ),
  plan: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16M8 14h3M13 14h3M8 17h3" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="2.4" />
      <path d="M4.5 18c.4-3 2.2-4.5 4.5-4.5S13.1 15 13.5 18" />
      <circle cx="16" cy="9" r="2" />
      <path d="M15 13.6c2 .3 3.4 1.6 3.8 4.4" />
    </>
  ),
  goods: (
    <>
      <path d="M4.5 8.5 12 4.5l7.5 4-7.5 4z" />
      <path d="M4.5 8.5v7l7.5 4 7.5-4v-7" />
      <path d="M12 12.5V20" />
    </>
  ),
  van: (
    <>
      <path d="M3 15V8.5h11V15" />
      <path d="M14 11h4.2L21 14.2V15h-7" />
      <circle cx="7.5" cy="16.5" r="1.6" />
      <circle cx="16.5" cy="16.5" r="1.6" />
    </>
  ),
  service: (
    <>
      <path d="M7 7a6 6 0 0 1 10.5 2.5" />
      <path d="M17.5 5.5v4h-4" />
      <path d="M17 17a6 6 0 0 1-10.5-2.5" />
      <path d="M6.5 18.5v-4h4" />
    </>
  ),
  people: (
    <>
      <circle cx="12" cy="8" r="2.6" />
      <path d="M6 19c.5-3.4 2.6-5 6-5s5.5 1.6 6 5" />
    </>
  ),
  pay: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M3.5 10h17M8 15h4" />
    </>
  ),
  money: (
    <>
      <path d="M4 17V7l4 3 4-5 4 5 4-3v10z" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 3.5h9l3 3V20.5H6z" />
      <path d="M15 3.5V7h3.5M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  reminder: (
    <>
      <path d="M6 16.5h12l-1.2-2.2V11a4.8 4.8 0 1 0-9.6 0v3.3z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>
  ),
  purchase: (
    <>
      <circle cx="9" cy="19" r="1.3" />
      <circle cx="17" cy="19" r="1.3" />
      <path d="M4 5h2.2l1.4 10h11.2l2-7H7.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.5v2.2M12 17.3V19.5M4.5 12h2.2M17.3 12H19.5M6.4 6.4l1.6 1.6M16 16l1.6 1.6M17.6 6.4 16 8M8 16l-1.6 1.6" />
    </>
  ),
  support: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1 1-1 1.8V14" />
      <path d="M12 17.2v.2" />
    </>
  ),
  plus: (
    <>
      <path d="M12 6v12" />
      <path d="M6 12h12" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact || href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({
  brand,
  logoUrl,
  userName,
  userEmail,
  userRole,
  links,
  adminLinks = [],
  tabs,
  createItems = [],
  help,
}: {
  brand: string;
  logoUrl?: string;
  userName: string;
  userEmail?: string;
  userRole: string;
  links: MobileNavLink[];
  adminLinks?: MobileNavLink[];
  tabs: MobileTab[];
  createItems?: { href: string; label: string }[];
  help?: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setCreateOpen(false);
  }, [pathname]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (menuOpen || createOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen, createOpen]);

  return (
    <div className="lg:hidden">
      <header className="no-print fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-pine text-[#f4efe4] pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-3 px-3">
          <button
            type="button"
            aria-label="Åbn menu"
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10"
          >
            <Icon name="menu" />
          </button>
          <Link href="/" className="min-w-0 flex-1" data-tour="nav-brand">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brand} className="max-h-8 max-w-[180px] object-contain" />
            ) : (
              <p className="truncate font-serif text-[1.35rem] leading-none tracking-tight">{brand}</p>
            )}
          </Link>
          {createItems.length ? (
            <button
              type="button"
              aria-label="Opret"
              onClick={() => setCreateOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#b85c38] text-white"
            >
              <Icon name="plus" />
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Luk menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-paper shadow-2xl">
            <div className="bg-pine px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-[#f4efe4]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-2xl leading-tight">{userName}</p>
                  <p className="mt-1 truncate text-sm text-[#d7c9a8]">{brand}</p>
                  {userEmail ? <p className="truncate text-xs text-[#d7c9a8]">{userEmail}</p> : null}
                  <p className="text-xs text-[#d7c9a8]">{userRole}</p>
                </div>
                <button
                  type="button"
                  aria-label="Luk"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              {adminLinks.some((link) => link.href === "/indstillinger") ? (
                <Link
                  href="/indstillinger"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm"
                >
                  <Icon name="settings" size={18} />
                  Indstillinger
                </Link>
              ) : null}
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {links.map((link) => {
                const active = isActive(pathname, link.href, link.exact);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-tour={link.tour}
                    className={`flex items-center gap-3 px-5 py-3.5 text-[16px] ${
                      active ? "bg-moss font-medium text-pine" : "text-ink"
                    }`}
                  >
                    <span className={active ? "text-pine" : "text-muted"}>
                      <Icon name={link.icon} />
                    </span>
                    {link.label}
                  </Link>
                );
              })}
              {adminLinks.length ? (
                <>
                  <p className="mt-3 px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Administration
                  </p>
                  {adminLinks.map((link) => {
                    const active = isActive(pathname, link.href, link.exact);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        data-tour={link.tour}
                        className={`flex items-center gap-3 px-5 py-3.5 text-[16px] ${
                          active ? "bg-moss font-medium text-pine" : "text-ink"
                        }`}
                      >
                        <span className={active ? "text-pine" : "text-muted"}>
                          <Icon name={link.icon} />
                        </span>
                        {link.label}
                      </Link>
                    );
                  })}
                </>
              ) : null}
            </nav>
            <div className="border-t border-line pb-[env(safe-area-inset-bottom)]">
              {help ? <div className="px-5 py-3 text-sm text-pine">{help}</div> : null}
              <div className="grid grid-cols-2">
                <Link href="/stoette" className="flex items-center justify-center gap-2 py-4 text-sm text-muted">
                  <Icon name="support" size={18} />
                  Support
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className="flex w-full items-center justify-center gap-2 py-4 text-sm text-muted">
                    Log ud
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Luk opret"
            className="absolute inset-0 bg-black/40"
            onClick={() => setCreateOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-paper-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <p className="px-5 pb-2 pt-5 font-serif text-2xl">Opret</p>
            {createItems.map((item) => (
              <Link key={item.href} href={item.href} className="block px-5 py-3.5 text-[16px]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-2 pb-[env(safe-area-inset-bottom)]">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href, tab.exact);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                  active ? "font-semibold text-pine" : "text-muted"
                }`}
              >
                <Icon name={tab.icon} size={22} />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted"
          >
            <Icon name="menu" size={22} />
            Menu
          </button>
        </div>
      </nav>
    </div>
  );
}
