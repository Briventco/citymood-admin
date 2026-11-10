import "server-only";
import { randomUUID } from "node:crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { NewsroomError, forbidden, invalid, notFound } from "../errors";
import { permissionsFor } from "../repo";
import type {
  ArticleDetail,
  ArticleList,
  ArticleListQuery,
  ArticleSummary,
  ArticleWrite,
  CampaignItem,
  CampaignWrite,
  CategoryItem,
  Invite,
  MediaItem,
  NewsroomRepo,
  Permissions,
  StaffMember,
  TagItem,
} from "../repo";
import { normalizeDoc } from "../richtext";
import { isLive } from "../status";
import { isValidSlug, slugify } from "../text";
import {
  ARTICLE_STATUSES,
  STAFF_ROLES,
  TOP_SLOTS,
  type AdCampaign,
  type Article,
  type ArticleStatus,
  type Category,
  type FrontSlot,
  type Media,
  type StaffRole,
  type Tag,
  type Uuid,
} from "../types";
import {
  ARTICLE_COLUMNS,
  UNTITLED,
  bodyColumns,
  dbRole,
  dbStatuses,
  filterTerm,
  staffRole,
  toArticle,
  toCampaign,
  toMedia,
  type ArticleRow,
  type CampaignRow,
  type MediaRow,
} from "./map";

// NewsroomRepo on Supabase. `client` carries the signed-in user's session, so RLS
// and the triggers in supabase/migrations decide what is allowed. The role checks
// here only give a clear message: a write RLS refuses comes back as 0 rows, which
// would otherwise look like success. `service` bypasses RLS and is used only for
// auth.admin calls (invites, staff emails), after the admin check.

const HOUR = 3_600_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEDIA_COLUMNS = "id,storage_path,width,height,alt_text,caption,credit,focal_x,focal_y,created_by,created_at";
const SUMMARY_COLUMNS = `${ARTICLE_COLUMNS},category:categories(name,slug),author:profiles!articles_author_id_fkey(display_name)`;

type SummaryRow = ArticleRow & {
  category: { name: string; slug: string } | null;
  author: { display_name: string } | null;
};

/** A supabase-js filter builder. Its real type is too deep to pass through helpers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

/** A row whose shape comes from a column string. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

type ProfileRow = { id: Uuid; display_name: string; status: string; created_at: string; last_login_at: string | null };

export type RepoDeps = {
  client: SupabaseClient;
  uid: Uuid;
  email: string | null;
  /** Created on demand so ordinary requests never touch the secret key. */
  service: () => SupabaseClient;
  /** Where invite and reset links land, e.g. https://newsroom.citymood.ng/set-password. */
  setPasswordUrl: () => Promise<string>;
};

export type SupabaseRepo = NewsroomRepo & { permissions(): Promise<Permissions | null> };

/** Turns a database error into a sentence for staff. Anything unexpected is logged and hidden by staffAction. */
function raise(error: PostgrestError, messages: { conflict?: string; denied?: string; invalid?: string } = {}): never {
  if (error.code === "23505") throw new NewsroomError("conflict", messages.conflict ?? "That value is already in use.");
  // Raised by guard_article and guard_profile_status, whose messages are written for staff.
  if (error.code === "42501") {
    const custom = /^[A-Z].*\.$/.test(error.message) && !error.message.includes("row-level security");
    throw forbidden(custom ? error.message : messages.denied);
  }
  if (error.code === "23514" || error.code === "22P02") {
    throw invalid(messages.invalid ?? "Check the details and try again.");
  }
  throw error;
}

