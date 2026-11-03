import type { AdCampaign, AdSlotName } from "@/lib/content/types";

export type { AdCampaign, AdSlotName };

// Static campaigns for the seed and empty content sources (demos without the
// newsroom store). Normally campaigns are managed in the admin (/admin/ads) and
// change without a redeploy. When no campaign is live for a slot, AdSlot shows
// the "Advertise with CityMood" house ad.

export type StaticAdCampaign = AdCampaign & {
  /** ISO dates. The campaign shows from start (inclusive) to end (exclusive). */
  start: string;
  end: string;
};

export const adCampaigns: StaticAdCampaign[] = [];
