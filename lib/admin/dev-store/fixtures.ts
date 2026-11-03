import { randomUUID } from "node:crypto";
import { defaultCategories } from "@/lib/content/categories";
import type { Database } from "../types";

// Test fixture: schema.sql right after migration (seeded categories, one settings row, nothing else).
export function emptyDatabase(): Database {
  return {
    auth_users: [], profiles: [], tags: [], media: [], articles: [], article_tags: [],
    front_page_pins: [], most_read_picks: [], ad_campaigns: [],
    categories: defaultCategories.map((c) => ({
      id: randomUUID(), name: c.name, slug: c.slug, position: c.order, is_active: true,
    })),
    site_settings: [
      {
        id: true, newsroom_address: "", newsroom_phone: "", newsroom_email: "", corrections_email: "",
        facebook_url: "", instagram_url: "https://www.instagram.com/citymoodbadagry/",
        tiktok_url: "https://www.tiktok.com/@citymoodbadagry",
      },
    ],
  };
}
