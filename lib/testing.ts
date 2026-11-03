import type { Article } from "@/lib/content";

// Test helper: a minimal published article, overridable per test.
let n = 0;
export function makeArticle(overrides: Partial<Article> = {}): Article {
  n += 1;
  return {
    id: `t${n}`,
    slug: `story-${n}`,
    title: `Story ${n}`,
    standfirst: "Standfirst.",
    body: "Body.",
    image: { src: `/seed/landscape-1.jpg`, alt: "Alt", width: 1800, height: 1200 },
    category: "local-news",
    tags: [],
    author: "Test Author",
    publishedAt: "2026-10-12T09:00:00.000Z",
    featured: false,
    ...overrides,
  };
}
