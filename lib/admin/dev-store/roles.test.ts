import { beforeEach, describe, expect, it } from "vitest";
import type { NewsroomRepo } from "../repo";
import { ANON, SERVICE, DevDatabase, asUser } from "./database";
import { emptyDatabase } from "./fixtures";
import { createDevPublicReader, createDevRepo } from "./repo";
import { memoryStore, type DevStore } from "./store";

// ADMIN_SPEC §2 role rules, exercised through the same repo the screens use.
// The rules live in the data layer (policies.ts and triggers.ts), so these calls
// would fail the same way if a server action skipped the UI.

const ADMIN = "a0000000-0000-4000-8000-00000000000a";
const EDITOR = "a0000000-0000-4000-8000-00000000000e";
const R1 = "a0000000-0000-4000-8000-000000000001";
const R2 = "a0000000-0000-4000-8000-000000000002";
const HOUR = 3_600_000;

let store: DevStore;
let clock: Date;
const repo = (uid: string): NewsroomRepo => createDevRepo(store, asUser(uid), () => clock);
const categoryId = async () => (await repo(ADMIN).listCategories())[0].id;

beforeEach(() => {
  clock = new Date("2026-10-23T09:00:00.000Z");
  const data = emptyDatabase();
  const service = new DevDatabase(data, SERVICE, () => clock);
  for (const [id, role, name] of [
    [ADMIN, "admin", "Admin Person"], [EDITOR, "editor", "Editor Person"],
    [R1, "reporter", "Reporter One"], [R2, "reporter", "Reporter Two"],
  ] as const) {
    service.insert("auth_users", { id, email: `${role}-${id.slice(-1)}@test.local`, raw_user_meta_data: { full_name: name } });
    service.update("profiles", (p) => p.id === id, { role, is_active: true, full_name: name });
  }
  store = memoryStore(data);
});

async function storyBy(uid: string, extra: Parameters<NewsroomRepo["createArticle"]>[0] = {}) {
  return (await repo(uid).createArticle({ headline: "A test story", category_id: await categoryId(), ...extra })).article;
}

const rejects = (p: Promise<unknown>) => expect(p).rejects.toMatchObject({ code: expect.any(String) });

