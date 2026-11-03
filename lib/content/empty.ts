import { defaultCategories } from "./categories";
import { staticAdCampaigns, staticSiteSettings } from "./static";
import type { ContentSource } from "./types";

// Production placeholder until a CMS is connected: the shell renders, the homepage shows its empty state.
export const emptySource: ContentSource = {
  categories: async () => defaultCategories,
  articles: async () => [],
  frontPage: async () => ({ leadId: null, topIds: [], mostReadIds: [] }),
  adCampaigns: async (now) => staticAdCampaigns(now),
  siteSettings: async () => staticSiteSettings(),
};
