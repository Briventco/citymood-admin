"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invalid } from "@/lib/admin/errors";
import type { ArticleDetail, ArticleWrite, MediaWrite } from "@/lib/admin/repo";
import { normalizeDoc } from "@/lib/admin/richtext";
import { staffAction } from "@/lib/admin/session";
import { lagosToIso } from "@/lib/admin/time";
import type { RichTextNode } from "@/lib/admin/types";

// Editor actions. The client sends the whole draft; the server sends on only the
// fields that changed, so a reporter's save never "touches" featured or the
// byline (which the data layer would refuse).

export type DraftInput = {
  headline: string;
  standfirst: string;
  body: RichTextNode;
  category_id: string | null;
  author_id: string | null;
  featured_image_id: string | null;
  featured: boolean;
  breaking: boolean;
  seo_title: string;
  seo_description: string;
  slug: string;
  tags: string[];
};

export type ImageMeta = { id: string } & MediaWrite;

export type When = { mode: "now" } | { mode: "schedule"; date: string; time: string };

export type SaveResult = { detail: ArticleDetail; imageError?: string };

const FIELDS = [
  "headline", "standfirst", "category_id", "author_id", "featured_image_id",
  "featured", "breaking", "seo_title", "seo_description", "slug",
] as const;

function changes(draft: DraftInput, current: ArticleDetail | null): ArticleWrite {
  const patch: ArticleWrite = {};
  for (const key of FIELDS) {
    const value = draft[key];
    if (!current || current.article[key] !== value) (patch as Record<string, unknown>)[key] = value;
  }
  // New stories leave the slug to the server when it's empty, and the byline to the signed-in user.
  if (!current && !draft.slug) delete patch.slug;
  if (!current && !draft.author_id) delete patch.author_id;
  const body = normalizeDoc(draft.body);
  if (!current || JSON.stringify(current.article.body) !== JSON.stringify(body)) patch.body = body;
  const tags = draft.tags.map((t) => t.trim()).filter(Boolean);
  const before = current?.tags.map((t) => t.name) ?? [];
  if (!current || tags.join("\u0000") !== before.join("\u0000")) patch.tags = tags;
  return patch;
}

/** Saves the draft (creating it on first save) and the photo's details. */
export async function saveArticle(id: string | null, draft: DraftInput, image?: ImageMeta) {
  return staffAction(async ({ repo }): Promise<SaveResult> => {
    let imageError: string | undefined;
    if (image) {
      try {
        const { id: mediaId, ...meta } = image;
        await repo.updateMedia(mediaId, meta);
      } catch (e) {
        imageError = e instanceof Error ? e.message : "The photo details weren’t saved.";
      }
    }
    const current = id ? await repo.getArticle(id) : null;
    if (id && !current) throw invalid("This story was deleted, so it can’t be saved.");
    const patch = changes(draft, current);
    const detail = current
      ? Object.keys(patch).length
        ? await repo.updateArticle(current.article.id, patch)
        : current
      : await repo.createArticle(patch);
    // Only live stories affect the public site. (Revalidating also re-renders the editor route.)
    if (detail.live) revalidatePath("/", "layout");
    return { detail, imageError };
  });
}

export async function publishArticle(id: string, when: When) {
  return staffAction(async ({ repo }) => {
    let at: string | null = null;
    if (when.mode === "schedule") {
      at = lagosToIso(when.date, when.time);
      if (!at) throw invalid("Enter a date and time to schedule it.");
    }
    const detail = await repo.publishArticle(id, at);
    revalidatePath("/", "layout");
    return detail;
  });
}

export async function unpublishArticle(id: string) {
  return staffAction(async ({ repo }) => {
    const detail = await repo.unpublishArticle(id);
    revalidatePath("/", "layout");
    return detail;
  });
}

export async function deleteArticle(id: string) {
  const result = await staffAction(async ({ repo }) => {
    await repo.deleteArticle(id);
    revalidatePath("/", "layout");
    return undefined;
  });
  if (result.ok) redirect("/admin/articles?deleted=1");
  return result;
}
