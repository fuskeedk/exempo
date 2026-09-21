import { redirect } from "next/navigation";
import { canManageOffice, type SessionUser } from "@/lib/auth";
import { getSettings, productCatalogEnabled, vanStockEnabled } from "@/lib/settings";

export function bounceModuleOff(office: boolean, message: string): never {
  if (office) {
    redirect(`/indstillinger?besked=${encodeURIComponent(`${message} Slå det til under Moduler.`)}#moduler`);
  }
  redirect(`/min-dag?besked=${encodeURIComponent(message)}`);
}

export async function requireProductCatalog(user: Pick<SessionUser, "role">) {
  const settings = await getSettings();
  if (!productCatalogEnabled(settings)) {
    bounceModuleOff(canManageOffice(user.role), "Varekatalog er slået fra.");
  }
}

export async function requireVanStock(user: Pick<SessionUser, "role">) {
  const settings = await getSettings();
  if (!vanStockEnabled(settings)) {
    bounceModuleOff(canManageOffice(user.role), "Vognlager er slået fra.");
  }
}
