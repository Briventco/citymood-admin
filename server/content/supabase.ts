import type { Article, ArticleImage, Category } from "@/lib/content";
import type { AdCampaign, FrontPagePicks, SiteSettings } from "@/lib/content/types";
import { staticAdCampaigns, staticSiteSettings } from "@/lib/content/static";
import type { ContentRepository, PublishedArticlePage, PublishedArticleQuery } from "./ports";
import type { AdSlotName } from "@/config/ads";
import { createClient } from "@/server/supabase/server";

type MediaRow = {
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
  role: string | null;
  place: string | null;
  reading_minutes: number | null;
  categories: { slug: string } | null;
  profiles: { display_name: string } | null;
  article_media: MediaRow[];
  article_tags: { tags: { slug: string } | null }[];
};

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

function mapArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst,
    body: row.body,
    image: mapImage(row.article_media?.[0]),
    category: row.categories?.slug ?? null,
    tags: (row.article_tags ?? []).flatMap((item) => (item.tags?.slug ? [item.tags.slug] : [])),
    author: row.profiles?.display_name || "CityMood Desk",
    publishedAt: row.published_at ?? new Date(0).toISOString(),
    readingMinutes: row.reading_minutes ?? undefined,
    featured: row.featured,
    featurePeople: row.feature_people,
    role: row.role ?? undefined,
    place: row.place ?? undefined,
  };
}

async function queryArticles(query: PublishedArticleQuery = {}): Promise<ArticleRow[]> {
  const supabase = await createClient();
  let request = supabase
    .from("articles")
    .select(
      "id,slug,title,standfirst,body,status,published_at,featured,feature_people,role,place,reading_minutes,categories(slug),profiles!articles_author_id_fkey(display_name),article_media(storage_path,alt_text,width,height,focal_x,focal_y,caption,credit),article_tags(tags(slug))",
    )
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
    return rows
      .map(mapArticle)
      .filter((article) => Date.parse(article.publishedAt) <= now.getTime());
  },

  async publishedArticle(idOrSlug): Promise<Article | null> {
    const rows = await queryArticles({ limit: 100 });
    return rows.map(mapArticle).find((article) => article.id === idOrSlug || article.slug === idOrSlug) ?? null;
  },

  async publishedArticles(query = {}): Promise<PublishedArticlePage> {
    const rows = await queryArticles(query);
    const items = rows.map(mapArticle);
    return { items, nextCursor: null };
  },

  async frontPage(): Promise<FrontPagePicks> {
    return { leadId: null, topIds: [], mostReadIds: [] };
  },

  async adCampaigns(now: Date): Promise<AdCampaign[]> {
    return staticAdCampaigns(now);
  },

  async siteSettings(): Promise<SiteSettings> {
    return staticSiteSettings();
  },
};

export async function getMostReadArticles(limit = 4): Promise<Article[]> {
  const supabase = await createClient();
  const ranking = await supabase.rpc("get_most_read_articles", { p_days: 7, p_limit: limit });
  if (ranking.error || !ranking.data || ranking.data.length === 0) return [];
  const ids = (ranking.data as { article_id: string }[]).map((row) => row.article_id);
  const rows = await supabase
    .from("articles")
    .select(
      "id,slug,title,standfirst,body,status,published_at,featured,feature_people,role,place,reading_minutes,categories(slug),profiles!articles_author_id_fkey(display_name),article_media(storage_path,alt_text,width,height,focal_x,focal_y,caption,credit),article_tags(tags(slug))",
    )
    .in("id", ids)
    .eq("status", "published");
  if (rows.error) throw rows.error;
  const byId = new Map((rows.data as unknown as ArticleRow[]).map((row) => [row.id, mapArticle(row)]));
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
