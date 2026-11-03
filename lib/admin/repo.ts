import type {
  AdCampaign,
  AdSlot,
  Article,
  ArticleStatus,
  Category,
  FrontPagePin,
  FrontSlot,
  Media,
  MostReadPick,
  Profile,
  SiteSettings,
  StaffRole,
  Tag,
  Timestamp,
  Uuid,
} from "./types";

// The newsroom data layer. Screens and server actions only talk to these two
// interfaces. Today they are backed by the dev JSON store (./dev-store); a
// Supabase adapter will implement the same methods, with RLS doing the job the
// dev store's policies.ts does now.
//
// A NewsroomRepo is bound to one signed-in user, like a Supabase client carrying
// that user's session. It never trusts the caller for identity or role.

export type StaffMember = Profile & {
  email: string;
  invited_at: Timestamp | null;
  last_sign_in_at: Timestamp | null;
};

/** What the signed-in user may do. Derived from the same rules the data layer enforces. */
export type Permissions = {
  role: StaffRole;
  /** Feature stories, change bylines, unpublish, run the Front page, tidy tags, delete stories and media. */
  editor: boolean;
  /** Staff, categories, ad campaigns, site settings. */
  admin: boolean;
};

export const permissionsFor = (role: StaffRole): Permissions => ({
  role,
  editor: role === "editor" || role === "admin",
  admin: role === "admin",
});

// ───────────── Articles ─────────────

export type ArticleListQuery = {
  status?: ArticleStatus | "all";
  /** Matches headline, tag name or author name. */
  search?: string;
  categoryId?: Uuid;
  authorId?: Uuid;
  /** 1-based. */
  page?: number;
  pageSize?: number;
};

export type ArticleSummary = Pick<
  Article,
  | "id" | "slug" | "headline" | "status" | "publish_at" | "updated_at" | "created_at"
  | "featured" | "breaking" | "breaking_until" | "category_id" | "author_id"
> & {
  category_name: string | null;
  category_slug: string | null;
  author_name: string | null;
  image: Media | null;
  /** Live now: published or scheduled with publish_at in the past. */
  live: boolean;
  can_edit: boolean;
};

