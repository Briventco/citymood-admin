import { describe, expect, it } from "vitest";
import { makeArticle } from "@/lib/testing";
import { publishedNewestFirst, selectBreaking } from "./index";

const now = new Date("2026-10-12T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

describe("publishedNewestFirst", () => {
  it("drops scheduled articles and sorts newest first", () => {
    const old = makeArticle({ publishedAt: hoursAgo(5) });
    const fresh = makeArticle({ publishedAt: hoursAgo(1) });
    const future = makeArticle({ publishedAt: hoursAgo(-1) });
    expect(publishedNewestFirst([old, future, fresh], now)).toEqual([fresh, old]);
  });
});

describe("selectBreaking", () => {
  it("keeps only breaking-tagged articles inside the expiry window", () => {
    const inside = makeArticle({ tags: ["breaking"], publishedAt: hoursAgo(5.9) });
    const expired = makeArticle({ tags: ["breaking"], publishedAt: hoursAgo(6.1) });
    const untagged = makeArticle({ publishedAt: hoursAgo(1) });
    expect(selectBreaking([untagged, inside, expired], now, 6, 5)).toEqual([inside]);
  });

  it("caps the list at the maximum, keeping the newest", () => {
    const items = [1, 2, 3, 4, 5, 6].map((h) => makeArticle({ tags: ["breaking"], publishedAt: hoursAgo(h / 2) }));
    expect(selectBreaking(items, now, 6, 5)).toEqual(items.slice(0, 5));
  });

  it("returns nothing when no article is breaking, so the ticker is hidden", () => {
    expect(selectBreaking([makeArticle()], now)).toEqual([]);
  });
});

describe("selectBreaking with newsroom windows", () => {
  it("uses breakingUntil when the newsroom sets it", () => {
    const live = makeArticle({ breakingUntil: hoursAgo(-1), publishedAt: hoursAgo(10) });
    const ended = makeArticle({ breakingUntil: hoursAgo(0.5), publishedAt: hoursAgo(1) });
    const off = makeArticle({ breakingUntil: null, tags: ["breaking"], publishedAt: hoursAgo(1) });
    expect(selectBreaking([live, ended, off], now)).toEqual([live]);
  });
});
