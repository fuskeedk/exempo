"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { tourSettingKey } from "@/lib/tour";

export async function completeTourAction() {
  const user = await requireSession();
  await setSetting(tourSettingKey(user.id), "1");
  revalidatePath("/", "layout");
}

export async function restartTourAction() {
  const user = await requireSession();
  await setSetting(tourSettingKey(user.id), "");
  revalidatePath("/", "layout");
}
