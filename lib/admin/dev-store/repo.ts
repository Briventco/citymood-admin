import { randomUUID } from "node:crypto";
import { NewsroomError, forbidden, invalid, isNewsroomError, notFound } from "../errors";
import type {
  ArticleDetail,
  ArticleList,
  ArticleListQuery,
  ArticleSummary,
  ArticleWrite,
  CampaignItem,
  CampaignWrite,
  Invite,
  MediaItem,
  NewsroomPublicReader,
  NewsroomRepo,
  StaffMember,
} from "../repo";
import { normalizeDoc, renderBodyHtml } from "../richtext";
import { effectiveStatus, isBreakingNow, isLive } from "../status";
import { isValidSlug, slugify } from "../text";
import {
  ARTICLE_STATUSES,
  STAFF_ROLES,
  TOP_SLOTS,
  type AdCampaign,
  type Article,
  type ArticleStatus,
  type Database,
  type FrontSlot,
  type Media,
  type Profile,
  type Uuid,
} from "../types";
import { ANON, DevDatabase, SERVICE, type Actor } from "./database";
import type { DevStore } from "./store";

// NewsroomRepo on the dev store. Every method opens the database as the signed-in
// user, so the policies and triggers in ./policies.ts and ./triggers.ts decide
// what is allowed, exactly where RLS will decide it in Supabase. This file only
// shapes queries and turns "0 rows affected" into a clear message.

const HOUR = 3_600_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDITABLE_FIELDS = [
  "slug", "headline", "standfirst", "body", "category_id", "author_id",
  "featured_image_id", "featured", "breaking", "seo_title", "seo_description",
] as const;

/** Re-labels a generic RLS refusal with a message that fits the screen. */
async function explain<T>(message: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isNewsroomError(e) && e.code === "forbidden" && e.message.startsWith("You don't have permission")) {
      throw forbidden(message);
    }
    throw e;
  }
}

function summarize(db: DevDatabase, articles: Article[]): ArticleSummary[] {
  const now = db.now();
  const role = db.myRole();
  const uid = db.uid();
  const categories = new Map(db.select("categories").map((c) => [c.id, c]));
  const profiles = new Map(db.select("profiles").map((p) => [p.id, p]));
  const media = new Map(db.select("media").map((m) => [m.id, m]));
  return articles.map((a) => {
    const category = a.category_id ? categories.get(a.category_id) : undefined;
    return {
      id: a.id, slug: a.slug, headline: a.headline, status: a.status, publish_at: a.publish_at,
      updated_at: a.updated_at, created_at: a.created_at, featured: a.featured, breaking: a.breaking,
      breaking_until: a.breaking_until, category_id: a.category_id, author_id: a.author_id,
      category_name: category?.name ?? null,
      category_slug: category?.slug ?? null,
      author_name: (a.author_id && profiles.get(a.author_id)?.full_name) || null,
      image: (a.featured_image_id && media.get(a.featured_image_id)) || null,
      live: isLive(a, now),
      can_edit: role === "editor" || role === "admin" || (role === "reporter" && a.author_id === uid),
    };
  });
}

function detail(db: DevDatabase, a: Article): ArticleDetail {
  const role = db.myRole();
  const uid = db.uid();
  const tagIds = new Set(db.select("article_tags", (t) => t.article_id === a.id).map((t) => t.tag_id));
  const author = a.author_id ? db.select("profiles", (p) => p.id === a.author_id)[0] : undefined;
  const editor = role === "editor" || role === "admin";
  return {
    article: a,
    tags: db.select("tags", (t) => tagIds.has(t.id)).sort((x, y) => x.name.localeCompare(y.name)),
    image: a.featured_image_id ? (db.select("media", (m) => m.id === a.featured_image_id)[0] ?? null) : null,
    category: a.category_id ? (db.select("categories", (c) => c.id === a.category_id)[0] ?? null) : null,
    author: author ? { id: author.id, full_name: author.full_name } : null,
    live: isLive(a, db.now()),
    can_edit: editor || (role === "reporter" && a.author_id === uid),
    can_delete: editor || (role === "reporter" && a.author_id === uid && a.status === "draft"),
  };
}

