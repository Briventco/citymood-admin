import type { Article } from "@/lib/content";

// URL scheme for routes that are not built yet (OPEN_QUESTIONS #10).
// Links to them use prefetch={false}: prefetching would 404 today, and on mobile
// data it would download every visible story in the background. Revisit once
// the routes exist.
export const articleHref = (article: Pick<Article, "slug" | "category">) =>
  `/${article.category ?? "news"}/${article.slug}`;

export const categoryHref = (slug: string) => `/${slug}`;
