import { randomUUID } from "node:crypto";
import { NewsroomError, forbidden, invalid } from "../errors";
import type { Database, StaffRole, TableName, Tables, Uuid } from "../types";
import { policiesFor, type PolicyContext } from "./policies";
import { guardArticle, profileForNewUser } from "./triggers";

// A small in-memory stand-in for Postgres with RLS, enough to run the newsroom on
// a JSON file. It applies schema.sql's column defaults, unique keys, check
// constraints, foreign keys, triggers and policies, with Postgres semantics:
// - SELECT, UPDATE and DELETE silently skip rows the policies hide (0 rows affected).
// - INSERT, or an UPDATE whose new row fails WITH CHECK, raises an error.
// - Each statement is all-or-nothing.
// The service role bypasses RLS, as Supabase's service key does.

export type Actor = { kind: "anon" } | { kind: "user"; uid: Uuid } | { kind: "service" };

export const ANON: Actor = { kind: "anon" };
export const SERVICE: Actor = { kind: "service" };
export const asUser = (uid: Uuid): Actor => ({ kind: "user", uid });

type Row<T extends TableName> = Tables[T];
type Where<T extends TableName> = (row: Row<T>) => boolean;
type Patch<T extends TableName> = Partial<Row<T>> | ((row: Row<T>) => Partial<Row<T>>);

const RLS_VIOLATION = "You don't have permission to make that change.";

// ───────────── Column defaults (schema.sql `default ...`) ─────────────
function defaults<T extends TableName>(table: T, c: PolicyContext): Partial<Row<T>> {
  const now = c.now.toISOString();
  const d: { [K in TableName]: Partial<Tables[K]> } = {
    auth_users: { id: randomUUID(), raw_user_meta_data: {}, invited_at: null, last_sign_in_at: null, created_at: now },
    profiles: { full_name: "", role: "reporter", is_active: false, created_at: now },
    categories: { id: randomUUID(), position: 0, is_active: true },
    tags: { id: randomUUID() },
    media: {
      id: randomUUID(), width: null, height: null, alt: "", caption: "", credit: "",
      focal_x: 0.5, focal_y: 0.5, uploaded_by: c.uid, created_at: now,
    },
    articles: {
      id: randomUUID(), headline: "", standfirst: "", body: { type: "doc", content: [] }, body_html: "",
      category_id: null, author_id: null, featured_image_id: null, status: "draft", publish_at: null,
      featured: false, breaking: false, breaking_until: null, seo_title: "", seo_description: "",
      created_by: null, updated_by: null, created_at: now, updated_at: now,
    },
    article_tags: {},
    front_page_pins: { pinned_by: c.uid, pinned_at: now },
    most_read_picks: {},
    ad_campaigns: { id: randomUUID(), image_desktop_id: null, image_mobile_id: null, created_by: c.uid, created_at: now },
    site_settings: {
      id: true, newsroom_address: "", newsroom_phone: "", newsroom_email: "", corrections_email: "",
      facebook_url: "",
      instagram_url: "https://www.instagram.com/citymoodbadagry/",
      tiktok_url: "https://www.tiktok.com/@citymoodbadagry",
    },
  };
  return d[table] as Partial<Row<T>>;
}

// ───────────── Primary and unique keys ─────────────
const UNIQUE: { [T in TableName]: (keyof Tables[T])[][] } = {
  auth_users: [["id"], ["email"]],
  profiles: [["id"]],
  categories: [["id"], ["slug"]],
  tags: [["id"], ["slug"]],
  media: [["id"], ["storage_path"]],
  articles: [["id"], ["slug"]],
  article_tags: [["article_id", "tag_id"]],
  front_page_pins: [["slot"]],
  most_read_picks: [["position"]],
  ad_campaigns: [["id"]],
  site_settings: [["id"]],
};

const UNIQUE_MESSAGES: Partial<Record<string, string>> = {
  "articles.slug": "Another story already uses that web address.",
  "categories.slug": "Another category already uses that web address.",
  "tags.slug": "A tag with that name already exists.",
  "auth_users.email": "Someone with that email is already on the staff list.",
};

