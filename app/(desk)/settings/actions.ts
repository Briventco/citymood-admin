"use server";

import { revalidatePath } from "next/cache";
import { staffAction } from "@/lib/admin/session";
import type { SiteSettings } from "@/lib/admin/types";

/** Admins. These values feed the public footer (and the Contact page once it exists). */
export async function saveSettings(input: Omit<SiteSettings, "id">) {
  return staffAction(async ({ repo }) => {
    await repo.updateSettings(input);
    revalidatePath("/", "layout");
    return undefined;
  });
}
