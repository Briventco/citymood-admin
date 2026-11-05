import type { Article, ArticleImage, Category } from "@/lib/content";
import type { AdCampaign, FrontPagePicks, SiteSettings } from "@/lib/content/types";
import { site } from "@/config/site";
import type { ContentRepository, PublishedArticlePage, PublishedArticleQuery } from "./ports";
import type { AdSlotName } from "@/lib/content/types";
import { createClient } from "@/server/supabase/server";

type MediaRow = {
  id: string;
  storage_path: string;
  alt_text: string;
  width: number;
  height: number;
  focal_x: number | null;
  focal_y: number | null;
  caption: string | null;
  credit: string | null;
};

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  body: string;
  status: string;
  published_at: string | null;
  featured: boolean;
  feature_people: boolean;
  featured_image_id: string | null;
  breaking_until: string | null;
  role: string | null;
  place: string | null;
  reading_minutes: number | null;
  categories: { slug: string } | null;
  profiles: { display_name: string } | null;
  article_media: MediaRow[];
  article_tags: { tags: { slug: string } | null }[];
};

const MEDIA_COLUMNS = "id,storage_path,alt_text,width,height,focal_x,focal_y,caption,credit";
const ARTICLE_COLUMNS = `id,slug,title,standfirst,body,status,published_at,featured,feature_people,featured_image_id,breaking_until,role,place,reading_minutes,categories(slug),profiles!articles_author_id_fkey(display_name),article_media(${MEDIA_COLUMNS}),article_tags(tags(slug))`;

const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "article-media";

function publicMediaUrl(storagePath: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  return `${url}/storage/v1/object/public/${bucket}/${storagePath}`;
}

function mapImage(row: MediaRow | undefined): ArticleImage | null {
  if (!row) return null;
  return {
    src: publicMediaUrl(row.storage_path),
    alt: row.alt_text,
    width: row.width,
    height: row.height,
    focalPoint:
      row.focal_x === null || row.focal_y === null ? undefined : { x: row.focal_x, y: row.focal_y },
    caption: row.caption ?? undefined,
    credit: row.credit ?? undefined,
  };
}

function mapArticle(row: ArticleRow, featured?: Map<string, MediaRow>): Article {
  const chosen = row.featured_image_id ? featured?.get(row.featured_image_id) : undefined;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst,
    body: row.body,
    image: mapImage(chosen ?? row.article_media?.[0]),
    category: row.categories?.slug ?? null,
    tags: (row.article_tags ?? []).flatMap((item) => (item.tags?.slug ? [item.tags.slug] : [])),
    author: row.profiles?.display_name || "CityMood Desk",
    publishedAt: row.published_at ?? new Date(0).toISOString(),
    readingMinutes: row.reading_minutes ?? undefined,
    // Set by the newsroom. Without it the "breaking" tag and its age limit apply.
    breakingUntil: row.breaking_until ?? undefined,
    featured: row.featured,
    featurePeople: row.feature_people,
    role: row.role ?? undefined,
    place: row.place ?? undefined,
  };
}

/** Photos picked from the media library have no article_id, so the embed above can't reach them. */
async function featuredImages(rows: ArticleRow[]): Promise<Map<string, MediaRow>> {
  const ids = [...new Set(rows.flatMap((row) => (row.featured_image_id ? [row.featured_image_id] : [])))];
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const result = await supabase.from("article_media").select(MEDIA_COLUMNS).in("id", ids);
  if (result.error) throw result.error;
  return new Map((result.data as MediaRow[]).map((media) => [media.id, media]));
}

async function mapArticles(rows: ArticleRow[]): Promise<Article[]> {
  const featured = await featuredImages(rows);
  return rows.map((row) => mapArticle(row, featured));
}

async function queryArticles(query: PublishedArticleQuery = {}): Promise<ArticleRow[]> {
  const supabase = await createClient();
  let request = supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (query.categorySlug) {
    const category = await supabase.from("categories").select("id").eq("slug", query.categorySlug).maybeSingle();
    if (category.error) throw category.error;
    if (!category.data) return [];
    request = request.eq("category_id", category.data.id);
  }

  if (query.search) {
    const term = query.search.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ");
    if (term) {
      request = request.or(`title.ilike.%${term}%,standfirst.ilike.%${term}%,body.ilike.%${term}%`);
    }
  }

  if (query.limit) request = request.limit(Math.min(Math.max(query.limit, 1), 100));
  const result = await request;
  if (result.error) throw result.error;
  return (result.data ?? []) as unknown as ArticleRow[];
}