// ───────────── Check constraints ─────────────
const CHECKS: { [T in TableName]?: ((row: Tables[T]) => string | null)[] } = {
  media: [
    (m) => (m.focal_x >= 0 && m.focal_x <= 1 && m.focal_y >= 0 && m.focal_y <= 1 ? null : "The focal point must be inside the photo."),
  ],
  articles: [
    // publish_needs_time
    (a) => (a.status === "draft" || a.status === "unpublished" || a.publish_at !== null ? null : "A publish time is needed."),
  ],
  most_read_picks: [(p) => (p.position >= 1 && p.position <= 5 ? null : "Most read holds up to 5 stories.")],
  ad_campaigns: [
    (ad) => (/^https?:\/\//i.test(ad.link_url) ? null : "The link must start with http:// or https://."),
    (ad) => (Date.parse(ad.ends_at) > Date.parse(ad.starts_at) ? null : "The end date must be after the start date."),
  ],
  site_settings: [(s) => (s.id === true ? null : "There is only one settings row.")],
};

// ───────────── Foreign keys ─────────────
type ForeignKey = {
  table: TableName;
  column: string;
  ref: TableName;
  refColumn: string;
  onDelete: "cascade" | "set null" | "restrict";
  message?: string;
};

const FOREIGN_KEYS: ForeignKey[] = [
  { table: "profiles", column: "id", ref: "auth_users", refColumn: "id", onDelete: "cascade" },
  { table: "media", column: "uploaded_by", ref: "profiles", refColumn: "id", onDelete: "set null" },
  {
    table: "articles", column: "category_id", ref: "categories", refColumn: "id", onDelete: "restrict",
    message: "This category still has stories. Move them first, or hide the category instead.",
  },
  { table: "articles", column: "author_id", ref: "profiles", refColumn: "id", onDelete: "set null" },
  { table: "articles", column: "featured_image_id", ref: "media", refColumn: "id", onDelete: "set null" },
  { table: "articles", column: "created_by", ref: "profiles", refColumn: "id", onDelete: "set null" },
  { table: "articles", column: "updated_by", ref: "profiles", refColumn: "id", onDelete: "set null" },
  { table: "article_tags", column: "article_id", ref: "articles", refColumn: "id", onDelete: "cascade" },
  { table: "article_tags", column: "tag_id", ref: "tags", refColumn: "id", onDelete: "cascade" },
  { table: "front_page_pins", column: "article_id", ref: "articles", refColumn: "id", onDelete: "cascade" },
  { table: "front_page_pins", column: "pinned_by", ref: "profiles", refColumn: "id", onDelete: "set null" },
  { table: "most_read_picks", column: "article_id", ref: "articles", refColumn: "id", onDelete: "cascade" },
  { table: "ad_campaigns", column: "image_desktop_id", ref: "media", refColumn: "id", onDelete: "set null" },
  { table: "ad_campaigns", column: "image_mobile_id", ref: "media", refColumn: "id", onDelete: "set null" },
  { table: "ad_campaigns", column: "created_by", ref: "profiles", refColumn: "id", onDelete: "set null" },
];

const field = (row: object, column: string) => (row as Record<string, unknown>)[column];

export class DevDatabase {
  private readonly policies;

  constructor(
    readonly data: Database,
    readonly actor: Actor,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.policies = policiesFor((table, pred) => this.data[table].find(pred));
  }

  /** auth.uid() */
  uid(): Uuid | null {
    return this.actor.kind === "user" ? this.actor.uid : null;
  }

  /** public.my_role(): the role of the signed-in user, only while their profile is active. */
  myRole(): StaffRole | null {
    const uid = this.uid();
    const p = uid ? this.data.profiles.find((x) => x.id === uid && x.is_active) : undefined;
    return p?.role ?? null;
  }

  now(): Date {
    return this.clock();
  }

  private context(): PolicyContext {
    return { uid: this.uid(), anon: this.actor.kind === "anon", role: this.myRole(), now: this.clock() };
  }

  private get bypass() {
    return this.actor.kind === "service";
  }

  /** A database for another actor over the same data, e.g. the service role inside an admin action. */
  as(actor: Actor): DevDatabase {
    return new DevDatabase(this.data, actor, this.clock);
  }

  select<T extends TableName>(table: T, where: Where<T> = () => true): Row<T>[] {
    const c = this.context();
    const visible = this.policies[table].select;
    return (this.data[table] as Row<T>[])
      .filter((r) => (this.bypass || (visible?.(r, c) ?? false)) && where(r))
      .map((r) => structuredClone(r));
  }

  insert<T extends TableName>(table: T, values: Partial<Row<T>>): Row<T> {
    const c = this.context();
    const row = { ...defaults(table, c), ...structuredClone(values) } as Row<T>;
    if (table === "articles") guardArticle(c, row as Row<"articles">, null);
    if (!this.bypass && !(this.policies[table].insert?.(row, c) ?? false)) throw forbidden(RLS_VIOLATION);
    this.validate(table, [row], []);
    (this.data[table] as Row<T>[]).push(row);
    // on_auth_user_created (security definer, so it bypasses RLS)
    if (table === "auth_users") {
      this.data.profiles.push(profileForNewUser(row as Row<"auth_users">, c.now));
    }
    return structuredClone(row);
  }

  update<T extends TableName>(table: T, where: Where<T>, patch: Patch<T>): Row<T>[] {
    const c = this.context();
    const policy = this.policies[table];
    const rows = this.data[table] as Row<T>[];
    const targets = rows.filter(
      (r) =>
        where(r) &&
        (this.bypass || ((policy.select?.(r, c) ?? false) && (policy.update?.using(r, c) ?? false))),
    );
    // Build and check every new row before writing any, so the statement is atomic.
    const next = targets.map((old) => {
      const changes = typeof patch === "function" ? patch(structuredClone(old)) : patch;
      const row = { ...structuredClone(old), ...structuredClone(changes) } as Row<T>;
      if (table === "articles") guardArticle(c, row as Row<"articles">, old as Row<"articles">);
      if (!this.bypass && !(policy.update?.check(row, c) ?? false)) throw forbidden(RLS_VIOLATION);
      return row;
    });
    this.validate(table, next, targets);
    targets.forEach((old, i) => {
      rows[rows.indexOf(old)] = next[i];
    });
    return next.map((r) => structuredClone(r));
  }

  delete<T extends TableName>(table: T, where: Where<T>): Row<T>[] {
    const c = this.context();
    const policy = this.policies[table];
    const targets = (this.data[table] as Row<T>[]).filter(
      (r) => where(r) && (this.bypass || ((policy.select?.(r, c) ?? false) && (policy.delete?.(r, c) ?? false))),
    );
    if (targets.length === 0) return [];
    this.checkRestrict(table, targets);
    this.removeRows(table, targets);
    return targets.map((r) => structuredClone(r));
  }

  // ───────────── constraint plumbing ─────────────

  private validate<T extends TableName>(table: T, rows: Row<T>[], replacing: Row<T>[]) {
    for (const row of rows) {
      for (const check of CHECKS[table] ?? []) {
        const problem = check(row);
        if (problem) throw invalid(problem);
      }
    }
    const others = (this.data[table] as Row<T>[]).filter((r) => !replacing.includes(r));
    for (const cols of UNIQUE[table]) {
      const key = (r: Row<T>) => cols.map((col) => String(r[col])).join("\u0000");
      const seen = new Set(others.map(key));
      for (const row of rows) {
        const k = key(row);
        if (seen.has(k)) {
          throw new NewsroomError(
            "conflict",
            UNIQUE_MESSAGES[`${table}.${cols.join(",")}`] ?? "That item already exists.",
          );
        }
        seen.add(k);
      }
    }
    for (const fk of FOREIGN_KEYS.filter((f) => f.table === table)) {
      for (const row of rows) {
        const value = field(row, fk.column);
        if (value === null || value === undefined) continue;
        if (!this.data[fk.ref].some((r) => field(r, fk.refColumn) === value)) {
          throw invalid("That item refers to something that no longer exists. Reload and try again.");
        }
      }
    }
  }

  private checkRestrict(table: TableName, targets: object[]) {
    for (const fk of FOREIGN_KEYS.filter((f) => f.ref === table && f.onDelete === "restrict")) {
      const keys = new Set(targets.map((t) => field(t, fk.refColumn)));
      if (this.data[fk.table].some((r) => keys.has(field(r, fk.column)))) {
        throw invalid(fk.message ?? "This item is still in use.");
      }
    }
  }

  /** Removes rows and applies ON DELETE actions (which bypass RLS, as in Postgres). */
  private removeRows(table: TableName, targets: object[]) {
    const gone = new Set(targets);
    const tables = this.data as unknown as Record<TableName, object[]>;
    tables[table] = tables[table].filter((r) => !gone.has(r));
    for (const fk of FOREIGN_KEYS.filter((f) => f.ref === table)) {
      const keys = new Set(targets.map((t) => field(t, fk.refColumn)));
      const referencing = (this.data[fk.table] as object[]).filter((r) => keys.has(field(r, fk.column)));
      if (referencing.length === 0) continue;
      if (fk.onDelete === "cascade") {
        this.removeRows(fk.table, referencing);
      } else if (fk.onDelete === "set null") {
        for (const r of referencing) (r as Record<string, unknown>)[fk.column] = null;
      }
    }
  }
}
