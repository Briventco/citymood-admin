import { isLive } from "../status";
import type { StaffRole, TableName, Tables, Uuid } from "../types";

// Row-level security, transcribed from docs/design/admin/schema.sql. Each policy
// here has the same name and condition as its SQL counterpart, so a change to
// one should be made to the other. RLS is enabled on every table: a missing
// policy means "deny", exactly as in Postgres.

export type PolicyContext = {
  /** auth.uid(): null for anon. */
  uid: Uuid | null;
  /** true for the anon role, false for authenticated users. */
  anon: boolean;
  /** public.my_role(): null unless the profile is active. */
  role: StaffRole | null;
  now: Date;
};

const isStaff = (c: PolicyContext) => c.role !== null;
const isEditor = (c: PolicyContext) => c.role === "editor" || c.role === "admin";
const isAdmin = (c: PolicyContext) => c.role === "admin";
const authenticated = (c: PolicyContext) => !c.anon;

type Check<T> = (row: T, c: PolicyContext) => boolean;

export type TablePolicies<T> = {
  select?: Check<T>;
  insert?: Check<T>;
  /** USING (old row) and WITH CHECK (new row). */
  update?: { using: Check<T>; check: Check<T> };
  delete?: Check<T>;
};

/** Lets article_tags policies look up the parent article, as the SQL `exists (...)` does. */
export type Lookup = <T extends TableName>(table: T, pred: (row: Tables[T]) => boolean) => Tables[T] | undefined;

const both = <T>(fn: Check<T>) => ({ using: fn, check: fn });

export function policiesFor(lookup: Lookup): { [T in TableName]: TablePolicies<Tables[T]> } {
  const canWriteArticle = (articleId: Uuid, c: PolicyContext) => {
    const a = lookup("articles", (r) => r.id === articleId);
    return !!a && (isEditor(c) || (c.role === "reporter" && a.author_id === c.uid));
  };

  return {
    // auth.users is not exposed to the API. Only the service role (invites) touches it.
    auth_users: {},

    // profiles_read, profiles_admin
    profiles: {
      select: (p, c) => authenticated(c) && (isStaff(c) || p.id === c.uid),
      update: both((_, c) => authenticated(c) && isAdmin(c)),
    },

    // articles_public_read, articles_staff_read, articles_insert, articles_update, articles_delete
    articles: {
      select: (a, c) => isLive(a, c.now) || (authenticated(c) && isStaff(c)),
      insert: (_, c) => authenticated(c) && isStaff(c),
      update: both(
        (a, c) => authenticated(c) && (isEditor(c) || (c.role === "reporter" && a.author_id === c.uid)),
      ),
      delete: (a, c) =>
        authenticated(c) &&
        (isEditor(c) || (c.role === "reporter" && a.author_id === c.uid && a.status === "draft")),
    },

    // article_tags_read, article_tags_write
    article_tags: {
      select: () => true,
      insert: (t, c) => authenticated(c) && canWriteArticle(t.article_id, c),
      update: both((t, c) => authenticated(c) && canWriteArticle(t.article_id, c)),
      delete: (t, c) => authenticated(c) && canWriteArticle(t.article_id, c),
    },

    // categories_read, categories_write
    categories: {
      select: () => true,
      insert: (_, c) => authenticated(c) && isAdmin(c),
      update: both((_, c) => authenticated(c) && isAdmin(c)),
      delete: (_, c) => authenticated(c) && isAdmin(c),
    },

    // tags_read, tags_insert, tags_edit, tags_delete
    tags: {
      select: () => true,
      insert: (_, c) => authenticated(c) && isStaff(c),
      update: both((_, c) => authenticated(c) && isEditor(c)),
      delete: (_, c) => authenticated(c) && isEditor(c),
    },

    // media_read, media_insert, media_update, media_delete
    media: {
      select: () => true,
      insert: (_, c) => authenticated(c) && isStaff(c),
      update: both((m, c) => authenticated(c) && (isEditor(c) || m.uploaded_by === c.uid)),
      delete: (_, c) => authenticated(c) && isEditor(c),
    },

    // pins_read, pins_write
    front_page_pins: {
      select: () => true,
      insert: (_, c) => authenticated(c) && isEditor(c),
      update: both((_, c) => authenticated(c) && isEditor(c)),
      delete: (_, c) => authenticated(c) && isEditor(c),
    },

    // picks_read, picks_write
    most_read_picks: {
      select: () => true,
      insert: (_, c) => authenticated(c) && isEditor(c),
      update: both((_, c) => authenticated(c) && isEditor(c)),
      delete: (_, c) => authenticated(c) && isEditor(c),
    },

    // ads_public_read, ads_staff_read, ads_write
    ad_campaigns: {
      select: (ad, c) => {
        const t = c.now.getTime();
        const running = Date.parse(ad.starts_at) <= t && t <= Date.parse(ad.ends_at);
        return running || (authenticated(c) && isStaff(c));
      },
      insert: (_, c) => authenticated(c) && isAdmin(c),
      update: both((_, c) => authenticated(c) && isAdmin(c)),
      delete: (_, c) => authenticated(c) && isAdmin(c),
    },

    // settings_read, settings_write
    site_settings: {
      select: () => true,
      update: both((_, c) => authenticated(c) && isAdmin(c)),
    },
  };
}
