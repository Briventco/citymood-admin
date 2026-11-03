import { randomUUID } from "node:crypto";
import { mostReadSlugs } from "@/config/mostRead";
import { site } from "@/config/site";
import { defaultCategories } from "@/lib/content/categories";
import { seedArticles } from "@/lib/content/seed";
import { docFromParagraphs, renderBodyHtml } from "../richtext";
import type { Article, Database, Media, StaffRole, Uuid } from "../types";

// SEED for data/admin-dev.json. Populated with verified CityMood reporting
// and authentic Badagry photography from lib/content/seed.ts.

export const DEMO_USERS: Record<"admin" | "editor" | "reporter" | "reporter2" | "invited", {
  id: Uuid;
  email: string;
  full_name: string;
  role: StaffRole;
}> = {
  admin: { id: "d0000000-0000-4000-8000-00000000000a", email: "publisher@citymood.ng", full_name: "Dr. Abolaji Sewhude Akande", role: "admin" },
  editor: { id: "d0000000-0000-4000-8000-00000000000e", email: "editor@citymood.ng", full_name: "Joy Agu", role: "editor" },
  reporter: { id: "d0000000-0000-4000-8000-000000000001", email: "newsroom@citymood.ng", full_name: "CityMood Metro Desk", role: "reporter" },
  reporter2: { id: "d0000000-0000-4000-8000-000000000002", email: "heritage@citymood.ng", full_name: "CityMood Heritage Bureau", role: "reporter" },
  invited: { id: "d0000000-0000-4000-8000-000000000009", email: "babatunde.hunpe@citymood.ng", full_name: "Babatunde Hunpe", role: "reporter" },
};

const HOUR = 3_600_000;

