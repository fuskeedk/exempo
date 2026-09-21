import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { getSettings, productCatalogEnabled, vanStockEnabled } from "@/lib/settings";
import { companyLogoSrc } from "@/lib/logo";
import { isTourCompleted } from "@/lib/tour";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  const settings = await getSettings();
  return (
    <AppShell
      user={user}
      companyName={settings.company_name}
      logoUrl={companyLogoSrc(user.tenantSlug, settings.company_logo)}
      showTour={!isTourCompleted(settings, user.id)}
      catalog={productCatalogEnabled(settings)}
      vanStock={vanStockEnabled(settings)}
    >
      {children}
    </AppShell>
  );
}