/**
 * Unwraps a query result, raising a staff-readable error on failure. Row shapes
 * come from column strings the client can't type, so callers narrow with map.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function must(result: { data: unknown; error: PostgrestError | null }, messages?: Parameters<typeof raise>[1]): any {
  if (result.error) raise(result.error, messages);
  return result.data;
}

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

function articleColumns(input: ArticleWrite): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.headline !== undefined) row.title = clean(input.headline) || UNTITLED;
  if (input.body !== undefined) Object.assign(row, bodyColumns(normalizeDoc(input.body)));
  if (input.slug !== undefined) {
    if (!isValidSlug(input.slug)) throw invalid("Use only lowercase letters, numbers and hyphens in the web address.");
    row.slug = input.slug;
  }
  for (const key of ["standfirst", "category_id", "author_id", "featured_image_id", "featured", "breaking", "seo_title", "seo_description"] as const) {
    if (input[key] !== undefined) row[key] = input[key];
  }
  return row;
}

function campaignColumns(input: Partial<CampaignWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.advertiser_name !== undefined) {
    row.name = input.advertiser_name.trim();
    if (!row.name) throw invalid("Enter the advertiser's name.");
  }
  if (input.alt !== undefined) {
    row.alt_text = input.alt.trim();
    if (!row.alt_text) throw invalid("Describe the advert for screen reader users (alt text).");
  }
  if (input.link_url !== undefined) row.destination_url = input.link_url.trim();
  if (input.slot !== undefined) row.slot = input.slot;
  if (input.image_desktop_id !== undefined) row.media_id = input.image_desktop_id;
  if (input.image_mobile_id !== undefined) row.image_mobile_id = input.image_mobile_id;
  if (input.starts_at !== undefined) row.starts_at = input.starts_at;
  if (input.ends_at !== undefined) row.ends_at = input.ends_at;
  return row;
}

const CAMPAIGN_MESSAGES = {
  denied: "Only admins can manage ad campaigns.",
  invalid: "Check the campaign: the link must start with https:// and it must end after it starts.",
};

export function createSupabaseRepo({ client, uid, email, service, setPasswordUrl }: RepoDeps): SupabaseRepo {
  // ───────────── Who is asking ─────────────

  type Session = { profile: ProfileRow; roles: string[]; role: StaffRole } | null;
  let session: Promise<Session> | undefined;

  const loadSession = async (): Promise<Session> => {
    const [profile, roles] = await Promise.all([
      client.from("profiles").select("id,display_name,status,created_at,last_login_at").eq("id", uid).maybeSingle(),
      client.from("user_roles").select("role_name").eq("user_id", uid),
    ]);
    if (profile.error) raise(profile.error);
    if (roles.error) raise(roles.error);
    const names = (roles.data ?? []).map((r) => r.role_name as string);
    const role = staffRole(names);
    if (!profile.data || profile.data.status !== "active" || !role) return null;
    return { profile: profile.data as ProfileRow, roles: names, role };
  };

  /** Every read and write starts here: no active profile, no access. */
  const staff = async () => {
    session ??= loadSession();
    const current = await session;
    if (!current) throw new NewsroomError("unauthenticated", "Please sign in again.");
    return current;
  };
  const editorOnly = async (message: string) => {
    const { role } = await staff();
    if (role === "reporter") throw forbidden(message);
  };
  const adminOnly = async (message: string) => {
    if ((await staff()).role !== "admin") throw forbidden(message);
  };
  const canEdit = (role: StaffRole, a: Pick<Article, "author_id">) => role !== "reporter" || a.author_id === uid;
  const canDelete = (role: StaffRole, a: { author_id: Uuid | null; status: string }) =>
    role !== "reporter" || (a.author_id === uid && a.status === "draft");

  // ───────────── Reads shared between methods ─────────────

  const mediaById = async (ids: (Uuid | null)[]) => {
    const wanted = [...new Set(ids.filter((id): id is Uuid => !!id))];
    if (wanted.length === 0) return new Map<Uuid, Media>();
    const rows = must(await client.from("article_media").select(MEDIA_COLUMNS).in("id", wanted));
    return new Map((rows as MediaRow[]).map((r) => [r.id, toMedia(r)]));
  };

  const articleRow = async (id: Uuid): Promise<ArticleRow> => {
    const row = must(await client.from("articles").select(ARTICLE_COLUMNS).eq("id", id).maybeSingle());
    if (!row) throw notFound("We couldn't find that story. It may have been deleted.");
    return row as unknown as ArticleRow;
  };

  const summarize = async (rows: SummaryRow[]): Promise<ArticleSummary[]> => {
    const { role } = await staff();
    const now = new Date();
    const media = await mediaById(rows.map((r) => r.featured_image_id));
    return rows.map((r) => {
      const a = toArticle(r);
      return {
        id: a.id,
        slug: a.slug,
        headline: a.headline || UNTITLED,
        status: a.status,
        publish_at: a.publish_at,
        updated_at: a.updated_at,
        created_at: a.created_at,
        featured: a.featured,
        breaking: a.breaking,
        breaking_until: a.breaking_until,
        category_id: a.category_id,
        author_id: a.author_id,
        category_name: r.category?.name ?? null,
        category_slug: r.category?.slug ?? null,
        author_name: r.author?.display_name || null,
        image: (a.featured_image_id && media.get(a.featured_image_id)) || null,
        live: isLive(a, now),
        can_edit: canEdit(role, a),
        can_delete: canDelete(role, r),
      };
    });
  };

  const detail = async (id: Uuid): Promise<ArticleDetail> => {
    const { role } = await staff();
    const row = await articleRow(id);
    const a = toArticle(row);
    const [links, media, category, author] = await Promise.all([
      client.from("article_tags").select("tags(id,name,slug)").eq("article_id", id),
      mediaById([a.featured_image_id]),
      a.category_id ? client.from("categories").select("id,name,slug,display_order,active").eq("id", a.category_id).maybeSingle() : null,
      a.author_id ? client.from("profiles").select("id,display_name").eq("id", a.author_id).maybeSingle() : null,
    ]);
    const tags = (must(links) as unknown as { tags: Tag | null }[])
      .flatMap((l) => (l.tags ? [l.tags] : []))
      .sort((x, y) => x.name.localeCompare(y.name));
    return {
      article: a,
      tags,
      image: (a.featured_image_id && media.get(a.featured_image_id)) || null,
      category: category?.data ? toCategory(category.data) : null,
      author: author?.data ? { id: author.data.id, full_name: author.data.display_name } : null,
      live: isLive(a, new Date()),
      can_edit: canEdit(role, a),
      can_delete: canDelete(role, row),
    };
  };

  /** Stories readers can see: published, or scheduled and past their time (the cron job flips those). */
  const liveFilter = (now: string) => `status.eq.published,and(status.eq.scheduled,scheduled_for.lte."${now}")`;

  /** Article ids whose author or tags match, for the list search. */
  const searchMatches = async (term: string) => {
    const [authors, tags] = await Promise.all([
      client.from("profiles").select("id").ilike("display_name", `%${term}%`),
      client.from("tags").select("id").ilike("name", `%${term}%`),
    ]);
    const tagIds = (must(tags) ?? []).map((t: Row) => t.id as string);
    const links = tagIds.length ? must(await client.from("article_tags").select("article_id").in("tag_id", tagIds)) : [];
    return {
      authorIds: (must(authors) ?? []).map((p: Row) => p.id as string),
      articleIds: [...new Set((links ?? []).map((l: Row) => l.article_id as string))],
    };
  };

  // ───────────── Writes shared between methods ─────────────

  const setTags = async (articleId: Uuid, names: string[]) => {
    const wanted = new Map<string, string>();
    for (const raw of names) {
      const name = clean(raw).slice(0, 60);
      const slug = slugify(name);
      if (name && slug && slug !== "breaking") wanted.set(slug, name);
    }
    const slugs = [...wanted.keys()];
    const existing = slugs.length ? (must(await client.from("tags").select("id,slug").in("slug", slugs)) ?? []) : [];
    const known = new Map(existing.map((t: Row) => [t.slug as string, t.id as string]));
    const missing = slugs.filter((s) => !known.has(s)).map((slug) => ({ slug, name: wanted.get(slug)! }));
    if (missing.length) {
      const created = must(await client.from("tags").insert(missing).select("id,slug"), { conflict: "That tag already exists under a different spelling." });
      for (const t of created ?? []) known.set(t.slug as string, t.id as string);
    }
    must(await client.from("article_tags").delete().eq("article_id", articleId).select("tag_id"));
    if (known.size) {
      must(await client.from("article_tags").insert([...known.values()].map((tag_id) => ({ article_id: articleId, tag_id }))).select("tag_id"));
    }
  };

  /** Keeps the version readers saw, so an edit to a live story can be recovered. */
  const snapshot = async (row: ArticleRow, tagIds: Uuid[]) => {
    const last = must(
      await client.from("article_revisions").select("revision_number").eq("article_id", row.id)
        .order("revision_number", { ascending: false }).limit(1).maybeSingle(),
    );
    must(await client.from("article_revisions").insert({
      article_id: row.id,
      revision_number: (last?.revision_number ?? 0) + 1,
      title: row.title,
      standfirst: row.standfirst,
      body: row.body,
      author_id: row.author_id,
      category_id: row.category_id,
      editor_id: uid,
      tag_ids: tagIds,
      change_summary: "Snapshot before article update",
    }).select("id"));
  };

  const updateRow = async (id: Uuid, columns: Record<string, unknown>) => {
    const rows = must(await client.from("articles").update(columns).eq("id", id).select("id"), {
      denied: "You can only edit your own stories.",
      invalid: "Check the story's details and try again.",
    });
    if (!rows?.length) throw forbidden("You can only edit your own stories.");
  };

  /**
   * Keeps article_media.article_id populated for unlinked library photos so the
   * deployed public site's embedded article_media(...) query still shows them.
   */
  const syncMediaLink = async (articleId: Uuid, nextMediaId: Uuid | null, prevMediaId: Uuid | null) => {
    if (prevMediaId && prevMediaId !== nextMediaId) {
      await client.from("article_media").update({ article_id: null }).eq("id", prevMediaId).eq("article_id", articleId);
    }
    if (nextMediaId) {
      await client.from("article_media").update({ article_id: articleId }).eq("id", nextMediaId).is("article_id", null);
    }
  };

  const audit = async (action: string, entityId: Uuid, after: Record<string, unknown>) => {
    const { error } = await client.from("audit_log").insert({
      actor_id: uid, action, entity_type: "user", entity_id: entityId, after_data: after,
    });
    if (error) console.error("Audit log write failed", { code: error.code, action });
  };

  const staffMembers = async (): Promise<StaffMember[]> => {
    const [profiles, roles, users] = await Promise.all([
      client.from("profiles").select("id,display_name,status,created_at,last_login_at"),
      client.from("user_roles").select("user_id,role_name"),
      service().auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (users.error) throw users.error;
    const auth = new Map(users.data.users.map((u) => [u.id, u]));
    const held = new Map<Uuid, string[]>();
    for (const r of must(roles) ?? []) held.set(r.user_id, [...(held.get(r.user_id) ?? []), r.role_name]);
    return (must(profiles) as ProfileRow[]).map((p) => {
      const user = auth.get(p.id);
      return {
        id: p.id,
        full_name: p.display_name,
        role: staffRole(held.get(p.id) ?? []) ?? "reporter",
        is_active: p.status === "active",
        created_at: p.created_at,
        email: user?.email ?? "",
        invited_at: user?.invited_at ?? null,
        last_sign_in_at: user?.last_sign_in_at ?? p.last_login_at,
      };
    });
  };

  const assertAnotherAdmin = async (id: Uuid) => {
    const others = (await staffMembers()).filter((m) => m.id !== id && m.role === "admin" && m.is_active);
    if (others.length === 0) throw invalid("The newsroom needs at least one active admin.");
  };

  const assertLive = async (id: Uuid) => {
    if (!isLive(toArticle(await articleRow(id)), new Date())) {
      throw invalid("Only live stories can be pinned to the front page.");
    }
  };

  const campaignItems = async (rows: CampaignRow[]): Promise<CampaignItem[]> => {
    const campaigns = rows.map(toCampaign);
    const media = await mediaById(campaigns.flatMap((c) => [c.image_desktop_id, c.image_mobile_id]));
    const pick = (id: Uuid | null) => (id && media.get(id)) || null;
    return campaigns.map((c) => ({ ...c, desktop: pick(c.image_desktop_id), mobile: pick(c.image_mobile_id) }));
  };

  const mediaItems = async (rows: MediaRow[]): Promise<MediaItem[]> => {
    const { role } = await staff();
    const ids = rows.map((r) => r.id);
    const uploaders = [...new Set(rows.flatMap((r) => (r.created_by ? [r.created_by] : [])))];
    const [names, articles, campaigns] = await Promise.all([
      uploaders.length ? client.from("profiles").select("id,display_name").in("id", uploaders) : null,
      ids.length ? client.from("articles").select("featured_image_id").in("featured_image_id", ids) : null,
      ids.length ? client.from("ad_campaigns").select("media_id,image_mobile_id") : null,
    ]);
    const uploader = new Map((names?.data ?? []).map((p) => [p.id as string, p.display_name as string]));
    const uses = new Map<Uuid, number>();
    const count = (id: Uuid | null) => id && uses.set(id, (uses.get(id) ?? 0) + 1);
    for (const a of articles?.data ?? []) count(a.featured_image_id);
    for (const c of campaigns?.data ?? []) {
      count(c.media_id);
      if (c.image_mobile_id !== c.media_id) count(c.image_mobile_id);
    }
    return rows.map((r) => ({
      ...toMedia(r),
      uploader_name: (r.created_by && uploader.get(r.created_by)) || null,
      used_by: uses.get(r.id) ?? 0,
      can_edit: role !== "reporter" || r.created_by === uid,
    }));
  };

  return {
    async permissions() {
      const current = await (session ??= loadSession());
      if (!current) return null;
      const can = permissionsFor(current.role);
      return { ...can, ads: can.admin || current.roles.includes("ad_manager") };
    },

    async me() {
      const current = await (session ??= loadSession());
      if (!current) return null;
      const { profile, role } = current;
      return {
        id: profile.id,
        full_name: profile.display_name,
        role,
        is_active: true,
        created_at: profile.created_at,
        email: email ?? "",
        invited_at: null,
        last_sign_in_at: profile.last_login_at,
      };
    },

    // ───────────── Articles ─────────────

    async listArticles(q: ArticleListQuery): Promise<ArticleList> {
      await staff();
      const now = new Date().toISOString();
      const term = filterTerm(q.search ?? "");
      const matches = term ? await searchMatches(term) : null;

      // Applied to the page query and every tab count, so the tabs always agree with the list.
      const filtered = (query: Query): Query => {
        let next = query;
        if (q.categoryId) next = next.eq("category_id", q.categoryId);
        if (q.authorId) next = next.eq("author_id", q.authorId);
        if (matches) {
          const clauses = [`title.ilike.%${term}%`];
          if (matches.authorIds.length) clauses.push(`author_id.in.(${matches.authorIds.join(",")})`);
          if (matches.articleIds.length) clauses.push(`id.in.(${matches.articleIds.join(",")})`);
          next = next.or(clauses.join(","));
        }
        return next;
      };
      const statusFilter = (query: Query, status: ArticleStatus): Query => {
        if (status === "published") return query.or(liveFilter(now));
        if (status === "scheduled") return query.eq("status", "scheduled").gt("scheduled_for", now);
        return query.in("status", dbStatuses(status));
      };

      const countFor = async (status: ArticleStatus | "all") => {
        const base = filtered(client.from("articles").select("id", { count: "exact", head: true }));
        const { count, error } = await (status === "all" ? base : statusFilter(base, status));
        if (error) raise(error);
        return count ?? 0;
      };
      const statuses = ["all", ...ARTICLE_STATUSES] as const;
      const totals = await Promise.all(statuses.map(countFor));
      const counts = Object.fromEntries(statuses.map((s, i) => [s, totals[i]])) as Record<ArticleStatus | "all", number>;

      const status = q.status ?? "all";
      const total = counts[status];
      const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
      const page = Math.min(Math.max(q.page ?? 1, 1), Math.max(1, Math.ceil(total / pageSize)));
      const base = filtered(client.from("articles").select(SUMMARY_COLUMNS));
      const rows = must(
        await (status === "all" ? base : statusFilter(base, status))
          .order("updated_at", { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1),
      );
      return { items: await summarize(rows as unknown as SummaryRow[]), total, page, pageSize, counts };
    },

    async getArticle(id) {
      await staff();
      const found = must(await client.from("articles").select("id").eq("id", id).maybeSingle());
      return found ? detail(id) : null;
    },

    async createArticle(input) {
      await staff();
      const { author_id: byline, ...columns } = articleColumns(input);
      const base = (columns.slug as string) || slugify(input.headline ?? "") || `draft-${randomUUID().slice(0, 8)}`;
      // RLS hides other reporters' drafts, so a taken slug only shows up on insert.
      for (let attempt = 1; ; attempt++) {
        const slug = attempt === 1 ? base : attempt < 20 ? `${base}-${attempt}` : `${base}-${randomUUID().slice(0, 8)}`;
        const { data, error } = await client
          .from("articles")
          .insert({ title: UNTITLED, ...columns, slug, author_id: uid, status: "draft" })
          .select("id")
          .single();
        if (error?.code === "23505" && attempt < 20) continue;
        if (error) raise(error, { denied: "You don't have permission to create stories." });
        // The insert policy requires your own byline, so an editor's chosen byline follows.
        if (typeof byline === "string" && byline !== uid) await updateRow(data.id, { author_id: byline });
        if (typeof columns.featured_image_id === "string") {
          await syncMediaLink(data.id, columns.featured_image_id, null);
        }
        if (input.tags) await setTags(data.id, input.tags);
        return detail(data.id);
      }
    },

    async updateArticle(id, input) {
      const { role } = await staff();
      const current = await articleRow(id);
      if (!canEdit(role, toArticle(current))) throw forbidden("You can only edit your own stories.");
      const columns = articleColumns(input);
      if (columns.slug !== undefined && columns.slug !== current.slug && ["published", "scheduled"].includes(current.status)) {
        throw invalid("The web address cannot change after publishing.");
      }
      if (current.status === "published" && Object.keys(columns).some((k) => ["title", "standfirst", "body"].includes(k))) {
        const links = must(await client.from("article_tags").select("tag_id").eq("article_id", id));
        await snapshot(current, (links ?? []).map((l: Row) => l.tag_id as string));
      }
      if (Object.keys(columns).length) {
        const { error } = await client.from("articles").update(columns).eq("id", id);
        if (error) raise(error, { conflict: "That web address is already taken. Choose another.", denied: "You can only edit your own stories." });
      }
      const nextMediaId =
        columns.featured_image_id !== undefined ? ((columns.featured_image_id as Uuid | null) ?? null) : current.featured_image_id;
      if (columns.featured_image_id !== undefined || nextMediaId) {
        await syncMediaLink(id, nextMediaId, current.featured_image_id);
      }
      if (input.tags) await setTags(id, input.tags);
      return detail(id);
    },

    async publishArticle(id, publishAt) {
      await staff();
      const row = await articleRow(id);
      const a = toArticle(row);
      const image = (await mediaById([a.featured_image_id])).get(a.featured_image_id ?? "");
      const missing = [
        !a.headline.trim() && "a headline",
        !a.category_id && "a category",
        image && !image.alt.trim() && "alt text for the photo",
      ].filter(Boolean);
      if (missing.length) throw invalid(`Add ${missing.join(" and ")} before publishing.`);

      const now = new Date();
      const columns: Record<string, unknown> = publishAt === null
        ? { status: "published", published_at: now.toISOString(), scheduled_for: null, unpublished_at: null }
        : { status: "scheduled", scheduled_for: publishAt, published_at: null, unpublished_at: null };
      if (publishAt !== null && !(Date.parse(publishAt) > now.getTime())) throw invalid("Pick a time in the future, or publish now.");
      // Breaking runs for 6 hours from go-live, so restart the window (the trigger fills it in).
      if (a.breaking) columns.breaking_until = null;
      await updateRow(id, columns);
      if (a.featured_image_id) await syncMediaLink(id, a.featured_image_id, a.featured_image_id);
      return detail(id);
    },

    async unpublishArticle(id) {
      await staff();
      const a = toArticle(await articleRow(id));
      if (isLive(a, new Date())) await updateRow(id, { status: "unpublished", unpublished_at: new Date().toISOString() });
      else if (a.status === "scheduled") await updateRow(id, { status: "draft", scheduled_for: null });
      return detail(id);
    },

    async deleteArticle(id) {
      const { role } = await staff();
      const row = await articleRow(id);
      if (!canDelete(role, row)) throw forbidden("Reporters can delete only their own drafts. Ask an editor.");
      await client.from("article_media").update({ article_id: null }).eq("article_id", id);
      const gone = must(await client.from("articles").delete().eq("id", id).select("id"));
      if (!gone?.length) throw forbidden("Reporters can delete only their own drafts. Ask an editor.");
    },

    async deleteArticles(ids) {
      const { role } = await staff();
      const unique = [...new Set(ids)];
      if (unique.length === 0) return 0;
      const rows = must(await client.from("articles").select("id,author_id,status").in("id", unique)) as Pick<
        ArticleRow,
        "id" | "author_id" | "status"
      >[];
      if (rows.length === 0) return 0;
      for (const r of rows) {
        if (!canDelete(role, r)) throw forbidden("Reporters can delete only their own drafts. Ask an editor.");
      }
      const targetIds = rows.map((r) => r.id);
      await client.from("article_media").update({ article_id: null }).in("article_id", targetIds);
      const gone = must(await client.from("articles").delete().in("id", targetIds).select("id"));
      if (!gone || gone.length !== targetIds.length) {
        throw forbidden("Reporters can delete only their own drafts. Ask an editor.");
      }
      return gone.length;
    },

    async searchLiveArticles(search, limit = 20) {
      await staff();
      const term = filterTerm(search);
      let query = client.from("articles").select(SUMMARY_COLUMNS).or(liveFilter(new Date().toISOString()));
      if (term) query = query.ilike("title", `%${term}%`);
      const rows = must(await query.order("published_at", { ascending: false, nullsFirst: false }).limit(limit));
      return summarize(rows as unknown as SummaryRow[]);
    },

    async listBreaking() {
      await staff();
      const now = new Date().toISOString();
      const rows = must(
        await client.from("articles").select(SUMMARY_COLUMNS).or(liveFilter(now))
          .eq("breaking", true).gt("breaking_until", now)
          .order("published_at", { ascending: false, nullsFirst: false }),
      );
      return summarize(rows as unknown as SummaryRow[]);
    },

    async extendBreaking(id, hours) {
      await staff();
      const a = toArticle(await articleRow(id));
      const from = Math.max(Date.now(), a.breaking_until ? Date.parse(a.breaking_until) : 0);
      await updateRow(id, { breaking: true, breaking_until: new Date(from + hours * HOUR).toISOString() });
    },

    async endBreaking(id) {
      await staff();
      await updateRow(id, { breaking: false });
    },

    async authors() {
      await staff();
      const [profiles, roles] = await Promise.all([
        client.from("profiles").select("id,display_name").order("display_name"),
        client.from("user_roles").select("user_id,role_name"),
      ]);
      const held = new Map<Uuid, string[]>();
      for (const r of must(roles) ?? []) held.set(r.user_id, [...(held.get(r.user_id) ?? []), r.role_name]);
      return (must(profiles) ?? []).flatMap((p: Row) => {
        const role = staffRole(held.get(p.id) ?? []);
        return role ? [{ id: p.id as string, full_name: p.display_name as string, role }] : [];
      });
    },

    // ───────────── Media ─────────────

    async listMedia(search) {
      await staff();
      const term = filterTerm(search ?? "");
      let query = client.from("article_media").select(MEDIA_COLUMNS);
      if (term) query = query.or(`alt_text.ilike.%${term}%,caption.ilike.%${term}%,credit.ilike.%${term}%`);
      const rows = must(await query.order("created_at", { ascending: false }).limit(500));
      return mediaItems(rows as MediaRow[]);
    },

    async getMedia(id) {
      await staff();
      const row = must(await client.from("article_media").select(MEDIA_COLUMNS).eq("id", id).maybeSingle());
      return row ? (await mediaItems([row as MediaRow]))[0] : null;
    },

    async createMedia(input) {
      await staff();
      const row = must(
        await client.from("article_media").insert({
          storage_path: input.storage_path,
          mime_type: input.mime_type,
          byte_size: input.byte_size,
          width: input.width,
          height: input.height,
          alt_text: input.alt?.trim() ?? "",
          caption: input.caption?.trim() || null,
          credit: input.credit?.trim() || null,
          created_by: uid,
        }).select(MEDIA_COLUMNS).single(),
        { denied: "You don't have permission to upload photos." },
      );
      return toMedia(row as MediaRow);
    },

    async updateMedia(id, input) {
      await staff();
      if (!must(await client.from("article_media").select("id").eq("id", id).maybeSingle())) throw notFound("We couldn't find that photo.");
      const columns: Record<string, unknown> = {};
      if (input.alt !== undefined) columns.alt_text = input.alt.trim().slice(0, 300);
      if (input.caption !== undefined) columns.caption = input.caption.trim().slice(0, 500) || null;
      if (input.credit !== undefined) columns.credit = input.credit.trim().slice(0, 120) || null;
      if (input.focal_x !== undefined) columns.focal_x = input.focal_x;
      if (input.focal_y !== undefined) columns.focal_y = input.focal_y;
      const rows = must(await client.from("article_media").update(columns).eq("id", id).select(MEDIA_COLUMNS));
      if (!rows?.length) throw forbidden("Only the person who uploaded this photo, or an editor, can change its details.");
      return toMedia(rows[0] as MediaRow);
    },

    async deleteMedia(id) {
      await editorOnly("Only editors can delete photos.");
      if (!must(await client.from("article_media").select("id").eq("id", id).maybeSingle())) throw notFound("We couldn't find that photo.");
      const rows = must(await client.from("article_media").delete().eq("id", id).select(MEDIA_COLUMNS));
      if (!rows?.length) throw forbidden("Only editors can delete photos.");
      return toMedia(rows[0] as MediaRow);
    },

    // ───────────── Categories and tags ─────────────

    async listCategories(): Promise<CategoryItem[]> {
      await staff();
      const rows = must(await client.from("categories").select("id,name,slug,display_order,active,articles(count)").order("display_order"));
      return (rows as unknown as (CategoryRow & { articles: { count: number }[] })[]).map((c) => ({
        ...toCategory(c),
        article_count: c.articles[0]?.count ?? 0,
      }));
    },

    async createCategory(name) {
      await adminOnly("Only admins can change categories.");
      const label = clean(name);
      const slug = slugify(label);
      if (!label || !slug) throw invalid("Enter a category name.");
      const last = must(await client.from("categories").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle());
      const row = must(
        await client.from("categories")
          .insert({ name: label, slug, short_name: label.split(" ")[0], display_order: (last?.display_order ?? 0) + 1 })
          .select("id,name,slug,display_order,active").single(),
        { conflict: "A category with that name already exists.", denied: "Only admins can change categories." },
      );
      return toCategory(row as CategoryRow);
    },

    async updateCategory(id, input) {
      await adminOnly("Only admins can change categories.");
      const columns: Record<string, unknown> = {};
      if (input.name !== undefined) {
        columns.name = clean(input.name);
        if (!columns.name) throw invalid("Enter a category name.");
      }
      if (input.is_active !== undefined) columns.active = input.is_active;
      const rows = must(await client.from("categories").update(columns).eq("id", id).select("id,name,slug,display_order,active"));
      if (!rows?.length) throw notFound("We couldn't find that category.");
      return toCategory(rows[0] as CategoryRow);
    },

    async moveCategory(id, direction) {
      await adminOnly("Only admins can change categories.");
      const list = must(await client.from("categories").select("id").order("display_order")) ?? [];
      const i = list.findIndex((c: Row) => c.id === id);
      const j = i + direction;
      if (i < 0) throw notFound("We couldn't find that category.");
      if (j < 0 || j >= list.length) return;
      // Renumber so positions stay distinct, then swap the pair.
      const order = list.map((c: Row) => c.id as string);
      [order[i], order[j]] = [order[j], order[i]];
      await Promise.all(order.map(async (categoryId: string, index: number) => {
        must(await client.from("categories").update({ display_order: index + 1 }).eq("id", categoryId).select("id"));
      }));
    },

    async listTags(): Promise<TagItem[]> {
      await staff();
      const rows = must(await client.from("tags").select("id,name,slug,article_tags(count)").order("name"));
      return (rows as unknown as (Tag & { article_tags: { count: number }[] })[]).map(({ article_tags, ...t }) => ({
        ...t,
        article_count: article_tags[0]?.count ?? 0,
      }));
    },

    async renameTag(id, name) {
      await editorOnly("Only editors can rename tags.");
      const label = clean(name);
      const slug = slugify(label);
      if (!label || !slug) throw invalid("Enter a tag name.");
      const rows = must(
        await client.from("tags").update({ name: label, slug }).eq("id", id).select("id,name,slug"),
        { conflict: "A tag with that name already exists. Merge the two instead.", denied: "Only editors can rename tags." },
      );
      if (!rows?.length) throw notFound("We couldn't find that tag.");
      return rows[0] as Tag;
    },

    async mergeTags(fromId, intoId) {
      await editorOnly("Only editors can merge tags.");
      if (fromId === intoId) throw invalid("Pick a different tag to merge into.");
      const found = must(await client.from("tags").select("id").in("id", [fromId, intoId]));
      if (found?.length !== 2) throw notFound("We couldn't find one of those tags.");
      const links = must(await client.from("article_tags").select("article_id").eq("tag_id", fromId)) ?? [];
      if (links.length) {
        must(await client.from("article_tags").upsert(
          links.map((l: Row) => ({ article_id: l.article_id, tag_id: intoId })),
          { onConflict: "article_id,tag_id", ignoreDuplicates: true },
        ).select("tag_id"));
      }
      const gone = must(await client.from("tags").delete().eq("id", fromId).select("id"));
      if (!gone?.length) throw forbidden("Only editors can merge tags.");
    },

    async deleteTag(id) {
      await editorOnly("Only editors can delete tags.");
      const gone = must(await client.from("tags").delete().eq("id", id).select("id"));
      if (!gone?.length) throw notFound("We couldn't find that tag.");
    },

    // ───────────── Staff (admins; auth calls use the service role) ─────────────

    async listStaff() {
      await adminOnly("Only admins can manage staff.");
      const members = await staffMembers();
      return members.sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.full_name.localeCompare(b.full_name));
    },

    async inviteStaff(invite: Invite) {
      await adminOnly("Only admins can invite staff.");
      const address = invite.email.trim().toLowerCase();
      const full_name = clean(invite.full_name);
      if (!EMAIL.test(address)) throw invalid("Enter a valid email address.");
      if (!full_name) throw invalid("Enter the person's name, as it should appear in bylines.");
      if (!STAFF_ROLES.includes(invite.role)) throw invalid("Pick a role.");

      const admin = service();
      const { data, error } = await admin.auth.admin.inviteUserByEmail(address, {
        data: { full_name },
        redirectTo: await setPasswordUrl(),
      });
      if (error || !data.user) {
        console.error("Supabase invitation failed", { code: error?.code, status: error?.status });
        throw new NewsroomError("conflict", "That invitation couldn't be sent. They may already have an account.");
      }
      const id = data.user.id;
      must(await admin.from("profiles").update({ display_name: full_name, status: "active" }).eq("id", id).select("id"));
      must(await admin.from("user_roles").insert({ user_id: id, role_name: dbRole(invite.role) }).select("user_id"));
      await audit("invite", id, { email: address, role: invite.role });
      return {
        id, full_name, role: invite.role, is_active: true, created_at: data.user.created_at,
        email: address, invited_at: data.user.invited_at ?? null, last_sign_in_at: null,
      };
    },

    async resendInvite(id) {
      await adminOnly("Only admins can invite staff.");
      const admin = service();
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data.user?.email) throw notFound("We couldn't find that person.");
      if (data.user.last_sign_in_at) throw invalid("They have already joined.");
      const sent = await admin.auth.admin.inviteUserByEmail(data.user.email, { redirectTo: await setPasswordUrl() });
      if (sent.error) throw invalid("That invitation couldn't be sent. Try again in a minute.");
    },

    async updateStaff(id, input) {
      await adminOnly("Only admins can manage staff.");
      const target = (await staffMembers()).find((m) => m.id === id);
      if (!target) throw notFound("We couldn't find that person.");
      if (id === uid && input.role !== undefined && input.role !== target.role) throw invalid("You can't change your own role. Ask another admin.");
      if (id === uid && input.is_active === false) throw invalid("You can't remove yourself. Ask another admin.");
      if (input.role !== undefined && !STAFF_ROLES.includes(input.role)) throw invalid("Pick a role.");
      const losesAdmin = target.role === "admin" && ((input.role !== undefined && input.role !== "admin") || input.is_active === false);
      if (losesAdmin) await assertAnotherAdmin(id);

      const columns: Record<string, unknown> = {};
      if (input.is_active !== undefined) columns.status = input.is_active ? "active" : "suspended";
      if (input.full_name !== undefined) {
        columns.display_name = clean(input.full_name);
        if (!columns.display_name) throw invalid("Enter the person's name.");
      }
      if (Object.keys(columns).length) {
        const rows = must(await client.from("profiles").update(columns).eq("id", id).select("id"), { denied: "Only admins can manage staff." });
        if (!rows?.length) throw forbidden("Only admins can manage staff.");
      }
      if (input.role !== undefined && input.role !== target.role) {
        must(await client.from("user_roles").delete().eq("user_id", id).select("user_id"));
        must(await client.from("user_roles").insert({ user_id: id, role_name: dbRole(input.role) }).select("user_id"));
      }
      await audit("staff_update", id, { ...input });
      const updated = (await staffMembers()).find((m) => m.id === id);
      if (!updated) throw notFound("We couldn't find that person.");
      return updated;
    },

    // ───────────── Front page ─────────────

    async getFrontPage() {
      await staff();
      const [pins, picks] = await Promise.all([
        client.from("front_page_pins").select("slot,article_id,pinned_by,pinned_at"),
        client.from("most_read_picks").select("position,article_id").order("position"),
      ]);
      const rows = must(pins) ?? [];
      const pinners = [...new Set(rows.flatMap((p: Row) => (p.pinned_by ? [p.pinned_by as string] : [])))];
      const names = pinners.length ? must(await client.from("profiles").select("id,display_name").in("id", pinners)) : [];
      const byId = new Map((names ?? []).map((p: Row) => [p.id as string, p.display_name as string]));
      return {
        pins: rows.map((p: Row) => ({ ...p, slot: p.slot as FrontSlot, pinned_by_name: (p.pinned_by && byId.get(p.pinned_by)) || null })),
        picks: must(picks) ?? [],
      };
    },

    async setPin(slot, articleId) {
      const message = "Only editors can change the front page.";
      await editorOnly(message);
      if (articleId) await assertLive(articleId);
      must(await client.from("front_page_pins").delete().eq("slot", slot).select("slot"), { denied: message });
      if (!articleId) return;
      must(await client.from("front_page_pins").delete().eq("article_id", articleId).select("slot"), { denied: message });
      must(await client.from("front_page_pins").insert({ slot, article_id: articleId, pinned_by: uid }).select("slot"), { denied: message });
    },

    async arrangeTopStories(articleIds) {
      const message = "Only editors can change the front page.";
      await editorOnly(message);
      if (articleIds.length !== TOP_SLOTS.length) throw invalid("There are four top story slots.");
      const ids = articleIds.filter((x): x is Uuid => x !== null);
      if (new Set(ids).size !== ids.length) throw invalid("A story can fill only one slot.");
      await Promise.all(ids.map(assertLive));
      must(await client.from("front_page_pins").delete().in("slot", [...TOP_SLOTS]).select("slot"), { denied: message });
      if (ids.length) must(await client.from("front_page_pins").delete().in("article_id", ids).select("slot"), { denied: message });
      const rows = articleIds.flatMap((article_id, i) => (article_id ? [{ slot: TOP_SLOTS[i], article_id, pinned_by: uid }] : []));
      if (rows.length) must(await client.from("front_page_pins").insert(rows).select("slot"), { denied: message });
    },

    async setMostRead(articleIds) {
      const message = "Only editors can change Most read.";
      await editorOnly(message);
      if (articleIds.length > 5) throw invalid("Most read holds up to 5 stories.");
      if (new Set(articleIds).size !== articleIds.length) throw invalid("That story is already in the list.");
      await Promise.all(articleIds.map(articleRow));
      must(await client.from("most_read_picks").delete().gte("position", 1).select("position"), { denied: message });
      if (articleIds.length) {
        must(await client.from("most_read_picks").insert(articleIds.map((article_id, i) => ({ position: i + 1, article_id }))).select("position"), { denied: message });
      }
    },

    // ───────────── Ads ─────────────

    async listCampaigns() {
      await staff();
      const rows = must(await client.from("ad_campaigns").select("*").order("starts_at", { ascending: false }));
      return campaignItems(rows as CampaignRow[]);
    },

    async getCampaign(id) {
      await staff();
      const row = must(await client.from("ad_campaigns").select("*").eq("id", id).maybeSingle());
      return row ? (await campaignItems([row as CampaignRow]))[0] : null;
    },

    async createCampaign(input): Promise<AdCampaign> {
      await staff();
      const row = must(
        await client.from("ad_campaigns").insert({ ...campaignColumns(input), created_by: uid }).select("*").single(),
        CAMPAIGN_MESSAGES,
      );
      return toCampaign(row as CampaignRow);
    },

    async updateCampaign(id, input): Promise<AdCampaign> {
      await staff();
      const rows = must(await client.from("ad_campaigns").update(campaignColumns(input)).eq("id", id).select("*"), CAMPAIGN_MESSAGES);
      if (!rows?.length) throw forbidden(CAMPAIGN_MESSAGES.denied);
      return toCampaign(rows[0] as CampaignRow);
    },

    async deleteCampaign(id) {
      await staff();
      const gone = must(await client.from("ad_campaigns").delete().eq("id", id).select("id"));
      if (!gone?.length) throw forbidden(CAMPAIGN_MESSAGES.denied);
    },

    // ───────────── Site settings ─────────────

    async getSettings() {
      await staff();
      return must(await client.from("site_settings").select("*").single());
    },

    async updateSettings(input) {
      await staff();
      const current = must(await client.from("site_settings").select("*").single()) as Record<string, unknown>;
      const columns: Record<string, string> = {};
      for (const [key, value] of Object.entries(input)) {
        if (key === "id" || typeof value !== "string") continue;
        const v = value.trim();
        if (current[key] === v) continue;
        if (key.endsWith("_url") && v && !/^https:\/\//i.test(v)) throw invalid("Social links must start with https://.");
        if (key.endsWith("_email") && v && !EMAIL.test(v)) throw invalid("Check the email addresses.");
        columns[key] = v;
      }
      if (Object.keys(columns).length === 0) return current as never;
      const rows = must(await client.from("site_settings").update(columns).eq("id", true).select("*"));
      if (!rows?.length) throw forbidden("Only admins can change site settings.");
      return rows[0];
    },
  };
}

type CategoryRow = { id: Uuid; name: string; slug: string; display_order: number; active: boolean };

function toCategory(c: CategoryRow): Category {
  return { id: c.id, name: c.name, slug: c.slug, position: c.display_order, is_active: c.active };
}
