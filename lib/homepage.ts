import type { Article, Category, FrontPagePicks } from "@/lib/content/types";

// Homepage data rules (DESIGN_SPEC.md §5, ADMIN_SPEC.md §5):
// - Lead: the editor's lead pin if it is live; otherwise the newest `featured`
//   article with an image, else the newest with an image, else the newest article.
// - Top stories: pinned slots top_1 to top_4 keep their position; empty slots fill
//   automatically (one per category where possible, newest first). Pins are
//   reserved before Latest fills, so a pinned story is never taken by Latest.
// - Each article appears at most once. Slots fill in this order: lead, latest,
//   top stories, category blocks (Local, Politics, Business), People, Culture,
//   Tourism. Most read is the exception and may repeat.
// - A category with nothing left hides its block. Uncategorised articles never
//   appear in category-based slots.

// Category slugs the homepage layout is built around (the CMS owns names and order).
export const HOMEPAGE_CATEGORIES = {
  local: "local-news",
  community: "community-people",
  business: "business-development",
  politics: "politics-public-affairs",
  culture: "culture-events",
  tourism: "tourism-heritage",
} as const;

export type CategoryBlock = { category: Category; first: Article; list: Article[] };

export type Homepage = {
  lead: Article | null;
  latest: Article[];
  topStories: Article[];
  /** The four top-story slots in order, null where nothing could fill one. */
  topSlots: (Article | null)[];
  local: CategoryBlock | null;
  politics: CategoryBlock | null;
  business: CategoryBlock | null;
  people: { category: Category; articles: Article[] } | null;
  culture: { category: Category; feature: Article; related: Article[] } | null;
  tourism: { category: Category; articles: Article[] } | null;
  mostRead: Article[];
};

const isPortrait = (a: Article) => !!a.image && a.image.height > a.image.width;

/** `articles` must be published and sorted newest first. Picks that aren't in `articles` (not live) are ignored. */
export function buildHomepage(
  articles: Article[],
  categories: Category[],
  picks: Partial<FrontPagePicks> = {},
): Homepage {
  const used = new Set<string>();
  const take = <T extends Article | null | undefined>(a: T): T => {
    if (a) used.add(a.id);
    return a;
  };
  const unused = () => articles.filter((a) => !used.has(a.id));
  const inCategory = (slug: string) => unused().filter((a) => a.category === slug);
  const preferImage = (list: Article[]) => list.find((a) => a.image) ?? list[0];
  const categoryFor = (slug: string) => categories.find((c) => c.slug === slug);

  const byId = new Map(articles.map((a) => [a.id, a]));
  const pinnedLead = picks.leadId ? byId.get(picks.leadId) : undefined;
  const pinnedTop = [0, 1, 2, 3].map((i): Article | undefined => {
    const id = picks.topIds?.[i];
    const a = id ? byId.get(id) : undefined;
    // A story fills one slot only: the lead pin wins, then the earlier top slot.
    const duplicate = !!a && (a === pinnedLead || picks.topIds?.indexOf(a.id) !== i);
    return duplicate ? undefined : a;
  });
  const reserved = new Set(pinnedTop.filter((a): a is Article => !!a).map((a) => a.id));
  const open = (a: Article) => !reserved.has(a.id);

  const lead = take(
    pinnedLead ??
      articles.find((a) => open(a) && a.featured && a.image) ??
      articles.find((a) => open(a) && a.image) ??
      articles.find(open) ??
      null,
  );
  pinnedTop.forEach(take);

  const latest = unused().slice(0, 5).map(take);

  // Automatic top stories: one per category where possible (newest first), then fill.
  const emptySlots = pinnedTop.filter((a) => !a).length;
  const known = new Set(categories.map((c) => c.slug));
  const perCategory = categories
    .map((c) => preferImage(inCategory(c.slug)))
    .filter((a): a is Article => !!a)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, emptySlots);
  perCategory.forEach(take);
  const fill = unused()
    .filter((a) => a.category && known.has(a.category))
    .slice(0, emptySlots - perCategory.length);
  fill.forEach(take);
  const automatic = [...perCategory, ...fill];
  const topSlots = pinnedTop.map((a) => a ?? automatic.shift() ?? null);
  const topStories = topSlots.filter((a): a is Article => !!a);

  const block = (slug: string, listSize: number): CategoryBlock | null => {
    const category = categoryFor(slug);
    const items = inCategory(slug);
    if (!category || items.length === 0) return null;
    const first = take(preferImage(items));
    const list = items.filter((a) => a.id !== first.id).slice(0, listSize).map(take);
    return { category, first, list };
  };

  const local = block(HOMEPAGE_CATEGORIES.local, 2);
  const politics = block(HOMEPAGE_CATEGORIES.politics, 2);
  const business = block(HOMEPAGE_CATEGORIES.business, 3);

  const communityCategory = categoryFor(HOMEPAGE_CATEGORIES.community);
  const peopleArticles = inCategory(HOMEPAGE_CATEGORIES.community)
    .filter((a) => a.featurePeople || isPortrait(a))
    .slice(0, 4)
    .map(take);
  const people =
    communityCategory && peopleArticles.length > 0 ? { category: communityCategory, articles: peopleArticles } : null;

  const cultureCategory = categoryFor(HOMEPAGE_CATEGORIES.culture);
  const cultureItems = inCategory(HOMEPAGE_CATEGORIES.culture);
  let culture: Homepage["culture"] = null;
  if (cultureCategory && cultureItems.length > 0) {
    const feature = take(preferImage(cultureItems));
    const related = cultureItems.filter((a) => a.id !== feature.id).slice(0, 2).map(take);
    culture = { category: cultureCategory, feature, related };
  }

  const tourismCategory = categoryFor(HOMEPAGE_CATEGORIES.tourism);
  const tourismArticles = inCategory(HOMEPAGE_CATEGORIES.tourism).slice(0, 2).map(take);
  const tourism =
    tourismCategory && tourismArticles.length > 0 ? { category: tourismCategory, articles: tourismArticles } : null;

  const mostRead = (picks.mostReadIds ?? [])
    .map((id) => byId.get(id))
    .filter((a): a is Article => !!a)
    .slice(0, 4);

  return { lead, latest, topStories, topSlots, local, politics, business, people, culture, tourism, mostRead };
}
