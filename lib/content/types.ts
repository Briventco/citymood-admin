// CityMood content model. The repository in ./index.ts is the only thing the UI
// imports, so a CMS can replace the seed adapter without touching components.

export type Category = {
  slug: string;
  name: string;
  /** Short label for the mobile section strip, e.g. "Local". */
  shortName: string;
  order: number;
};

export type ArticleImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Editor's focal point, 0–1 on each axis. Maps to object-position. */
  focalPoint?: { x: number; y: number };
  caption?: string;
  credit?: string;
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  /** Plain-text paragraphs separated by blank lines. */
  body: string;
  image: ArticleImage | null;
  /** Category slug, or null when uncategorised. */
  category: string | null;
  /** "breaking" puts the article in the ticker. */
  tags: string[];
  author: string;
  /** ISO 8601. */
  publishedAt: string;
  readingMinutes?: number;
  /** Candidate for the homepage lead. */
  featured: boolean;
  /** Editor flag for the People of Badagry band. */
  featurePeople?: boolean;
  /** Portrait line on People cards: "Canoe builder" + "Topo". */
  role?: string;
  place?: string;
  /** Reserved for view counting; unused while Most read is curated. */
  viewCount?: number;
  /**
   * End of the breaking-ticker window (ISO), set by the newsroom. When present it
   * replaces the "breaking" tag rule; null means not breaking.
   */
  breakingUntil?: string | null;
};

/** Editor choices for the homepage (ADMIN_SPEC §5). Missing or non-live ids are skipped. */
export type FrontPagePicks = {
  leadId: string | null;
  /** Slots top_1 to top_4; null fills automatically. */
  topIds: (string | null)[];
  mostReadIds: string[];
};

export type AdSlotName = "leaderboard" | "mpu_1" | "mpu_2" | "billboard";

export type AdCreative = { src: string; width: number; height: number };

/** A direct-sold campaign running now. */
export type AdCampaign = {
  slot: AdSlotName;
  advertiser: string;
  href: string;
  alt: string;
  /** Shown from 640px (or everywhere when there is no mobile creative). */
  desktop: AdCreative | null;
  /** Shown below 640px. */
  mobile: AdCreative | null;
};

/** Footer and Contact details. */
export type SiteSettings = {
  contact: { address: string; phone: string; newsroomEmail: string; correctionsEmail: string };
  social: { network: string; label: string; url: string }[];
};

/** Where content comes from: the newsroom store, the seed (demos and tests), or nothing. */
export type ContentSource = {
  categories(): Promise<Category[]>;
  /** Every article, any order. The repository filters and sorts. */
  articles(now: Date): Promise<Article[]>;
  frontPage(now: Date): Promise<FrontPagePicks>;
  /** Campaigns running at `now`. */
  adCampaigns(now: Date): Promise<AdCampaign[]>;
  siteSettings(): Promise<SiteSettings>;
};
