import { site } from "@/config/site";
import { devStoreEnabled } from "@/lib/admin/backend";
import { buildHomepage } from "@/lib/homepage";
import { mostReadSlugs } from "@/config/mostRead";
import { emptySource } from "./empty";
import { newsroomSource } from "./newsroom";
import { seedSource } from "./seed";
import type { AdCampaign, AdSlotName, Article, Category, ContentSource, FrontPagePicks, SiteSettings } from "./types";
import type { PublishedArticleQuery } from "@/server/content/ports";

export type { AdCampaign, AdSlotName, Article, ArticleImage, Category, FrontPagePicks, SiteSettings } from "./types";

// Where the public site reads from:
// - the newsroom store, whatever the admin publishes (development, or ADMIN_DEV_STORE=1);
// - empty source only if EMPTY_CONTENT=1;
// - otherwise seedSource (default for demos and client review on Vercel).
// When the production backend (Supabase) is connected, it replaces this source.
export const isSeedContent = devStoreEnabled || process.env.CONTENT_SEED !== "0";

const source: ContentSource = devStoreEnabled
  ? newsroomSource
  : process.env.EMPTY_CONTENT === "1"
    ? emptySource
    : seedSource;

export async function getCategories(): Promise<Category[]> {
  const categories = await source.categories();
  return [...categories].sort((a, b) => a.order - b.order);
}

/** Published articles, newest first. */
export async function getArticles(now: Date = new Date()): Promise<Article[]> {
  return publishedNewestFirst(await source.articles(now), now);
}

export async function searchArticles(query: PublishedArticleQuery = {}, now: Date = new Date()): Promise<Article[]> {
  const term = query.search?.trim().toLocaleLowerCase();
  const category = query.categorySlug;
  return (await getArticles(now))
    .filter((article) => {
      const matchesTerm =
        !term ||
        [article.title, article.standfirst, article.body, ...article.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(term);
      return matchesTerm && (!category || article.category === category);
    })
    .slice(0, query.limit ?? 50);
}

export async function getPublishedArticle(idOrSlug: string, now: Date = new Date()): Promise<Article | null> {
  return (await getArticles(now)).find((article) => article.id === idOrSlug || article.slug === idOrSlug) ?? null;
}

export async function getMostRead(now: Date = new Date()): Promise<Article[]> {
  const articles = await getArticles(now);
  return mostReadSlugs.flatMap((slug) => {
    const article = articles.find((item) => item.slug === slug);
    return article ? [article] : [];
  });
}

export async function getBreaking(now: Date = new Date()): Promise<Article[]> {
  return selectBreaking(await getArticles(now), now);
}

export async function getFrontPagePicks(now: Date = new Date()): Promise<FrontPagePicks> {
  return source.frontPage(now);
}

/** Everything the homepage shows, built with the DESIGN_SPEC §5 and ADMIN_SPEC §5 rules. */
export async function getHomepage(now: Date = new Date()) {
  const [articles, categories, picks] = await Promise.all([getArticles(now), getCategories(), getFrontPagePicks(now)]);
  return { articles, categories, home: buildHomepage(articles, categories, picks) };
}

/** The campaign for a slot running at `now` (the most recently started, if several overlap), or null for the house ad. */
export async function getAdCampaign(slot: AdSlotName, now: Date = new Date()): Promise<AdCampaign | null> {
  return (await source.adCampaigns(now)).find((c) => c.slot === slot) ?? null;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return source.siteSettings();
}

export function publishedNewestFirst(articles: Article[], now: Date): Article[] {
  return articles
    .filter((a) => Date.parse(a.publishedAt) <= now.getTime())
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/**
 * Breaking items, newest first, capped. Expects newest-first input. Newsroom
 * stories carry their own window (breakingUntil); seed stories use the
 * "breaking" tag and an expiry counted from publication.
 */
export function selectBreaking(
  articles: Article[],
  now: Date,
  maxAgeHours: number = site.breakingMaxAgeHours,
  maxItems: number = site.breakingMaxItems,
): Article[] {
  const cutoff = now.getTime() - maxAgeHours * 60 * 60 * 1000;
  const isBreaking = (a: Article) =>
    a.breakingUntil !== undefined
      ? a.breakingUntil !== null && Date.parse(a.breakingUntil) > now.getTime()
      : a.tags.includes("breaking") && Date.parse(a.publishedAt) >= cutoff;
  return articles.filter(isBreaking).slice(0, maxItems);
}

export function categoryBySlug(categories: Category[], slug: string | null): Category | undefined {
  return slug ? categories.find((c) => c.slug === slug) : undefined;
}
