import { adCampaigns } from "@/config/ads";
import { site } from "@/config/site";
import type { AdCampaign, SiteSettings } from "./types";

// Config-file fallbacks for the seed and empty sources (no newsroom store).

export const staticSiteSettings = (): SiteSettings => ({
  contact: { ...site.contact },
  social: site.social.map((s) => ({ ...s })),
});

export const staticAdCampaigns = (now: Date): AdCampaign[] =>
  adCampaigns
    .filter((c) => Date.parse(c.start) <= now.getTime() && now.getTime() < Date.parse(c.end))
    .map((c) => ({ slot: c.slot, advertiser: c.advertiser, href: c.href, alt: c.alt, desktop: c.desktop, mobile: c.mobile }));
