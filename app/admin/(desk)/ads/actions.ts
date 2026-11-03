"use server";

import { revalidatePath } from "next/cache";
import { invalid } from "@/lib/admin/errors";
import type { CampaignWrite } from "@/lib/admin/repo";
import { staffAction } from "@/lib/admin/session";
import { lagosToIso } from "@/lib/admin/time";
import { AD_SLOTS, type AdSlot } from "@/lib/admin/types";

// Ad campaigns (admins). Changes reach the homepage without a redeploy.

export type CampaignForm = {
  slot: AdSlot;
  advertiser_name: string;
  image_desktop_id: string | null;
  image_mobile_id: string | null;
  link_url: string;
  alt: string;
  start: { date: string; time: string };
  end: { date: string; time: string };
};

function toWrite(form: CampaignForm): CampaignWrite {
  if (!AD_SLOTS.includes(form.slot)) throw invalid("Pick an ad slot.");
  if (!form.image_desktop_id && !form.image_mobile_id) throw invalid("Upload the creative for this slot.");
  const starts_at = lagosToIso(form.start.date, form.start.time);
  const ends_at = lagosToIso(form.end.date, form.end.time);
  if (!starts_at || !ends_at) throw invalid("Enter a start and end date and time.");
  const link = form.link_url.trim();
  return {
    slot: form.slot,
    advertiser_name: form.advertiser_name,
    image_desktop_id: form.image_desktop_id,
    image_mobile_id: form.image_mobile_id,
    link_url: link && !/^https?:\/\//i.test(link) ? `https://${link}` : link,
    alt: form.alt,
    starts_at,
    ends_at,
  };
}

export async function saveCampaign(id: string | null, form: CampaignForm) {
  return staffAction(async ({ repo }) => {
    const input = toWrite(form);
    const saved = id ? await repo.updateCampaign(id, input) : await repo.createCampaign(input);
    revalidatePath("/", "layout");
    return { id: saved.id };
  });
}

/** Stops a running campaign now. One that hasn't started yet is deleted instead. */
export async function endCampaign(id: string) {
  return staffAction(async ({ repo }) => {
    const c = await repo.getCampaign(id);
    if (!c) throw invalid("We couldn't find that campaign.");
    const now = Date.now();
    if (Date.parse(c.starts_at) >= now) await repo.deleteCampaign(id);
    else await repo.updateCampaign(id, { ends_at: new Date(now).toISOString() });
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function deleteCampaign(id: string) {
  return staffAction(async ({ repo }) => {
    await repo.deleteCampaign(id);
    revalidatePath("/", "layout");
    return undefined;
  });
}
