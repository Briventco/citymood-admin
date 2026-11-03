// Row types for the newsroom database. They mirror docs/design/admin/schema.sql
// column for column (snake_case, nullability, enums), so a Supabase adapter can
// use generated types in their place without the screens changing.
// Timestamps are ISO 8601 strings, as supabase-js returns them.

export type Uuid = string;
export type Timestamp = string;

export type StaffRole = "reporter" | "editor" | "admin";
export type ArticleStatus = "draft" | "scheduled" | "published" | "unpublished";
export type AdSlot = "leaderboard" | "mpu_1" | "mpu_2" | "billboard";
export type FrontSlot = "lead" | "top_1" | "top_2" | "top_3" | "top_4";

export const STAFF_ROLES: StaffRole[] = ["reporter", "editor", "admin"];
export const ARTICLE_STATUSES: ArticleStatus[] = ["draft", "scheduled", "published", "unpublished"];
export const AD_SLOTS: AdSlot[] = ["leaderboard", "mpu_1", "mpu_2", "billboard"];
export const TOP_SLOTS = ["top_1", "top_2", "top_3", "top_4"] as const satisfies FrontSlot[];

/** Tiptap JSON, stored in articles.body (jsonb). */
export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type Profile = {
  id: Uuid;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  created_at: Timestamp;
};

export type Category = {
  id: Uuid;
  name: string;
  slug: string;
  position: number;
  is_active: boolean;
};

export type Tag = {
  id: Uuid;
  name: string;
  slug: string;
};

export type Media = {
  id: Uuid;
  /** Path inside the "media" bucket, e.g. 2026/10/<uuid>.webp. */
  storage_path: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  credit: string;
  focal_x: number;
  focal_y: number;
  uploaded_by: Uuid | null;
  created_at: Timestamp;
};

export type Article = {
  id: Uuid;
  slug: string;
  headline: string;
  standfirst: string;
  body: RichTextNode;
  /** Sanitized HTML generated on the server from `body`. Public pages render this. */
  body_html: string;
  category_id: Uuid | null;
  author_id: Uuid | null;
  featured_image_id: Uuid | null;
  status: ArticleStatus;
  /** Live when status is published or scheduled and publish_at <= now. */
  publish_at: Timestamp | null;
  featured: boolean;
  breaking: boolean;
  breaking_until: Timestamp | null;
  seo_title: string;
  seo_description: string;
  created_by: Uuid | null;
  updated_by: Uuid | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type ArticleTag = {
  article_id: Uuid;
  tag_id: Uuid;
};

export type FrontPagePin = {
  slot: FrontSlot;
  article_id: Uuid;
  pinned_by: Uuid | null;
  pinned_at: Timestamp;
};

export type MostReadPick = {
  /** 1 to 5. */
  position: number;
  article_id: Uuid;
};

export type AdCampaign = {
  id: Uuid;
  slot: AdSlot;
  advertiser_name: string;
  image_desktop_id: Uuid | null;
  image_mobile_id: Uuid | null;
  link_url: string;
  alt: string;
  starts_at: Timestamp;
  ends_at: Timestamp;
  created_by: Uuid | null;
  created_at: Timestamp;
};

export type SiteSettings = {
  id: true;
  newsroom_address: string;
  newsroom_phone: string;
  newsroom_email: string;
  corrections_email: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
};

/** The subset of Supabase's auth.users that the newsroom reads. */
export type AuthUser = {
  id: Uuid;
  email: string;
  raw_user_meta_data: { full_name?: string };
  invited_at: Timestamp | null;
  last_sign_in_at: Timestamp | null;
  created_at: Timestamp;
};

export type Tables = {
  auth_users: AuthUser;
  profiles: Profile;
  categories: Category;
  tags: Tag;
  media: Media;
  articles: Article;
  article_tags: ArticleTag;
  front_page_pins: FrontPagePin;
  most_read_picks: MostReadPick;
  ad_campaigns: AdCampaign;
  site_settings: SiteSettings;
};

export type TableName = keyof Tables;

export type Database = { [T in TableName]: Tables[T][] };