export const supabaseSource: ContentRepository = {
  async categories(): Promise<Category[]> {
    const supabase = await createClient();
    const result = await supabase
      .from("categories")
      .select("slug,name,short_name,display_order")
      .eq("active", true)
      .order("display_order", { ascending: true });
    if (result.error) throw result.error;
    return (result.data ?? []).map((category) => ({
      slug: category.slug,
      name: category.name,
      shortName: category.short_name,
      order: category.display_order,
    }));
  },

  async categoriesForNavigation(): Promise<Category[]> {
    return this.categories();
  },

  async articles(now): Promise<Article[]> {
    const rows = await queryArticles();
    return (await mapArticles(rows))
      .filter((article) => Date.parse(article.publishedAt) <= now.getTime());
  },

  async publishedArticle(idOrSlug): Promise<Article | null> {
    const rows = await queryArticles({ limit: 100 });
    return (await mapArticles(rows)).find((article) => article.id === idOrSlug || article.slug === idOrSlug) ?? null;
  },

  async publishedArticles(query = {}): Promise<PublishedArticlePage> {
    const rows = await queryArticles(query);
    const items = await mapArticles(rows);
    return { items, nextCursor: null };
  },

  async frontPage(): Promise<FrontPagePicks> {
    const supabase = await createClient();
    const [pins, picks] = await Promise.all([
      supabase.from("front_page_pins").select("slot,article_id"),
      supabase.from("most_read_picks").select("article_id").order("position", { ascending: true }),
    ]);
    if (pins.error) throw pins.error;
    if (picks.error) throw picks.error;
    const pinned = new Map((pins.data ?? []).map((pin) => [pin.slot as string, pin.article_id as string]));
    return {
      leadId: pinned.get("lead") ?? null,
      topIds: ["top_1", "top_2", "top_3", "top_4"].map((slot) => pinned.get(slot) ?? null),
      mostReadIds: (picks.data ?? []).map((pick) => pick.article_id as string),
    };
  },

  async adCampaigns(now: Date): Promise<AdCampaign[]> {
    const supabase = await createClient();
    const result = await supabase
      .from("ad_campaigns")
      .select("name,slot,alt_text,destination_url,image_mobile_id,starts_at,ends_at,active,media:article_media(storage_path,width,height)")
      .eq("active", true)
      .lte("starts_at", now.toISOString())
      .gt("ends_at", now.toISOString())
      .order("starts_at", { ascending: false });
    if (result.error) throw result.error;

    const mobileIds = (result.data ?? []).flatMap((campaign) => (campaign.image_mobile_id ? [campaign.image_mobile_id as string] : []));
    const mobile = mobileIds.length
      ? await supabase.from("article_media").select("id,storage_path,width,height").in("id", mobileIds)
      : null;
    if (mobile?.error) throw mobile.error;
    const mobileById = new Map((mobile?.data ?? []).map((media) => [media.id as string, media]));

    return (result.data ?? []).flatMap((campaign) => {
      const media = (Array.isArray(campaign.media) ? campaign.media[0] : campaign.media) as
        | { storage_path: string; width: number; height: number }
        | null;
      if (!media) return [];
      const creative = {
        src: publicMediaUrl(media.storage_path),
        width: media.width,
        height: media.height,
      };
      const mobileMedia = campaign.image_mobile_id ? mobileById.get(campaign.image_mobile_id) : undefined;
      return [{
        slot: campaign.slot === "mpu" ? "mpu_1" : campaign.slot as AdCampaign["slot"],
        advertiser: campaign.name,
        href: campaign.destination_url,
        alt: campaign.alt_text,
        desktop: creative,
        mobile: mobileMedia
          ? { src: publicMediaUrl(mobileMedia.storage_path), width: mobileMedia.width, height: mobileMedia.height }
          : creative,
      }];
    });
  },

  async siteSettings(): Promise<SiteSettings> {
    const supabase = await createClient();
    const result = await supabase.from("site_settings").select("*").single();
    if (result.error) throw result.error;
    const s = result.data;
    const label = (network: string) => site.social.find((item) => item.network === network)?.label ?? network;
    return {
      contact: {
        address: s.newsroom_address,
        phone: s.newsroom_phone,
        newsroomEmail: s.newsroom_email,
        correctionsEmail: s.corrections_email,
      },
      social: [
        { network: "Facebook", label: label("Facebook"), url: s.facebook_url },
        { network: "Instagram", label: label("Instagram"), url: s.instagram_url },
        { network: "TikTok", label: label("TikTok"), url: s.tiktok_url },
      ].filter((item) => item.url),
    };
  },
};

export async function getMostReadArticles(limit = 4): Promise<Article[]> {
  const supabase = await createClient();
  const ranking = await supabase.rpc("get_most_read_articles", { p_days: 7, p_limit: limit });
  if (ranking.error || !ranking.data || ranking.data.length === 0) return [];
  const ids = (ranking.data as { article_id: string }[]).map((row) => row.article_id);
  const rows = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .in("id", ids)
    .eq("status", "published");
  if (rows.error) throw rows.error;
  const data = rows.data as unknown as ArticleRow[];
  const featured = await featuredImages(data);
  const byId = new Map(data.map((row) => [row.id, mapArticle(row, featured)]));
  return ids.flatMap((id) => {
    const article = byId.get(id);
    return article ? [article] : [];
  });
}

export type ActiveAdCampaign = {
  href: string;
  alt: string;
  image: { src: string; width: number; height: number };
};

export async function getActiveAdCampaign(slot: AdSlotName, now = new Date()): Promise<ActiveAdCampaign | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select("destination_url,alt_text,media:article_media(storage_path,width,height)")
    .eq("slot", slot)
    .eq("active", true)
    .lte("starts_at", now.toISOString())
    .gt("ends_at", now.toISOString())
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.media) return null;
  const media = (Array.isArray(data.media) ? data.media[0] : data.media) as { storage_path: string; width: number; height: number } | undefined;
  if (!media) return null;
  return {
    href: data.destination_url,
    alt: data.alt_text,
    image: { src: publicMediaUrl(media.storage_path), width: media.width, height: media.height },
  };
}
