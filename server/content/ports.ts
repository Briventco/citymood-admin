import type { Article, Category } from "@/lib/content";
import type { ContentSource } from "@/lib/content/types";

/** Read operations on top of ContentSource, implemented by server/content/supabase.ts. */
export type PublishedArticleQuery = {
  categorySlug?: string;
  cursor?: string;
  limit?: number;
  search?: string;
};

export type PublishedArticlePage = {
  items: Article[];
  nextCursor: string | null;
};

export type ContentRepository = ContentSource & {
  publishedArticle(idOrSlug: string): Promise<Article | null>;
  publishedArticles(query?: PublishedArticleQuery): Promise<PublishedArticlePage>;
  categoriesForNavigation(): Promise<Category[]>;
};
