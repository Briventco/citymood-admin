import { describe, expect, it } from "vitest";
import { UNTITLED, articleStatus, bodyColumns, dbStatuses, filterTerm, staffRole, toArticle, toCampaign, toMedia, type ArticleRow, type CampaignRow, type MediaRow } from "./map";

const row = (over: Partial<ArticleRow> = {}): ArticleRow => ({
  id: "a", slug: "s", title: "Headline", standfirst: "", body: "One.\r\n\r\nTwo.", body_doc: null, body_html: "",
  category_id: null, author_id: "u", featured_image_id: null, status: "published",
  published_at: "2026-11-01T09:00:00.000Z", scheduled_for: null, featured: false, breaking: false, breaking_until: null,
  seo_title: "", seo_description: "", created_at: "2026-11-01T08:00:00.000Z", updated_at: "2026-11-01T09:00:00.000Z",
  ...over,
});

describe("article mapping", () => {
  it("folds statuses the portal has no tab for", () => {
    expect(articleStatus("in_review")).toBe("draft");
    expect(articleStatus("archived")).toBe("unpublished");
    expect(articleStatus("scheduled")).toBe("scheduled");
    expect(dbStatuses("draft")).toEqual(["draft", "in_review"]);
    expect(dbStatuses("unpublished")).toEqual(["unpublished", "archived"]);
  });

  it("reads publish_at from the column that matches the status", () => {
    expect(toArticle(row()).publish_at).toBe("2026-11-01T09:00:00.000Z");
    const scheduled = row({ status: "scheduled", published_at: null, scheduled_for: "2026-12-01T09:00:00.000Z" });
    expect(toArticle(scheduled).publish_at).toBe("2026-12-01T09:00:00.000Z");
  });

  it("opens a live plain-text story as paragraphs, including Windows line breaks", () => {
    const { body, body_html } = toArticle(row());
    expect(body.content).toHaveLength(2);
    expect(body_html).toBe("<p>One.</p><p>Two.</p>");
  });

  it("prefers the saved rich text", () => {
    const body_doc = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi" }] }] };
    expect(toArticle(row({ body_doc })).body).toEqual(body_doc);
  });

  it("hides the placeholder title on drafts only", () => {
    expect(toArticle(row({ title: UNTITLED, status: "draft" })).headline).toBe("");
    expect(toArticle(row({ title: UNTITLED })).headline).toBe(UNTITLED);
  });

  it("keeps body as plain text for the public site, and sizes the read", () => {
    const words = Array(401).fill("word").join(" ");
    const cols = bodyColumns({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: words, marks: [{ type: "bold" }] }] }] });
    expect(cols.body).toBe(words);
    expect(cols.body_html).toContain("<strong>");
    expect(cols.reading_minutes).toBe(3);
  });
});

describe("media mapping", () => {
  it("fills nullable columns and turns numeric strings into numbers", () => {
    const m = toMedia({ id: "m", storage_path: "p", width: 1, height: 1, alt_text: "a", caption: null, credit: null, focal_x: null, focal_y: "0.25" as unknown as number, created_by: null, created_at: "t" } satisfies MediaRow);
    expect(m).toMatchObject({ caption: "", credit: "", focal_x: 0.5, focal_y: 0.25, alt: "a" });
  });
});

describe("campaign mapping", () => {
  const c = (over: Partial<CampaignRow> = {}): CampaignRow => ({
    id: "c", name: "Acme", slot: "mpu", media_id: "m", image_mobile_id: null, alt_text: "a", destination_url: "https://x.invalid",
    starts_at: "2026-11-01T00:00:00.000Z", ends_at: "2026-12-01T00:00:00.000Z", active: true, created_by: "u",
    created_at: "2026-11-01T00:00:00.000Z", updated_at: "2026-11-02T00:00:00.000Z", ...over,
  });

  it("maps the old mpu slot and the renamed columns", () => {
    expect(toCampaign(c())).toMatchObject({ slot: "mpu_1", advertiser_name: "Acme", image_desktop_id: "m", link_url: "https://x.invalid" });
    expect(toCampaign(c({ slot: "mpu_2" })).slot).toBe("mpu_2");
  });

  it("shows a switched-off campaign as ended", () => {
    expect(toCampaign(c({ active: false })).ends_at).toBe("2026-11-02T00:00:00.000Z");
  });
});

describe("roles", () => {
  it("picks the strongest live role", () => {
    expect(staffRole(["reporter", "administrator"])).toBe("admin");
    expect(staffRole(["editor", "reporter"])).toBe("editor");
    expect(staffRole(["ad_manager"])).toBe("reporter");
    expect(staffRole([])).toBeNull();
  });
});

describe("filterTerm", () => {
  it("strips what would break out of a PostgREST or() filter", () => {
    expect(filterTerm('a,status.eq.draft)*"')).toBe("a status.eq.draft");
  });
});
