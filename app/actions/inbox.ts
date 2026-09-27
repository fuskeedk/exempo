"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { markInboxSeen } from "@/lib/inbox-seen";

function safePath(href: string) {
  return href.startsWith("/") && !href.startsWith("//") ? href : "/";
}

export async function openInboxItemAction(formData: FormData) {
  const user = await requireSession();
  const href = safePath(String(formData.get("href") ?? "/"));
  const key = String(formData.get("id") ?? "");
  if (key) markInboxSeen(user.tenantSlug, user.id, [key]);
  redirect(href);
}
