"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ArticleDetail, Permissions } from "@/lib/admin/repo";
import { emptyDoc, wordCount } from "@/lib/admin/richtext";
import { effectiveStatus } from "@/lib/admin/status";
import { slugify } from "@/lib/admin/text";
import { isoToLagos } from "@/lib/admin/time";
import type { ArticleStatus, Media, RichTextNode } from "@/lib/admin/types";
import { deleteArticle, publishArticle, saveArticle, unpublishArticle, type DraftInput, type When } from "../actions";
import type { ImageMetaPatch } from "../../../_components/FocalPicker";

// Editor state and the save rules:
// - Drafts (and unpublished stories) autosave every 10 seconds and when a field
//   loses focus, showing "Saved X ago".
// - Live and scheduled stories don't autosave, so half-finished edits never go
//   out; they show "Unsaved changes" until Update.
// - Leaving with unsaved changes asks first (tab close) or saves first (links).

export type EditorData = {
  detail: ArticleDetail | null;
  categories: { id: string; name: string; slug: string; is_active: boolean }[];
  authors: { id: string; full_name: string }[];
  tagSuggestions: string[];
  me: { id: string; full_name: string };
  can: Permissions;
  siteHost: string;
  initialMobile: boolean;
};

export type CheckItem = { key: string; label: string; done: boolean; required: boolean; fix?: string };

const AUTOSAVE_MS = 10_000;

// A story created on /new gets its id in the URL without a navigation. The next
// revalidation (publishing) re-renders that URL as a different route segment,
// which remounts the editor, so the confirmation is carried across in
// sessionStorage.
const flashKey = (id: string) => `cm-editor-notice:${id}`;
function readFlash(id: string | undefined): string | null {
  if (!id || typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(flashKey(id));
  } catch {
    return null;
  }
}

function nextHourInLagos(): { date: string; time: string } {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setUTCMinutes(0, 0, 0);
  return isoToLagos(d.toISOString());
}

function draftFrom(detail: ArticleDetail | null, me: EditorData["me"]): DraftInput {
  const a = detail?.article;
  return {
    headline: a?.headline ?? "",
    standfirst: a?.standfirst ?? "",
    body: (a?.body as RichTextNode) ?? emptyDoc(),
    category_id: a?.category_id ?? null,
    author_id: a?.author_id ?? me.id,
    featured_image_id: a?.featured_image_id ?? null,
    featured: a?.featured ?? false,
    breaking: a?.breaking ?? false,
    seo_title: a?.seo_title ?? "",
    seo_description: a?.seo_description ?? "",
    slug: a?.slug ?? "",
    tags: detail?.tags.map((t) => t.name) ?? [],
  };
}