export function buildSeed(now: Date = new Date()): Database {
  const iso = (ms: number) => new Date(ms).toISOString();
  const t = now.getTime();
  const db: Database = {
    auth_users: [], profiles: [], categories: [], tags: [], media: [], articles: [], article_tags: [],
    front_page_pins: [], most_read_picks: [], ad_campaigns: [],
    site_settings: [
      {
        id: true,
        newsroom_address: site.contact.address,
        newsroom_phone: site.contact.phone,
        newsroom_email: site.contact.newsroomEmail,
        corrections_email: site.contact.correctionsEmail,
        facebook_url: site.social.find((s) => s.network === "Facebook")?.url ?? "",
        instagram_url: site.social.find((s) => s.network === "Instagram")?.url ?? "",
        tiktok_url: site.social.find((s) => s.network === "TikTok")?.url ?? "",
      },
    ],
  };

  for (const [key, u] of Object.entries(DEMO_USERS)) {
    const invitedOnly = key === "invited";
    db.auth_users.push({
      id: u.id, email: u.email, raw_user_meta_data: { full_name: u.full_name },
      invited_at: iso(t - 30 * 24 * HOUR), last_sign_in_at: invitedOnly ? null : iso(t - 2 * HOUR),
      created_at: iso(t - 30 * 24 * HOUR),
    });
    db.profiles.push({ id: u.id, full_name: u.full_name, role: u.role, is_active: true, created_at: iso(t - 30 * 24 * HOUR) });
  }

  const categoryId = new Map<string, Uuid>();
  for (const c of defaultCategories) {
    const id = randomUUID();
    categoryId.set(c.slug, id);
    db.categories.push({ id, name: c.name, slug: c.slug, position: c.order, is_active: true });
  }

  const tagFor = new Map<string, Uuid>();
  const tag = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!tagFor.has(slug)) {
      const id = randomUUID();
      tagFor.set(slug, id);
      db.tags.push({ id, name, slug });
    }
    return tagFor.get(slug)!;
  };

  function authorIdFor(authorName?: string): Uuid {
    if (authorName?.includes("Akande")) return DEMO_USERS.admin.id;
    if (authorName?.includes("Agu")) return DEMO_USERS.editor.id;
    if (authorName?.includes("Heritage")) return DEMO_USERS.reporter2.id;
    return DEMO_USERS.reporter.id;
  }

  // One media row per seed file (storage_path is unique); the first story's alt text wins.
  const mediaFor = new Map<string, Media>();

  const stories = seedArticles(now);
  stories.forEach((s) => {
    let image: Media | undefined;
    if (s.image) {
      const path = s.image.src.replace(/^\//, "");
      image = mediaFor.get(path);
      if (!image) {
        image = {
          id: randomUUID(), storage_path: path, width: s.image.width, height: s.image.height,
          alt: s.image.alt, caption: s.image.caption ?? "", credit: s.image.credit ?? "",
          focal_x: s.image.focalPoint?.x ?? 0.5, focal_y: s.image.focalPoint?.y ?? 0.5,
          uploaded_by: DEMO_USERS.editor.id, created_at: iso(t - 40 * 24 * HOUR),
        };
        mediaFor.set(path, image);
        db.media.push(image);
      }
    }
    const body = docFromParagraphs(s.body);
    const breaking = s.tags.includes("breaking");
    const authorId = authorIdFor(s.author);
    const article: Article = {
      id: randomUUID(), slug: s.slug, headline: s.title, standfirst: s.standfirst, body,
      body_html: renderBodyHtml(body),
      category_id: (s.category && categoryId.get(s.category)) || null,
      author_id: authorId, featured_image_id: image?.id ?? null,
      status: "published", publish_at: s.publishedAt, featured: s.featured, breaking,
      breaking_until: breaking ? iso(Date.parse(s.publishedAt) + 6 * HOUR) : null,
      seo_title: "", seo_description: "",
      created_by: authorId, updated_by: authorId,
      created_at: s.publishedAt, updated_at: s.publishedAt,
    };
    db.articles.push(article);
    s.tags.forEach((tagName) => {
      if (tagName !== "breaking") {
        db.article_tags.push({ article_id: article.id, tag_id: tag(tagName) });
      }
    });
    if (s.place) db.article_tags.push({ article_id: article.id, tag_id: tag(s.place) });
  });

  // Newsroom workflow items (drafts, scheduled) to populate administrative tabs.
  const notLive: Partial<Article>[] = [
    {
      headline: "Badagry Marina ferry timetable adjustments proposed for weekend passenger service",
      standfirst: "Working draft examining commuter boat frequency and fare structure.",
      category_id: categoryId.get("local-news")!, author_id: DEMO_USERS.reporter.id, status: "draft",
    },
    {
      headline: "Council committee review on Topo jetty rehabilitation and shoreline protection",
      author_id: DEMO_USERS.reporter2.id, status: "draft",
    },
    {
      headline: "Heritage walking tour schedule announced for visiting youth cultural delegations",
      standfirst: "Reporting on visitor reception along the Marina corridor.",
      category_id: categoryId.get("tourism-heritage")!, author_id: DEMO_USERS.reporter.id,
      status: "scheduled", publish_at: iso(t + 20 * HOUR),
    },
    {
      headline: "Agbalata International Market commodity price bulletin archived",
      standfirst: "Archived seasonal commodity price review taken down after new figures.",
      category_id: categoryId.get("business-development")!, author_id: DEMO_USERS.reporter2.id,
      status: "unpublished", publish_at: iso(t - 72 * HOUR),
    },
  ];
  notLive.forEach((a, i) => {
    const body = docFromParagraphs("CityMood draft copy under editorial review. Verified by the newsroom before publication.");
    const stamp = iso(t - (i + 1) * 3 * HOUR);
    db.articles.push({
      id: randomUUID(), slug: `newsroom-${a.status}-${i + 1}`, headline: "", standfirst: "", body,
      body_html: renderBodyHtml(body), category_id: null, author_id: null, featured_image_id: null,
      status: "draft", publish_at: null, featured: false, breaking: false, breaking_until: null,
      seo_title: "", seo_description: "", created_by: a.author_id ?? null, updated_by: a.author_id ?? null,
      created_at: stamp, updated_at: stamp,
      ...a,
    });
  });

  const bySlug = new Map(db.articles.map((a) => [a.slug, a.id]));
  mostReadSlugs.forEach((slug, i) => {
    const id = bySlug.get(slug);
    if (id) db.most_read_picks.push({ position: i + 1, article_id: id });
  });

  return db;
}