function uniqueSlug(db: DevDatabase, desired: string, excludeId: Uuid | null): string {
  const taken = new Set(db.as(SERVICE).select("articles", (a) => a.id !== excludeId).map((a) => a.slug));
  if (!taken.has(desired)) return desired;
  for (let n = 2; ; n++) {
    const candidate = `${desired}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function setArticleTags(db: DevDatabase, articleId: Uuid, names: string[]) {
  const wanted = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    const slug = slugify(name);
    if (name && slug && slug !== "breaking") wanted.set(slug, name);
  }
  const existing = new Map(db.select("tags").map((t) => [t.slug, t]));
  const tagIds = [...wanted].map(([slug, name]) => (existing.get(slug) ?? db.insert("tags", { name, slug })).id);
  db.delete("article_tags", (t) => t.article_id === articleId && !tagIds.includes(t.tag_id));
  const have = new Set(db.select("article_tags", (t) => t.article_id === articleId).map((t) => t.tag_id));
  for (const tag_id of tagIds) if (!have.has(tag_id)) db.insert("article_tags", { article_id: articleId, tag_id });
}

function articlePatch(input: ArticleWrite): Partial<Article> {
  const patch: Partial<Article> = {};
  for (const key of EDITABLE_FIELDS) {
    if (input[key] !== undefined) (patch as Record<string, unknown>)[key] = input[key];
  }
  if (patch.headline !== undefined) patch.headline = patch.headline.replace(/\s+/g, " ").trim();
  if (patch.body !== undefined) {
    patch.body = normalizeDoc(patch.body);
    patch.body_html = renderBodyHtml(patch.body);
  }
  if (patch.slug !== undefined && !isValidSlug(patch.slug)) {
    throw invalid("Use only lowercase letters, numbers and hyphens in the web address.");
  }
  return patch;
}

function staffMember(db: DevDatabase, profile: Profile): StaffMember {
  const user = db.as(SERVICE).select("auth_users", (u) => u.id === profile.id)[0];
  return {
    ...profile,
    email: user?.email ?? "",
    invited_at: user?.invited_at ?? null,
    last_sign_in_at: user?.last_sign_in_at ?? null,
  };
}

export function createDevRepo(store: DevStore, actor: Actor, clock: () => Date = () => new Date()): NewsroomRepo {
  const open = (data: Database) => new DevDatabase(data, actor, clock);

  /** Every staff read and write starts here: no active profile, no access. */
  const staff = (db: DevDatabase) => {
    const role = db.myRole();
    if (!role) throw new NewsroomError("unauthenticated", "Please sign in again.");
    return role;
  };
  const read = <T>(fn: (db: DevDatabase) => T) =>
    store.read((data) => {
      const db = open(data);
      staff(db);
      return fn(db);
    });
  const write = <T>(fn: (db: DevDatabase) => T) =>
    store.write((data) => {
      const db = open(data);
      staff(db);
      return fn(db);
    });
  // RLS is the real gate. These up-front checks make a refused bulk change fail
  // loudly instead of quietly affecting 0 rows.
  const adminOnly = (db: DevDatabase, message: string) => {
    if (db.myRole() !== "admin") throw forbidden(message);
  };
  const editorOnly = (db: DevDatabase, message: string) => {
    const role = db.myRole();
    if (role !== "editor" && role !== "admin") throw forbidden(message);
  };

  const articleOrThrow = (db: DevDatabase, id: Uuid) => {
    const a = db.select("articles", (r) => r.id === id)[0];
    if (!a) throw notFound("We couldn't find that story. It may have been deleted.");
    return a;
  };

  const updateArticleRow = (db: DevDatabase, id: Uuid, patch: Partial<Article>) => {
    articleOrThrow(db, id);
    const [row] = db.update("articles", (r) => r.id === id, patch);
    if (!row) throw forbidden("You can only edit your own stories.");
    return row;
  };

  return {
    async me() {
      return store.read((data) => {
        const db = open(data);
        const uid = db.uid();
        const profile = uid ? db.select("profiles", (p) => p.id === uid && p.is_active)[0] : undefined;
        return profile ? staffMember(db, profile) : null;
      });
    },

    // ───────────── Articles ─────────────

    async listArticles(q: ArticleListQuery): Promise<ArticleList> {
      return read((db) => {
        const now = db.now();
        const search = q.search?.trim().toLowerCase() ?? "";
        const authors = new Map(db.select("profiles").map((p) => [p.id, p.full_name.toLowerCase()]));
        const tags = new Map(db.select("tags").map((t) => [t.id, t.name.toLowerCase()]));
        const tagsByArticle = new Map<Uuid, string[]>();
        for (const at of db.select("article_tags")) {
          tagsByArticle.set(at.article_id, [...(tagsByArticle.get(at.article_id) ?? []), tags.get(at.tag_id) ?? ""]);
        }
        const filtered = db
          .select("articles")
          .filter((a) => !q.categoryId || a.category_id === q.categoryId)
          .filter((a) => !q.authorId || a.author_id === q.authorId)
          .filter(
            (a) =>
              !search ||
              a.headline.toLowerCase().includes(search) ||
              (a.author_id && authors.get(a.author_id)?.includes(search)) ||
              (tagsByArticle.get(a.id) ?? []).some((t) => t.includes(search)),
          );
        const counts = { all: filtered.length } as Record<ArticleStatus | "all", number>;
        for (const s of ARTICLE_STATUSES) counts[s] = filtered.filter((a) => effectiveStatus(a, now) === s).length;

        const status = q.status ?? "all";
        const rows = filtered
          .filter((a) => status === "all" || effectiveStatus(a, now) === status)
          .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
        const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
        const pages = Math.max(1, Math.ceil(rows.length / pageSize));
        const page = Math.min(Math.max(q.page ?? 1, 1), pages);
        return {
          items: summarize(db, rows.slice((page - 1) * pageSize, page * pageSize)),
          total: rows.length,
          page,
          pageSize,
          counts,
        };
      });
    },

    async getArticle(id) {
      return read((db) => {
        const a = db.select("articles", (r) => r.id === id)[0];
        return a ? detail(db, a) : null;
      });
    },

    async createArticle(input) {
      return write((db) => {
        const patch = articlePatch(input);
        const base = patch.slug || slugify(patch.headline ?? "") || `draft-${randomUUID().slice(0, 8)}`;
        const row = db.insert("articles", { author_id: db.uid(), ...patch, slug: uniqueSlug(db, base, null) });
        if (input.tags) setArticleTags(db, row.id, input.tags);
        return detail(db, articleOrThrow(db, row.id));
      });
    },

    async updateArticle(id, input) {
      return write((db) => {
        const current = articleOrThrow(db, id);
        const patch = articlePatch(input);
        if (patch.slug !== undefined && patch.slug !== current.slug) {
          const locked = current.status === "published" || current.status === "scheduled";
          if (!locked) patch.slug = uniqueSlug(db, patch.slug, id);
        }
        updateArticleRow(db, id, patch);
        if (input.tags) setArticleTags(db, id, input.tags);
        return detail(db, articleOrThrow(db, id));
      });
    },

    async publishArticle(id, publishAt) {
      return write((db) => {
        const a = articleOrThrow(db, id);
        const now = db.now();
        const image = a.featured_image_id ? db.select("media", (m) => m.id === a.featured_image_id)[0] : undefined;
        const missing = [
          !a.headline.trim() && "a headline",
          !a.category_id && "a category",
          image && !image.alt.trim() && "alt text for the photo",
        ].filter(Boolean);
        if (missing.length) throw invalid(`Add ${missing.join(" and ")} before publishing.`);

        let patch: Partial<Article>;
        if (publishAt === null) {
          patch = { status: "published", publish_at: now.toISOString() };
        } else {
          if (!(Date.parse(publishAt) > now.getTime())) throw invalid("Pick a time in the future, or publish now.");
          patch = { status: "scheduled", publish_at: publishAt };
        }
        // Breaking runs for 6 hours from go-live, so restart the window (the trigger fills it in).
        if (a.breaking) patch.breaking_until = null;
        updateArticleRow(db, id, patch);
        return detail(db, articleOrThrow(db, id));
      });
    },

    async unpublishArticle(id) {
      return write((db) => {
        const a = articleOrThrow(db, id);
        if (isLive(a, db.now())) {
          updateArticleRow(db, id, { status: "unpublished" });
        } else if (a.status === "scheduled") {
          updateArticleRow(db, id, { status: "draft", publish_at: null });
        }
        return detail(db, articleOrThrow(db, id));
      });
    },

    async deleteArticle(id) {
      await write((db) => {
        articleOrThrow(db, id);
        const gone = db.delete("articles", (a) => a.id === id);
        if (gone.length === 0) throw forbidden("Reporters can delete only their own drafts. Ask an editor.");
      });
    },

    async searchLiveArticles(search, limit = 20) {
      return read((db) => {
        const now = db.now();
        const s = search.trim().toLowerCase();
        const rows = db
          .select("articles", (a) => isLive(a, now) && (!s || a.headline.toLowerCase().includes(s)))
          .sort((a, b) => Date.parse(b.publish_at!) - Date.parse(a.publish_at!))
          .slice(0, limit);
        return summarize(db, rows);
      });
    },

    async listBreaking() {
      return read((db) => {
        const now = db.now();
        const rows = db
          .select("articles", (a) => isLive(a, now) && isBreakingNow(a, now))
          .sort((a, b) => Date.parse(b.publish_at!) - Date.parse(a.publish_at!));
        return summarize(db, rows);
      });
    },

    async extendBreaking(id, hours) {
      await write((db) => {
        const a = articleOrThrow(db, id);
        const from = Math.max(db.now().getTime(), a.breaking_until ? Date.parse(a.breaking_until) : 0);
        updateArticleRow(db, id, { breaking: true, breaking_until: new Date(from + hours * HOUR).toISOString() });
      });
    },

    async endBreaking(id) {
      await write((db) => {
        updateArticleRow(db, id, { breaking: false });
      });
    },

    async authors() {
      return read((db) =>
        db
          .select("profiles")
          .map(({ id, full_name, role }) => ({ id, full_name, role }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      );
    },

    // ───────────── Media ─────────────

    async listMedia(search) {
      return read((db) => {
        const s = search?.trim().toLowerCase() ?? "";
        const rows = db
          .select("media", (m) => !s || [m.alt, m.caption, m.credit].some((v) => v.toLowerCase().includes(s)))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return rows.map((m) => mediaItem(db, m));
      });
    },

    async getMedia(id) {
      return read((db) => {
        const m = db.select("media", (r) => r.id === id)[0];
        return m ? mediaItem(db, m) : null;
      });
    },

    async createMedia(input) {
      return write((db) =>
        db.insert("media", {
          storage_path: input.storage_path,
          width: input.width,
          height: input.height,
          alt: input.alt?.trim() ?? "",
          caption: input.caption?.trim() ?? "",
          credit: input.credit?.trim() ?? "",
        }),
      );
    },

    async updateMedia(id, input) {
      return write((db) => {
        if (!db.select("media", (m) => m.id === id)[0]) throw notFound("We couldn't find that photo.");
        const patch: Partial<Media> = {};
        if (input.alt !== undefined) patch.alt = input.alt.trim().slice(0, 300);
        if (input.caption !== undefined) patch.caption = input.caption.trim().slice(0, 500);
        if (input.credit !== undefined) patch.credit = input.credit.trim().slice(0, 120);
        if (input.focal_x !== undefined) patch.focal_x = input.focal_x;
        if (input.focal_y !== undefined) patch.focal_y = input.focal_y;
        const [row] = db.update("media", (m) => m.id === id, patch);
        if (!row) throw forbidden("Only the person who uploaded this photo, or an editor, can change its details.");
        return row;
      });
    },

    async deleteMedia(id) {
      return write((db) => {
        if (!db.select("media", (m) => m.id === id)[0]) throw notFound("We couldn't find that photo.");
        const [row] = db.delete("media", (m) => m.id === id);
        if (!row) throw forbidden("Only editors can delete photos.");
        return row;
      });
    },

    // ───────────── Categories and tags ─────────────

    async listCategories() {
      return read((db) => {
        const articles = db.select("articles");
        return db
          .select("categories")
          .sort((a, b) => a.position - b.position)
          .map((c) => ({ ...c, article_count: articles.filter((a) => a.category_id === c.id).length }));
      });
    },

    async createCategory(name) {
      return explain("Only admins can change categories.", () =>
        write((db) => {
          const clean = name.trim().replace(/\s+/g, " ");
          const slug = slugify(clean);
          if (!clean || !slug) throw invalid("Enter a category name.");
          const position = Math.max(0, ...db.select("categories").map((c) => c.position)) + 1;
          return db.insert("categories", { name: clean, slug, position });
        }),
      );
    },

    async updateCategory(id, input) {
      return write((db) => {
        if (!db.select("categories", (c) => c.id === id)[0]) throw notFound("We couldn't find that category.");
        const patch: { name?: string; is_active?: boolean } = {};
        if (input.name !== undefined) {
          patch.name = input.name.trim().replace(/\s+/g, " ");
          if (!patch.name) throw invalid("Enter a category name.");
        }
        if (input.is_active !== undefined) patch.is_active = input.is_active;
        const [row] = db.update("categories", (c) => c.id === id, patch);
        if (!row) throw forbidden("Only admins can change categories.");
        return row;
      });
    },

    async moveCategory(id, direction) {
      await write((db) => {
        const list = db.select("categories").sort((a, b) => a.position - b.position);
        const i = list.findIndex((c) => c.id === id);
        const j = i + direction;
        if (i < 0) throw notFound("We couldn't find that category.");
        if (j < 0 || j >= list.length) return;
        // Renumber so positions stay distinct, then swap the pair.
        const order = list.map((c) => c.id);
        [order[i], order[j]] = [order[j], order[i]];
        const changed = db.update("categories", () => true, (c) => ({ position: order.indexOf(c.id) + 1 }));
        if (changed.length === 0) throw forbidden("Only admins can change categories.");
      });
    },

    async listTags() {
      return read((db) => {
        const links = db.select("article_tags");
        return db
          .select("tags")
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => ({ ...t, article_count: links.filter((l) => l.tag_id === t.id).length }));
      });
    },

    async renameTag(id, name) {
      return write((db) => {
        if (!db.select("tags", (t) => t.id === id)[0]) throw notFound("We couldn't find that tag.");
        const clean = name.trim().replace(/\s+/g, " ");
        const slug = slugify(clean);
        if (!clean || !slug) throw invalid("Enter a tag name.");
        if (db.select("tags", (t) => t.slug === slug && t.id !== id).length) {
          throw new NewsroomError("conflict", "A tag with that name already exists. Merge the two instead.");
        }
        const [row] = db.update("tags", (t) => t.id === id, { name: clean, slug });
        if (!row) throw forbidden("Only editors can rename tags.");
        return row;
      });
    },

    async mergeTags(fromId, intoId) {
      await write((db) => {
        if (fromId === intoId) throw invalid("Pick a different tag to merge into.");
        if (db.select("tags", (t) => t.id === fromId || t.id === intoId).length !== 2) {
          throw notFound("We couldn't find one of those tags.");
        }
        editorOnly(db, "Only editors can merge tags.");
        const into = new Set(db.select("article_tags", (l) => l.tag_id === intoId).map((l) => l.article_id));
        for (const link of db.select("article_tags", (l) => l.tag_id === fromId)) {
          if (!into.has(link.article_id)) db.insert("article_tags", { article_id: link.article_id, tag_id: intoId });
        }
        if (db.delete("tags", (t) => t.id === fromId).length === 0) throw forbidden("Only editors can merge tags.");
      });
    },

    async deleteTag(id) {
      await write((db) => {
        if (!db.select("tags", (t) => t.id === id)[0]) throw notFound("We couldn't find that tag.");
        if (db.delete("tags", (t) => t.id === id).length === 0) throw forbidden("Only editors can delete tags.");
      });
    },

    // ───────────── Staff (admins; invites use the service role) ─────────────

    async listStaff() {
      return read((db) => {
        adminOnly(db, "Only admins can manage staff.");
        return db
          .select("profiles")
          .map((p) => staffMember(db, p))
          .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.full_name.localeCompare(b.full_name));
      });
    },

    async inviteStaff(invite: Invite) {
      return write((db) => {
        adminOnly(db, "Only admins can invite staff.");
        const email = invite.email.trim().toLowerCase();
        const full_name = invite.full_name.trim().replace(/\s+/g, " ");
        if (!EMAIL.test(email)) throw invalid("Enter a valid email address.");
        if (!full_name) throw invalid("Enter the person's name, as it should appear in bylines.");
        if (!STAFF_ROLES.includes(invite.role)) throw invalid("Pick a role.");
        // What the invite server action does: auth.admin.inviteUserByEmail, then the
        // service role sets the chosen role and activates the inactive reporter profile.
        const service = db.as(SERVICE);
        const user = service.insert("auth_users", {
          email,
          raw_user_meta_data: { full_name },
          invited_at: db.now().toISOString(),
        });
        const [profile] = service.update("profiles", (p) => p.id === user.id, { role: invite.role, is_active: true });
        return staffMember(db, profile);
      });
    },

    async resendInvite(id) {
      await write((db) => {
        adminOnly(db, "Only admins can invite staff.");
        const service = db.as(SERVICE);
        const user = service.select("auth_users", (u) => u.id === id)[0];
        if (!user) throw notFound("We couldn't find that person.");
        if (user.last_sign_in_at) throw invalid("They have already joined.");
        service.update("auth_users", (u) => u.id === id, { invited_at: db.now().toISOString() });
      });
    },

    async updateStaff(id, input) {
      return write((db) => {
        adminOnly(db, "Only admins can manage staff.");
        const target = db.select("profiles", (p) => p.id === id)[0];
        if (!target) throw notFound("We couldn't find that person.");
        if (id === db.uid() && (input.role !== undefined && input.role !== target.role)) {
          throw invalid("You can't change your own role. Ask another admin.");
        }
        if (id === db.uid() && input.is_active === false) {
          throw invalid("You can't remove yourself. Ask another admin.");
        }
        if (input.role !== undefined && !STAFF_ROLES.includes(input.role)) throw invalid("Pick a role.");
        const patch: Partial<Profile> = {};
        if (input.role !== undefined) patch.role = input.role;
        if (input.is_active !== undefined) patch.is_active = input.is_active;
        if (input.full_name !== undefined) {
          patch.full_name = input.full_name.trim().replace(/\s+/g, " ");
          if (!patch.full_name) throw invalid("Enter the person's name.");
        }
        const [row] = db.update("profiles", (p) => p.id === id, patch);
        if (!row) throw forbidden("Only admins can manage staff.");
        const admins = db.select("profiles", (p) => p.role === "admin" && p.is_active);
        if (admins.length === 0) throw invalid("The newsroom needs at least one active admin.");
        return staffMember(db, row);
      });
    },

    // ───────────── Front page ─────────────

    async getFrontPage() {
      return read((db) => {
        const names = new Map(db.select("profiles").map((p) => [p.id, p.full_name]));
        return {
          pins: db
            .select("front_page_pins")
            .map((p) => ({ ...p, pinned_by_name: (p.pinned_by && names.get(p.pinned_by)) || null })),
          picks: db.select("most_read_picks").sort((a, b) => a.position - b.position),
        };
      });
    },

    async setPin(slot, articleId) {
      await explain("Only editors can change the front page.", () =>
        write((db) => {
          editorOnly(db, "Only editors can change the front page.");
          db.delete("front_page_pins", (p) => p.slot === slot);
          if (articleId === null) return;
          const a = articleOrThrow(db, articleId);
          if (!isLive(a, db.now())) throw invalid("Only live stories can be pinned to the front page.");
          db.delete("front_page_pins", (p) => p.article_id === articleId);
          db.insert("front_page_pins", { slot, article_id: articleId });
        }),
      );
    },

    async arrangeTopStories(articleIds) {
      await explain("Only editors can change the front page.", () =>
        write((db) => {
          editorOnly(db, "Only editors can change the front page.");
          if (articleIds.length !== TOP_SLOTS.length) throw invalid("There are four top story slots.");
          const ids = articleIds.filter((x): x is Uuid => x !== null);
          if (new Set(ids).size !== ids.length) throw invalid("A story can fill only one slot.");
          const now = db.now();
          for (const id of ids) {
            if (!isLive(articleOrThrow(db, id), now)) throw invalid("Only live stories can be pinned to the front page.");
          }
          const slots = new Set<FrontSlot>(TOP_SLOTS);
          db.delete("front_page_pins", (p) => slots.has(p.slot) || (p.slot === "lead" && ids.includes(p.article_id)));
          articleIds.forEach((article_id, i) => {
            if (article_id) db.insert("front_page_pins", { slot: TOP_SLOTS[i], article_id });
          });
        }),
      );
    },

    async setMostRead(articleIds) {
      await explain("Only editors can change Most read.", () =>
        write((db) => {
          editorOnly(db, "Only editors can change Most read.");
          if (articleIds.length > 5) throw invalid("Most read holds up to 5 stories.");
          if (new Set(articleIds).size !== articleIds.length) throw invalid("That story is already in the list.");
          for (const id of articleIds) articleOrThrow(db, id);
          db.delete("most_read_picks", () => true);
          articleIds.forEach((article_id, i) => db.insert("most_read_picks", { position: i + 1, article_id }));
        }),
      );
    },

    // ───────────── Ads ─────────────

    async listCampaigns() {
      return read((db) =>
        db
          .select("ad_campaigns")
          .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))
          .map((c) => campaignItem(db, c)),
      );
    },

    async getCampaign(id) {
      return read((db) => {
        const c = db.select("ad_campaigns", (r) => r.id === id)[0];
        return c ? campaignItem(db, c) : null;
      });
    },

    async createCampaign(input) {
      return explain("Only admins can manage ad campaigns.", () =>
        write((db) => db.insert("ad_campaigns", campaignPatch(input) as CampaignWrite)),
      );
    },

    async updateCampaign(id, input) {
      return write((db) => {
        if (!db.select("ad_campaigns", (c) => c.id === id)[0]) throw notFound("We couldn't find that campaign.");
        const [row] = db.update("ad_campaigns", (c) => c.id === id, campaignPatch(input));
        if (!row) throw forbidden("Only admins can manage ad campaigns.");
        return row;
      });
    },

    async deleteCampaign(id) {
      await write((db) => {
        if (!db.select("ad_campaigns", (c) => c.id === id)[0]) throw notFound("We couldn't find that campaign.");
        if (db.delete("ad_campaigns", (c) => c.id === id).length === 0) {
          throw forbidden("Only admins can manage ad campaigns.");
        }
      });
    },

    // ───────────── Site settings ─────────────

    async getSettings() {
      return read((db) => db.select("site_settings")[0]);
    },

    async updateSettings(input) {
      return write((db) => {
        const current = db.select("site_settings")[0] as unknown as Record<string, string>;
        const patch: Record<string, string> = {};
        for (const [key, value] of Object.entries(input)) {
          if (key === "id" || typeof value !== "string") continue;
          const v = value.trim();
          // Only check what changed, so placeholder values elsewhere don't block a save.
          if (current && current[key] === v) continue;
          if (key.endsWith("_url") && v && !/^https:\/\//i.test(v)) throw invalid("Social links must start with https://.");
          if (key.endsWith("_email") && v && !EMAIL.test(v)) throw invalid("Check the email addresses.");
          patch[key] = v;
        }
        const [row] = db.update("site_settings", () => true, patch);
        if (!row) throw forbidden("Only admins can change site settings.");
        return row;
      });
    },
  };
}

function mediaItem(db: DevDatabase, m: Media): MediaItem {
  const role = db.myRole();
  const uploader = m.uploaded_by ? db.select("profiles", (p) => p.id === m.uploaded_by)[0] : undefined;
  const usedBy =
    db.select("articles", (a) => a.featured_image_id === m.id).length +
    db.select("ad_campaigns", (c) => c.image_desktop_id === m.id || c.image_mobile_id === m.id).length;
  return {
    ...m,
    uploader_name: uploader?.full_name ?? null,
    used_by: usedBy,
    can_edit: role === "editor" || role === "admin" || m.uploaded_by === db.uid(),
  };
}

function campaignItem(db: DevDatabase, c: AdCampaign): CampaignItem {
  const media = (id: Uuid | null) => (id ? (db.select("media", (m) => m.id === id)[0] ?? null) : null);
  return { ...c, desktop: media(c.image_desktop_id), mobile: media(c.image_mobile_id) };
}

function campaignPatch(input: Partial<CampaignWrite>): Partial<CampaignWrite> {
  const patch: Partial<CampaignWrite> = { ...input };
  if (patch.advertiser_name !== undefined) {
    patch.advertiser_name = patch.advertiser_name.trim();
    if (!patch.advertiser_name) throw invalid("Enter the advertiser's name.");
  }
  if (patch.alt !== undefined) {
    patch.alt = patch.alt.trim();
    if (!patch.alt) throw invalid("Describe the advert for screen reader users (alt text).");
  }
  if (patch.link_url !== undefined) patch.link_url = patch.link_url.trim();
  return patch;
}

// ───────────── Public reader (anon) ─────────────

export function createDevPublicReader(store: DevStore): NewsroomPublicReader {
  const at = (now: Date) => (data: Database) => new DevDatabase(data, ANON, () => now);

  return {
    async liveArticles(now) {
      return store.read((data) => {
        const db = at(now)(data);
        const categories = new Map(db.select("categories").map((c) => [c.id, c]));
        const media = new Map(db.select("media").map((m) => [m.id, m]));
        const tags = new Map(db.select("tags").map((t) => [t.id, t.name]));
        const links = db.select("article_tags");
        // Anon can't read profiles (profiles_read is for staff), so bylines need a
        // public view of author names in Supabase. See OPEN_QUESTIONS.md.
        const names = new Map(db.as(SERVICE).select("profiles").map((p) => [p.id, p.full_name]));
        return db
          .select("articles")
          .sort((a, b) => Date.parse(b.publish_at!) - Date.parse(a.publish_at!))
          .map((a) => ({
            ...a,
            category: (a.category_id && categories.get(a.category_id)) || null,
            author_name: (a.author_id && names.get(a.author_id)) || null,
            image: (a.featured_image_id && media.get(a.featured_image_id)) || null,
            tag_names: links.filter((l) => l.article_id === a.id).map((l) => tags.get(l.tag_id) ?? ""),
          }));
      });
    },

    async categories() {
      return store.read((data) =>
        at(new Date())(data)
          .select("categories", (c) => c.is_active)
          .sort((a, b) => a.position - b.position),
      );
    },

    async frontPage() {
      return store.read((data) => {
        const db = at(new Date())(data);
        return {
          pins: db.select("front_page_pins"),
          picks: db.select("most_read_picks").sort((a, b) => a.position - b.position),
        };
      });
    },

    async runningCampaigns(now, slot) {
      return store.read((data) => {
        const db = at(now)(data);
        const media = (id: Uuid | null) => (id ? (db.select("media", (m) => m.id === id)[0] ?? null) : null);
        return db
          .select("ad_campaigns", (c) => !slot || c.slot === slot)
          .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))
          .map((c) => ({ ...c, desktop: media(c.image_desktop_id), mobile: media(c.image_mobile_id) }));
      });
    },

    async settings() {
      return store.read((data) => at(new Date())(data).select("site_settings")[0]);
    },
  };
}