export function useArticleDraft(data: EditorData) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftInput>(() => draftFrom(data.detail, data.me));
  const [image, setImageState] = useState<Media | null>(data.detail?.image ?? null);
  const [server, setServer] = useState(() => ({
    id: data.detail?.article.id ?? null,
    status: (data.detail?.article.status ?? "draft") as ArticleStatus,
    publish_at: data.detail?.article.publish_at ?? null,
    live: data.detail?.live ?? false,
    can_delete: data.detail?.can_delete ?? false,
    savedSlug: data.detail?.article.slug ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(data.detail?.article.updated_at ?? null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => readFlash(data.detail?.article.id));
  const createdHere = useRef(false);
  useEffect(() => {
    const id = data.detail?.article.id;
    try {
      if (id) window.sessionStorage.removeItem(flashKey(id));
    } catch {
      // Storage blocked: the message just won't survive the remount.
    }
  }, [data.detail?.article.id]);
  const [showErrors, setShowErrors] = useState(false);
  const [words, setWords] = useState(() => wordCount(data.detail?.article.body as RichTextNode));
  const [slugTouched, setSlugTouched] = useState(!!data.detail && data.detail.article.slug !== slugify(data.detail.article.headline));
  const [when, setWhen] = useState<When>(() => {
    const a = data.detail?.article;
    if (a?.status === "scheduled" && a.publish_at && !data.detail?.live) return { mode: "schedule", ...isoToLagos(a.publish_at) };
    return { mode: "now" };
  });
  const [busy, setBusy] = useState<null | "publish" | "unpublish" | "delete">(null);

  // Refs so timers and listeners always see the latest values.
  const latest = useRef({ draft, image, dirty, imageDirty: false, version: 0, id: server.id });
  useLayoutEffect(() => {
    Object.assign(latest.current, { draft, image, dirty, id: server.id });
  });
  const inflight = useRef<Promise<boolean> | null>(null);

  const status = effectiveStatus(server, new Date());
  const slugLocked = server.status !== "draft";
  const autosave = server.status === "draft" || server.status === "unpublished";

  const touch = useCallback(() => {
    latest.current.version += 1;
    setDirty(true);
    setNotice(null);
  }, []);

  const update = useCallback(
    (patch: Partial<DraftInput>) => {
      setDraft((d) => {
        const next = { ...d, ...patch };
        // The slug follows the headline until someone edits it or the story is published.
        if (patch.headline !== undefined && !slugTouched && !slugLocked) next.slug = slugify(patch.headline);
        return next;
      });
      touch();
    },
    [slugLocked, slugTouched, touch],
  );

  const setSlug = (slug: string) => {
    setSlugTouched(true);
    update({ slug: slugify(slug, 120) || slug.toLowerCase() });
  };

  const setBody = (body: RichTextNode, count: number) => {
    setWords(count);
    update({ body });
  };

  const setImage = (media: Media | null) => {
    setImageState(media);
    latest.current.imageDirty = false;
    update({ featured_image_id: media?.id ?? null });
  };

  const setImageMeta = (patch: ImageMetaPatch) => {
    setImageState((m) => (m ? { ...m, ...patch } : m));
    latest.current.imageDirty = true;
    touch();
  };

  const hasContent = (d: DraftInput) => !!(d.headline.trim() || d.standfirst.trim() || d.featured_image_id || wordCount(d.body));

  /** One save at a time: the blur autosave and a Publish click often overlap. */
  const saveOnce = useCallback(async (): Promise<boolean> => {
    const l = latest.current;
    if (!l.dirty && !l.imageDirty) return true;
    if (!l.id && !hasContent(l.draft)) return true;
    setSaving(true);
    const version = l.version;
    const img = l.imageDirty && l.image ? l.image : null;
    const result = await saveArticle(l.id, l.draft, img ? { id: img.id, alt: img.alt, caption: img.caption, credit: img.credit, focal_x: img.focal_x, focal_y: img.focal_y } : undefined);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    const { detail, imageError } = result.data;
    setError(imageError ?? null);
    if (img && !imageError) latest.current.imageDirty = false;
    if (!l.id) {
      window.history.replaceState(null, "", `/admin/articles/${detail.article.id}`);
      createdHere.current = true;
    }
    // Set now, not after the re-render, so a publish that follows this save sees the new id.
    latest.current.id = detail.article.id;
    setServer({
      id: detail.article.id,
      status: detail.article.status,
      publish_at: detail.article.publish_at,
      live: detail.live,
      can_delete: detail.can_delete,
      savedSlug: detail.article.slug,
    });
    // The server may have made the web address unique ("-2").
    setDraft((d) => (d.slug === l.draft.slug && d.slug !== detail.article.slug ? { ...d, slug: detail.article.slug } : d));
    setSavedAt(detail.article.updated_at);
    if (latest.current.version === version) {
      latest.current.dirty = false;
      setDirty(false);
    }
    return !imageError;
  }, []);

  /** Saves if there is anything to save, after any save already running. Resolves true when everything is saved. */
  const save = useCallback(async (): Promise<boolean> => {
    while (inflight.current) await inflight.current;
    const run = saveOnce();
    inflight.current = run;
    try {
      return await run;
    } finally {
      if (inflight.current === run) inflight.current = null;
    }
  }, [saveOnce]);

  // Autosave: every 10 seconds while there are changes.
  useEffect(() => {
    if (!autosave) return;
    const t = setInterval(() => void save(), AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [autosave, save]);

  const onFieldBlur = () => {
    if (autosave) void save();
  };

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (latest.current.dirty || latest.current.imageDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  // In-app links: save first (drafts), or ask (live stories).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const l = latest.current;
      if (!(l.dirty || l.imageDirty) || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      if (autosave) {
        void save().then((ok) => {
          if (ok || window.confirm("Your latest changes weren’t saved. Leave anyway?")) router.push(a.href);
        });
      } else if (window.confirm("You have unsaved changes. Leave without updating the story?")) {
        router.push(a.href);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [autosave, save, router]);

  const checklist: CheckItem[] = useMemo(() => {
    const items: CheckItem[] = [
      { key: "headline", label: "Headline", done: !!draft.headline.trim(), required: true, fix: "headline" },
      { key: "category", label: "Category", done: !!draft.category_id, required: true, fix: "category" },
      { key: "standfirst", label: "Standfirst", done: !!draft.standfirst.trim(), required: false, fix: "standfirst" },
      { key: "image", label: "Featured image", done: !!image, required: false },
    ];
    if (image) items.push({ key: "alt", label: image.alt.trim() ? "Image alt text" : "Image alt text missing", done: !!image.alt.trim(), required: true, fix: "image-alt" });
    items.push({ key: "seo", label: "Search description", done: !!draft.seo_description.trim(), required: false, fix: "seo-description" });
    return items;
  }, [draft, image]);

  const missing = checklist.filter((c) => c.required && !c.done);

  async function publish(): Promise<void> {
    setShowErrors(true);
    setNotice(null);
    if (missing.length) {
      setError(`Before publishing, add: ${missing.map((m) => m.label.replace(" missing", "").toLowerCase()).join(", ")}.`);
      if (missing[0].fix) document.getElementById(missing[0].fix)?.focus();
      return;
    }
    setBusy("publish");
    const saved = await save();
    const id = latest.current.id;
    if (!saved || !id) {
      setBusy(null);
      return;
    }
    const result = await publishArticle(id, when);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    applyDetail(result.data);
    setError(null);
    flash(
      result.data.live
        ? "Published. It’s live on the site now."
        : `Scheduled for ${when.mode === "schedule" ? `${when.date.split("-").reverse().join("/")} at ${when.time}` : ""} Lagos time. It goes live on its own.`,
    );
  }

  async function unpublish(): Promise<void> {
    const id = latest.current.id;
    if (!id) return;
    setBusy("unpublish");
    const result = await unpublishArticle(id);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    applyDetail(result.data);
    setWhen({ mode: "now" });
    flash(result.data.article.status === "draft" ? "Schedule cancelled. The story is a draft again." : "Unpublished. It’s no longer on the site.");
  }

  async function remove(): Promise<string | null> {
    const id = latest.current.id;
    if (!id) {
      router.push("/admin/articles");
      return null;
    }
    setBusy("delete");
    latest.current.dirty = false;
    latest.current.imageDirty = false;
    const result = await deleteArticle(id);
    setBusy(null);
    return result && !result.ok ? result.error : null;
  }

  function flash(text: string) {
    setNotice(text);
    const id = latest.current.id;
    if (!createdHere.current || !id) return;
    try {
      window.sessionStorage.setItem(flashKey(id), text);
    } catch {
      // Storage blocked: the message just won't survive the remount.
    }
  }

  function applyDetail(detail: ArticleDetail) {
    setServer({
      id: detail.article.id,
      status: detail.article.status,
      publish_at: detail.article.publish_at,
      live: detail.live,
      can_delete: detail.can_delete,
      savedSlug: detail.article.slug,
    });
    setSavedAt(detail.article.updated_at);
    setDraft((d) => ({ ...d, slug: detail.article.slug }));
  }

  async function preview(): Promise<void> {
    // Open the tab now (before awaiting) so pop-up blockers allow it.
    const tab = window.open("about:blank", "_blank");
    await save();
    const id = latest.current.id;
    if (!id) {
      tab?.close();
      setError("Write something first, so there is a draft to preview.");
      return;
    }
    if (tab) tab.location.href = `/admin/preview/${id}`;
  }

  return {
    data,
    draft,
    image,
    server,
    status,
    saving,
    dirty,
    savedAt,
    error,
    notice,
    showErrors,
    words,
    when,
    busy,
    autosave,
    slugLocked,
    checklist,
    update,
    setSlug,
    setBody,
    setImage,
    setImageMeta,
    setWhen,
    save,
    publish,
    unpublish,
    remove,
    preview,
    onFieldBlur,
    dismissError: () => setError(null),
    defaultSchedule: nextHourInLagos,
  };
}

export type DraftState = ReturnType<typeof useArticleDraft>;
