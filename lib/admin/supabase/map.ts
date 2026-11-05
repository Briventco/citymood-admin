import { docFromParagraphs, plainText, renderBodyHtml } from "../richtext";
import type { AdCampaign, AdSlot, Article, ArticleStatus, Media, StaffRole, Uuid } from "../types";

// The one place that translates between the live Supabase schema and the
// newsroom's types. The live schema predates the portal and the public site
// reads it, so columns keep their names (title, display_name, destination_url)
// and the differences are handled here.

export type ArticleRow = {
  id: Uuid;
  slug: string;
  title: string;
  standfirst: string;
  body: string;
  body_doc: Article["body"] | null;
  body_html: string;
  category_id: Uuid | null;
  author_id: Uuid | null;
  featured_image_id: Uuid | null;
  status: string;
  published_at: string | null;
  scheduled_for: string | null;
  featured: boolean;
  breaking: boolean;
  breaking_until: string | null;
  seo_title: string;
  seo_description: string;
  created_at: string;
  updated_at: string;
};

export type MediaRow = {
  id: Uuid;
  storage_path: string;
  width: number | null;
  height: number | null;
  alt_text: string;
  caption: string | null;
  credit: string | null;
  focal_x: number | null;
  focal_y: number | null;
  created_by: Uuid | null;
  created_at: string;
};

export type CampaignRow = {
  id: Uuid;
  name: string;
  slot: string;
  media_id: Uuid | null;
  image_mobile_id: Uuid | null;
  alt_text: string;
  destination_url: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_by: Uuid | null;
  created_at: string;
  updated_at: string;
};

/** articles.title can't be empty, but a draft can start without a headline. */
export const UNTITLED = "Untitled draft";

export const ARTICLE_COLUMNS =
  "id,slug,title,standfirst,body,body_doc,body_html,category_id,author_id,featured_image_id,status,published_at,scheduled_for,featured,breaking,breaking_until,seo_title,seo_description,created_at,updated_at";

// The portal has no review step (ADMIN_SPEC §1) and shows taken-down stories as
// Unpublished, so the two extra live statuses fold into the nearest one. The row
// keeps its real status until someone publishes or unpublishes it.
export function articleStatus(status: string): ArticleStatus {
  if (status === "in_review") return "draft";
  if (status === "archived") return "unpublished";
  return status as ArticleStatus;
}

export const dbStatuses = (status: ArticleStatus): string[] =>
  status === "draft" ? ["draft", "in_review"] : status === "unpublished" ? ["unpublished", "archived"] : [status];

export function toArticle(r: ArticleRow): Article {
  const status = articleStatus(r.status);
  const body = r.body_doc ?? docFromParagraphs(r.body.replace(/\r\n/g, "\n"));
  return {
    id: r.id,
    slug: r.slug,
    headline: status === "draft" && r.title === UNTITLED ? "" : r.title,
    standfirst: r.standfirst,
    body,
    body_html: r.body_html || renderBodyHtml(body),
    category_id: r.category_id,
    author_id: r.author_id,
    featured_image_id: r.featured_image_id,
    status,
    publish_at: r.status === "scheduled" ? r.scheduled_for : r.published_at,
    featured: r.featured,
    breaking: r.breaking,
    breaking_until: r.breaking_until,
    seo_title: r.seo_title,
    seo_description: r.seo_description,
    created_by: r.author_id,
    updated_by: null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** The columns a story body is stored in. `body` stays plain text for the public site. */
export function bodyColumns(doc: Article["body"]) {
  const text = plainText(doc);
  const words = text.split(/\s+/).filter(Boolean).length;
  return {
    body_doc: doc,
    body_html: renderBodyHtml(doc),
    body: text,
    reading_minutes: Math.max(1, Math.ceil(words / 200)),
  };
}

export function toMedia(r: MediaRow): Media {
  return {
    id: r.id,
    storage_path: r.storage_path,
    width: r.width,
    height: r.height,
    alt: r.alt_text,
    caption: r.caption ?? "",
    credit: r.credit ?? "",
    focal_x: r.focal_x === null ? 0.5 : Number(r.focal_x),
    focal_y: r.focal_y === null ? 0.5 : Number(r.focal_y),
    uploaded_by: r.created_by,
    created_at: r.created_at,
  };
}

export function toCampaign(r: CampaignRow): AdCampaign {
  // A campaign switched off in the old admin shows as ended when it was switched off.
  const ended = !r.active && Date.parse(r.updated_at) < Date.parse(r.ends_at) ? r.updated_at : r.ends_at;
  return {
    id: r.id,
    slot: (r.slot === "mpu" ? "mpu_1" : r.slot) as AdSlot,
    advertiser_name: r.name,
    image_desktop_id: r.media_id,
    image_mobile_id: r.image_mobile_id,
    link_url: r.destination_url,
    alt: r.alt_text,
    starts_at: r.starts_at,
    ends_at: ended,
    created_by: r.created_by,
    created_at: r.created_at,
  };
}

const DB_ROLE: Record<StaffRole, string> = { reporter: "reporter", editor: "editor", admin: "administrator" };
export const dbRole = (role: StaffRole) => DB_ROLE[role];

/**
 * Someone can hold several live roles, so the strongest wins. ad_manager has no
 * portal equivalent: it shows as Reporter, and the `ads` permission below is what
 * lets it run campaigns.
 */
export function staffRole(roles: readonly string[]): StaffRole | null {
  if (roles.includes("administrator")) return "admin";
  if (roles.includes("editor")) return "editor";
  if (roles.includes("reporter") || roles.includes("ad_manager")) return "reporter";
  return null;
}

/** Escapes a search term for a PostgREST or=() filter, where , ( ) and * have meaning. */
export const filterTerm = (term: string) => term.replace(/[%,()*"\\:]/g, " ").replace(/\s+/g, " ").trim();
