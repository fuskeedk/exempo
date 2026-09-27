import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { canManageOffice, requireSession } from "@/lib/auth";
import { loadInbox } from "@/lib/inbox";
import { getSettings, productCatalogEnabled, vanStockEnabled } from "@/lib/settings";
import { companyLogoSrc } from "@/lib/logo";
import { prisma } from "@/lib/prisma";
import { isTourCompleted } from "@/lib/tour";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  const [settings, inbox] = await Promise.all([
    getSettings(),
    loadInbox(prisma, { id: user.id, office: canManageOffice(user.role), tenantSlug: user.tenantSlug }),
  ]);
  return (
    <AppShell
      user={user}
      companyName={settings.company_name}
      logoUrl={companyLogoSrc(user.tenantSlug, settings.company_logo)}
      showTour={!isTourCompleted(settings, user.id)}
      catalog={productCatalogEnabled(settings)}
      vanStock={vanStockEnabled(settings)}
      inbox={inbox}
    >
      {children}
    </AppShell>
  );
}