export type ArticleList = {
  items: ArticleSummary[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ArticleStatus | "all", number>;
};

export type ArticleDetail = {
  article: Article;
  tags: Tag[];
  image: Media | null;
  category: Category | null;
  author: Pick<Profile, "id" | "full_name"> | null;
  live: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

/** Fields staff may write directly. Status, publish time and the breaking window go through publish/unpublish. */
export type ArticleWrite = Partial<
  Pick<
    Article,
    | "slug" | "headline" | "standfirst" | "body" | "category_id" | "author_id"
    | "featured_image_id" | "featured" | "breaking" | "seo_title" | "seo_description"
  >
> & {
  /** Tag names. New names create tags. Omit to leave tags unchanged. */
  tags?: string[];
};

// ───────────── Media, taxonomy, staff ─────────────

export type MediaItem = Media & { uploader_name: string | null; used_by: number; can_edit: boolean };

export type MediaWrite = Partial<Pick<Media, "alt" | "caption" | "credit" | "focal_x" | "focal_y">>;

export type NewMedia = Pick<Media, "storage_path" | "width" | "height"> & Partial<Pick<Media, "alt" | "caption" | "credit">>;

export type CategoryItem = Category & { article_count: number };
export type TagItem = Tag & { article_count: number };

export type Invite = { email: string; full_name: string; role: StaffRole };

// ───────────── Front page and ads ─────────────

export type FrontPageState = {
  pins: (FrontPagePin & { pinned_by_name: string | null })[];
  picks: MostReadPick[];
};

export type CampaignItem = AdCampaign & { desktop: Media | null; mobile: Media | null };

export type CampaignWrite = Pick<
  AdCampaign,
  "slot" | "advertiser_name" | "image_desktop_id" | "image_mobile_id" | "link_url" | "alt" | "starts_at" | "ends_at"
>;

export interface NewsroomRepo {
  /** The signed-in user, or null if there is no session or the profile is inactive. */
  me(): Promise<StaffMember | null>;

  listArticles(query: ArticleListQuery): Promise<ArticleList>;
  getArticle(id: Uuid): Promise<ArticleDetail | null>;
  createArticle(input: ArticleWrite): Promise<ArticleDetail>;
  updateArticle(id: Uuid, input: ArticleWrite): Promise<ArticleDetail>;
  /** publishAt null = now ("published"); a future time = "scheduled". */
  publishArticle(id: Uuid, publishAt: Timestamp | null): Promise<ArticleDetail>;
  /** Takes a live story down (editors), or returns a scheduled one to draft. */
  unpublishArticle(id: Uuid): Promise<ArticleDetail>;
  deleteArticle(id: Uuid): Promise<void>;
  /** Live stories for the Front page pickers, newest first. */
  searchLiveArticles(search: string, limit?: number): Promise<ArticleSummary[]>;
  /** Live stories in the breaking ticker, newest first. */
  listBreaking(): Promise<ArticleSummary[]>;
  extendBreaking(id: Uuid, hours: number): Promise<void>;
  endBreaking(id: Uuid): Promise<void>;
  authors(): Promise<Pick<Profile, "id" | "full_name" | "role">[]>;

  listMedia(search?: string): Promise<MediaItem[]>;
  getMedia(id: Uuid): Promise<MediaItem | null>;
  createMedia(input: NewMedia): Promise<Media>;
  updateMedia(id: Uuid, input: MediaWrite): Promise<Media>;
  /** Returns the deleted row so the caller can remove the file. */
  deleteMedia(id: Uuid): Promise<Media>;

  listCategories(): Promise<CategoryItem[]>;
  createCategory(name: string): Promise<Category>;
  updateCategory(id: Uuid, input: Partial<Pick<Category, "name" | "is_active">>): Promise<Category>;
  moveCategory(id: Uuid, direction: -1 | 1): Promise<void>;
  listTags(): Promise<TagItem[]>;
  renameTag(id: Uuid, name: string): Promise<Tag>;
  /** Moves every story from `fromId` to `intoId`, then deletes `fromId`. */
  mergeTags(fromId: Uuid, intoId: Uuid): Promise<void>;
  deleteTag(id: Uuid): Promise<void>;

  listStaff(): Promise<StaffMember[]>;
  inviteStaff(invite: Invite): Promise<StaffMember>;
  resendInvite(id: Uuid): Promise<void>;
  updateStaff(id: Uuid, input: Partial<Pick<Profile, "role" | "is_active" | "full_name">>): Promise<StaffMember>;

  getFrontPage(): Promise<FrontPageState>;
  /** null clears the slot (automatic). A story can hold only one slot, so pinning it moves it. */
  setPin(slot: FrontSlot, articleId: Uuid | null): Promise<void>;
  /** Sets top_1 to top_4 in one go (null = automatic), for reordering. */
  arrangeTopStories(articleIds: (Uuid | null)[]): Promise<void>;
  /** Up to 5 article ids, in rank order. */
  setMostRead(articleIds: Uuid[]): Promise<void>;

  listCampaigns(): Promise<CampaignItem[]>;
  getCampaign(id: Uuid): Promise<CampaignItem | null>;
  createCampaign(input: CampaignWrite): Promise<AdCampaign>;
  updateCampaign(id: Uuid, input: Partial<CampaignWrite>): Promise<AdCampaign>;
  deleteCampaign(id: Uuid): Promise<void>;

  getSettings(): Promise<SiteSettings>;
  updateSettings(input: Partial<Omit<SiteSettings, "id">>): Promise<SiteSettings>;
}

// ───────────── Public reads (anon, like the Supabase anon key) ─────────────

export type PublicArticle = Article & {
  category: Category | null;
  author_name: string | null;
  image: Media | null;
  tag_names: string[];
};

export type PublicCampaign = AdCampaign & { desktop: Media | null; mobile: Media | null };

export interface NewsroomPublicReader {
  /** The live_articles view, newest first. */
  liveArticles(now: Date): Promise<PublicArticle[]>;
  /** Visible categories, in position order. */
  categories(): Promise<Category[]>;
  frontPage(): Promise<{ pins: FrontPagePin[]; picks: MostReadPick[] }>;
  /** Campaigns running now, for one slot or all. */
  runningCampaigns(now: Date, slot?: AdSlot): Promise<PublicCampaign[]>;
  settings(): Promise<SiteSettings>;
}
