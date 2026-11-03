import type { Article, Category } from "@/lib/content";
import type { ContentSource } from "@/lib/content/types";

/**
 * Stable backend read ports. The current seed/empty adapters implement the
 * smaller ContentSource contract; database-backed repositories can implement
 * these operations without changing public components.
 */
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
