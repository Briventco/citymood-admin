import { site } from "@/config/site";
import { buildHomepage } from "@/lib/homepage";
import { supabaseSource } from "@/server/content/supabase";
import type { Article, Category, FrontPagePicks } from "./types";

export type { AdCampaign, AdSlotName, Article, ArticleImage, Category, FrontPagePicks, SiteSettings } from "./types";

// What readers see, built the way the public site builds it, so the Front page
// screen's "automatic" slots always match the homepage.

export async function getCategories(): Promise<Category[]> {
  const categories = await supabaseSource.categories();
  return [...categories].sort((a, b) => a.order - b.order);
}

/** Published articles, newest first. */
export async function getArticles(now: Date = new Date()): Promise<Article[]> {
  return publishedNewestFirst(await supabaseSource.articles(now), now);
}

export async function getFrontPagePicks(now: Date = new Date()): Promise<FrontPagePicks> {
  return supabaseSource.frontPage(now);
}

/** Everything the homepage shows, built with the DESIGN_SPEC §5 and ADMIN_SPEC §5 rules. */
export async function getHomepage(now: Date = new Date()) {
  const [articles, categories, picks] = await Promise.all([getArticles(now), getCategories(), getFrontPagePicks(now)]);
  return { articles, categories, home: buildHomepage(articles, categories, picks) };
}

export function publishedNewestFirst(articles: Article[], now: Date): Article[] {
  return articles
    .filter((a) => Date.parse(a.publishedAt) <= now.getTime())
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/**
 * Breaking items, newest first, capped. Expects newest-first input. Newsroom
 * stories carry their own window (breakingUntil); older stories use the
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
