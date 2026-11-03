import { describe, expect, it } from "vitest";
import { isLive } from "../status";
import { ANON, DevDatabase, SERVICE, asUser } from "./database";
import { emptyDatabase } from "./fixtures";

// Mirrors docs/design/admin/rls-tests.sql step for step, against the dev store's
// policies and triggers. If one of these fails, the dev store no longer matches
// schema.sql. Each `it` continues from the state the previous one left, as the
// SQL script does inside its single transaction.

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const EDITOR = "00000000-0000-0000-0000-00000000000e";
const R1 = "00000000-0000-0000-0000-000000000001";
const R2 = "00000000-0000-0000-0000-000000000002";
const INACTIVE = "00000000-0000-0000-0000-000000000009";

const R2_PUBLISHED = "10000000-0000-0000-0000-000000000001";
const R2_DRAFT = "10000000-0000-0000-0000-000000000002";
const R2_FUTURE = "10000000-0000-0000-0000-000000000003";
const R1_DRAFT = "20000000-0000-0000-0000-000000000001";

const HOUR = 3_600_000;

describe("rls-tests.sql, against the dev store", () => {
  const data = emptyDatabase();
  const now = new Date();
  const as = (actor: Parameters<typeof asUser>[0] | "anon" | "service") =>
    new DevDatabase(data, actor === "anon" ? ANON : actor === "service" ? SERVICE : asUser(actor), () => now);
  const localNews = () => data.categories.find((c) => c.slug === "local-news")!.id;

  it("new users start as inactive reporters", () => {
    const service = as("service");
    for (const [id, email] of [
      [ADMIN, "admin@test.local"], [EDITOR, "editor@test.local"], [R1, "reporter1@test.local"],
      [R2, "reporter2@test.local"], [INACTIVE, "inactive@test.local"],
    ]) {
      service.insert("auth_users", { id, email });
    }
    expect(data.profiles.filter((p) => !p.is_active && p.role === "reporter")).toHaveLength(5);
  });

  it("the invite action (service role) sets roles and activates profiles", () => {
    const service = as("service");
    service.update("profiles", (p) => p.id === ADMIN, { is_active: true, role: "admin" });
    service.update("profiles", (p) => p.id === EDITOR, { is_active: true, role: "editor" });
    service.update("profiles", (p) => p.id === R1 || p.id === R2, { is_active: true });
    service.insert("articles", {
      id: R2_PUBLISHED, slug: "r2-published", headline: "R2 published", category_id: localNews(),
      author_id: R2, status: "published", publish_at: new Date(now.getTime() - HOUR).toISOString(),
    });
    service.insert("articles", {
      id: R2_DRAFT, slug: "r2-draft", headline: "R2 draft", category_id: localNews(), author_id: R2, status: "draft",
    });
    service.insert("articles", {
      id: R2_FUTURE, slug: "r2-future", headline: "R2 scheduled", category_id: localNews(), author_id: R2,
      status: "scheduled", publish_at: new Date(now.getTime() + 24 * HOUR).toISOString(),
    });
  });

  it("anon only sees live stories (no drafts, no future schedules)", () => {
    const anon = as("anon");
    expect(anon.select("articles")).toHaveLength(1);
    // live_articles must match the public rule
    expect(anon.select("articles", (a) => isLive(a, now))).toHaveLength(1);
  });

  describe("Reporter 1", () => {
    const r1 = () => as(R1);

    it("creates a draft under their own byline", () => {
      r1().insert("articles", { id: R1_DRAFT, slug: "r1-draft", headline: "R1 draft", author_id: R1 });
    });

    it("cannot write under another byline", () => {
      expect(() => r1().insert("articles", { slug: "r1-as-r2", author_id: R2 })).toThrow();
    });

    it("cannot feature a story", () => {
      expect(() => r1().insert("articles", { slug: "r1-featured", author_id: R1, featured: true })).toThrow();
    });

    it("cannot edit another reporter's story", () => {
      expect(r1().update("articles", (a) => a.id === R2_PUBLISHED, { headline: "hacked" })).toHaveLength(0);
      expect(data.articles.find((a) => a.id === R2_PUBLISHED)!.headline).toBe("R2 published");
    });

    it("publishes their own story as breaking, which gets a 6-hour window", () => {
      r1().update("articles", (a) => a.id === R1_DRAFT, {
        status: "published", publish_at: now.toISOString(), breaking: true,
      });
      const until = data.articles.find((a) => a.id === R1_DRAFT)!.breaking_until!;
      expect(Date.parse(until)).toBeGreaterThan(now.getTime() + 5 * HOUR);
    });

    it("cannot feature their own story", () => {
      expect(() => r1().update("articles", (a) => a.id === R1_DRAFT, { featured: true })).toThrow();
    });

    it("cannot change the slug after publishing", () => {
      expect(() => r1().update("articles", (a) => a.id === R1_DRAFT, { slug: "new-slug" })).toThrow();
    });

    it("cannot delete a published story", () => {
      expect(r1().delete("articles", (a) => a.id === R1_DRAFT)).toHaveLength(0);
    });

    it("sees all stories, including drafts", () => {
      expect(r1().select("articles")).toHaveLength(4);
    });

    it("cannot pin the lead", () => {
      expect(() => r1().insert("front_page_pins", { slot: "lead", article_id: R1_DRAFT })).toThrow();
    });

    it("cannot change roles", () => {
      expect(r1().update("profiles", (p) => p.id === R1, { role: "admin" })).toHaveLength(0);
    });
  });

  describe("Editor", () => {
    it("features and changes bylines on any story", () => {
      const rows = as(EDITOR).update("articles", (a) => a.id === R2_PUBLISHED, { featured: true, author_id: R1 });
      expect(rows).toHaveLength(1);
    });

    it("pins the lead and picks Most read", () => {
      as(EDITOR).insert("front_page_pins", { slot: "lead", article_id: R2_PUBLISHED });
      as(EDITOR).insert("most_read_picks", { position: 1, article_id: R2_PUBLISHED });
    });

    it("cannot create an ad campaign", () => {
      expect(() =>
        as(EDITOR).insert("ad_campaigns", {
          slot: "mpu_1", advertiser_name: "Test", link_url: "https://example.com", alt: "Test",
          starts_at: now.toISOString(), ends_at: new Date(now.getTime() + 24 * HOUR).toISOString(),
        }),
      ).toThrow();
    });
  });

  describe("Admin", () => {
    it("creates campaigns and updates site settings", () => {
      const admin = as(ADMIN);
      admin.insert("ad_campaigns", {
        slot: "mpu_1", advertiser_name: "Running", link_url: "https://example.com", alt: "Running ad",
        starts_at: new Date(now.getTime() - 24 * HOUR).toISOString(),
        ends_at: new Date(now.getTime() + 24 * HOUR).toISOString(),
      });
      admin.insert("ad_campaigns", {
        slot: "billboard", advertiser_name: "Future", link_url: "https://example.com", alt: "Future ad",
        starts_at: new Date(now.getTime() + 48 * HOUR).toISOString(),
        ends_at: new Date(now.getTime() + 9 * 24 * HOUR).toISOString(),
      });
      expect(admin.update("site_settings", () => true, { newsroom_phone: "+234 000 000 0000" })).toHaveLength(1);
    });
  });

  describe("Inactive user", () => {
    it("cannot create a story", () => {
      expect(() => as(INACTIVE).insert("articles", { slug: "inactive", author_id: INACTIVE })).toThrow();
    });

    it("only sees live stories", () => {
      // R2's published story and Reporter 1's story published above
      expect(as(INACTIVE).select("articles")).toHaveLength(2);
    });
  });

  it("readers only see running ads", () => {
    expect(as("anon").select("ad_campaigns")).toHaveLength(1);
  });
});