describe("Reporter", () => {
  it("creates, edits and publishes their own story, and marks it breaking", async () => {
    const a = await storyBy(R1);
    expect(a.author_id).toBe(R1);
    await repo(R1).updateArticle(a.id, { standfirst: "Updated.", breaking: true });
    const published = await repo(R1).publishArticle(a.id, null);
    expect(published.live).toBe(true);
    expect(Date.parse(published.article.breaking_until!)).toBe(clock.getTime() + 6 * HOUR);
  });

  it("cannot feature, change the byline, or edit someone else's story", async () => {
    const own = await storyBy(R1);
    const theirs = await storyBy(R2);
    await expect(repo(R1).updateArticle(own.id, { featured: true })).rejects.toMatchObject({ code: "forbidden" });
    await expect(repo(R1).updateArticle(own.id, { author_id: R2 })).rejects.toMatchObject({ code: "forbidden" });
    await expect(repo(R1).updateArticle(theirs.id, { headline: "Hacked" })).rejects.toMatchObject({ code: "forbidden" });
    expect((await repo(R2).getArticle(theirs.id))!.article.headline).toBe("A test story");
  });

  it("sees everyone's stories but can only edit their own", async () => {
    const theirs = await storyBy(R2);
    const view = await repo(R1).getArticle(theirs.id);
    expect(view).not.toBeNull();
    expect(view!.can_edit).toBe(false);
    expect((await repo(R1).listArticles({})).total).toBe(1);
  });

  it("deletes their own drafts, but not published stories", async () => {
    const draft = await storyBy(R1);
    await repo(R1).deleteArticle(draft.id);
    expect(await repo(R1).getArticle(draft.id)).toBeNull();

    const live = await storyBy(R1);
    await repo(R1).publishArticle(live.id, null);
    await expect(repo(R1).deleteArticle(live.id)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("cannot unpublish a live story (editors do that)", async () => {
    const a = await storyBy(R1);
    await repo(R1).publishArticle(a.id, null);
    await expect(repo(R1).unpublishArticle(a.id)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("can take their own scheduled story back to draft", async () => {
    const a = await storyBy(R1);
    await repo(R1).publishArticle(a.id, new Date(clock.getTime() + 2 * HOUR).toISOString());
    expect((await repo(R1).unpublishArticle(a.id)).article.status).toBe("draft");
  });

  it("uploads photos and edits their own photo details, but not other people's, and cannot delete", async () => {
    const own = await repo(R1).createMedia({ storage_path: "2026/10/own.webp", width: 2000, height: 1333 });
    await repo(R1).updateMedia(own.id, { alt: "A boat on the lagoon" });
    const theirs = await repo(EDITOR).createMedia({ storage_path: "2026/10/theirs.webp", width: 10, height: 10 });
    await expect(repo(R1).updateMedia(theirs.id, { alt: "x" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(repo(R1).deleteMedia(own.id)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("cannot run the front page, tags, staff, categories, ads or settings", async () => {
    const a = await storyBy(EDITOR);
    await repo(EDITOR).publishArticle(a.id, null);
    const r = repo(R1);
    await expect(r.setPin("lead", a.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(r.setPin("lead", null)).rejects.toMatchObject({ code: "forbidden" });
    await expect(r.arrangeTopStories([a.id, null, null, null])).rejects.toMatchObject({ code: "forbidden" });
    await expect(r.setMostRead([a.id])).rejects.toMatchObject({ code: "forbidden" });
    await rejects(r.listStaff());
    await rejects(r.inviteStaff({ email: "new@test.local", full_name: "New", role: "admin" }));
    await rejects(r.createCategory("New section"));
    await rejects(r.updateSettings({ newsroom_phone: "1" }));
    await rejects(
      r.createCampaign({
        slot: "mpu_1", advertiser_name: "X", image_desktop_id: null, image_mobile_id: null,
        link_url: "https://example.com", alt: "X", starts_at: clock.toISOString(),
        ends_at: new Date(clock.getTime() + HOUR).toISOString(),
      }),
    );
    const tags = await repo(EDITOR).updateArticle(a.id, { tags: ["Ajido"] });
    await expect(r.renameTag(tags.tags[0].id, "Ajido town")).rejects.toMatchObject({ code: "forbidden" });
    await expect(r.deleteTag(tags.tags[0].id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("Editor", () => {
  it("edits, features, re-bylines and unpublishes any story", async () => {
    const a = await storyBy(R1);
    await repo(R1).publishArticle(a.id, null);
    const e = repo(EDITOR);
    await e.updateArticle(a.id, { headline: "Edited by the desk", featured: true, author_id: R2 });
    const after = await e.unpublishArticle(a.id);
    expect(after.article).toMatchObject({ headline: "Edited by the desk", featured: true, author_id: R2, status: "unpublished" });
  });

  it("runs the front page and Most read, and ends breaking items", async () => {
    const a = await storyBy(R1, { breaking: true });
    await repo(R1).publishArticle(a.id, null);
    const e = repo(EDITOR);
    await e.setPin("lead", a.id);
    await e.setMostRead([a.id]);
    expect((await e.getFrontPage()).pins).toHaveLength(1);
    expect(await e.listBreaking()).toHaveLength(1);
    await e.endBreaking(a.id);
    expect(await e.listBreaking()).toHaveLength(0);
  });

  it("deletes stories and media", async () => {
    const a = await storyBy(R1);
    await repo(R1).publishArticle(a.id, null);
    await repo(EDITOR).deleteArticle(a.id);
    const m = await repo(R1).createMedia({ storage_path: "2026/10/x.webp", width: 1, height: 1 });
    await repo(EDITOR).deleteMedia(m.id);
    expect(await repo(EDITOR).getMedia(m.id)).toBeNull();
  });

  it("cannot manage staff, categories, ads or settings", async () => {
    const e = repo(EDITOR);
    await rejects(e.listStaff());
    await rejects(e.updateStaff(R1, { role: "editor" }));
    await rejects(e.createCategory("New section"));
    await rejects(e.updateSettings({ newsroom_phone: "1" }));
    await rejects(
      e.createCampaign({
        slot: "billboard", advertiser_name: "X", image_desktop_id: null, image_mobile_id: null,
        link_url: "https://example.com", alt: "X", starts_at: clock.toISOString(),
        ends_at: new Date(clock.getTime() + HOUR).toISOString(),
      }),
    );
  });
});

describe("Admin", () => {
  it("invites staff, who start active with the chosen role", async () => {
    const m = await repo(ADMIN).inviteStaff({ email: "New@Test.local", full_name: "New Person", role: "editor" });
    expect(m).toMatchObject({ email: "new@test.local", role: "editor", is_active: true, last_sign_in_at: null });
  });

  it("deactivating someone ends their access but keeps their stories", async () => {
    const a = await storyBy(R1);
    await repo(ADMIN).updateStaff(R1, { is_active: false });
    expect(await repo(R1).me()).toBeNull();
    await expect(repo(R1).updateArticle(a.id, { headline: "x" })).rejects.toMatchObject({ code: "unauthenticated" });
    expect((await repo(ADMIN).getArticle(a.id))!.article.author_id).toBe(R1);
  });

  it("cannot remove themselves or change their own role", async () => {
    await expect(repo(ADMIN).updateStaff(ADMIN, { is_active: false })).rejects.toMatchObject({ code: "invalid" });
    await expect(repo(ADMIN).updateStaff(ADMIN, { role: "editor" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("manages categories, ads and settings", async () => {
    const a = repo(ADMIN);
    const c = await a.createCategory("Sport");
    await a.updateCategory(c.id, { is_active: false });
    await a.updateSettings({ newsroom_phone: "+234 000 000 0000" });
    await a.createCampaign({
      slot: "leaderboard", advertiser_name: "Fake Advertiser", image_desktop_id: null, image_mobile_id: null,
      link_url: "https://example.com", alt: "Fake advert", starts_at: clock.toISOString(),
      ends_at: new Date(clock.getTime() + HOUR).toISOString(),
    });
    expect((await createDevPublicReader(store).runningCampaigns(clock)).length).toBe(1);
  });
});

describe("Publishing rules", () => {
  it("needs a headline, a category, and alt text when there is a photo", async () => {
    const r = repo(R1);
    const noCategory = (await r.createArticle({ headline: "No category" })).article;
    await expect(r.publishArticle(noCategory.id, null)).rejects.toMatchObject({ code: "invalid" });

    const photo = await r.createMedia({ storage_path: "2026/10/p.webp", width: 10, height: 10 });
    const withPhoto = await storyBy(R1, { featured_image_id: photo.id });
    await expect(r.publishArticle(withPhoto.id, null)).rejects.toThrow(/alt text/);
    await r.updateMedia(photo.id, { alt: "Fishing boats at the jetty" });
    expect((await r.publishArticle(withPhoto.id, null)).live).toBe(true);
  });

  it("a scheduled story goes live when its time comes, with no background job", async () => {
    const a = await storyBy(R1);
    const at = new Date(clock.getTime() + 2 * HOUR).toISOString();
    await repo(R1).publishArticle(a.id, at);
    const reader = createDevPublicReader(store);
    expect(await reader.liveArticles(clock)).toHaveLength(0);
    expect(await reader.liveArticles(new Date(clock.getTime() + 2 * HOUR))).toHaveLength(1);
  });

  it("rejects a schedule in the past", async () => {
    const a = await storyBy(R1);
    await expect(repo(R1).publishArticle(a.id, new Date(clock.getTime() - HOUR).toISOString())).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("starts the 6-hour breaking window at go-live, not when the switch was flipped", async () => {
    const a = await storyBy(R1, { breaking: true });
    const goLive = new Date(clock.getTime() + 3 * HOUR).toISOString();
    await repo(R1).publishArticle(a.id, goLive);
    const after = (await repo(R1).getArticle(a.id))!.article;
    expect(after.breaking_until).toBe(new Date(Date.parse(goLive) + 6 * HOUR).toISOString());
  });

  it("locks the web address after publishing", async () => {
    const a = await storyBy(R1);
    await repo(R1).publishArticle(a.id, null);
    await expect(repo(R1).updateArticle(a.id, { slug: "something-else" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("keeps web addresses unique while drafting", async () => {
    const first = await storyBy(R1, { headline: "Same headline" });
    const second = await storyBy(R2, { headline: "Same headline" });
    expect(first.slug).toBe("same-headline");
    expect(second.slug).toBe("same-headline-2");
  });

  it("stores sanitized HTML for the story body", async () => {
    const a = await storyBy(R1, {
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "<script>x</script>", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
          { type: "codeBlock", content: [{ type: "text", text: "kept as text" }] },
        ],
      },
    });
    expect(a.body_html).toBe("<p>&lt;script&gt;x&lt;/script&gt;</p><p>kept as text</p>");
  });
});

describe("Readers (anon)", () => {
  it("never see drafts, future schedules or staff details", async () => {
    await storyBy(R1);
    const reader = createDevPublicReader(store);
    expect(await reader.liveArticles(clock)).toHaveLength(0);
    const anon = createDevRepo(store, ANON, () => clock);
    expect(await anon.me()).toBeNull();
    await expect(anon.listArticles({})).rejects.toMatchObject({ code: "unauthenticated" });
  });
});
