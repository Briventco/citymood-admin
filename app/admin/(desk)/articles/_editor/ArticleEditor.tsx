"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ConfirmDialog } from "../../../_components/ConfirmDialog";
import { Notice, button, panelClass, panelTitleClass } from "../../../_components/ui";
import { FeaturedImage, ImageDetailFields } from "./FeaturedImage";
import {
  BreakingSwitch,
  BylineField,
  CategoryField,
  Checklist,
  FeatureSwitch,
  HeadlineField,
  SaveStatus,
  SeoFields,
  StandfirstField,
  StatusPill,
  TagInput,
  WhenFields,
} from "./fields";
import { RichTextEditor } from "./RichTextEditor";
import { useArticleDraft, type DraftState, type EditorData } from "./useArticleDraft";

// The article editor (article-editor-1440.png) and, below 768px, mobile quick
// publish (quick-publish-mobile-390.png). One state, two layouts. The server
// guesses the layout from the device so the first paint is right; the media
// query takes over after hydration.

const MOBILE = "(max-width: 767px)";

function useIsMobile(initial: boolean) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(MOBILE);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(MOBILE).matches,
    () => initial,
  );
}

function primaryLabel(s: DraftState) {
  if (s.busy === "publish") return "Publishing…";
  if (s.server.live) return s.saving ? "Updating…" : "Update";
  if (s.when.mode === "schedule") return s.server.status === "scheduled" ? "Update schedule" : "Schedule";
  return "Publish";
}

/** Publish, schedule, or (for live stories) save the changes. */
function onPrimary(s: DraftState) {
  if (s.server.live) void s.save();
  else void s.publish();
}

function Messages({ s }: { s: DraftState }) {
  if (!s.error && !s.notice) return null;
  return (
    <div className="flex flex-col gap-2">
      {s.error && <Notice tone="error">{s.error}</Notice>}
      {s.notice && <Notice tone="success">{s.notice}</Notice>}
    </div>
  );
}

function DangerZone({ s, onDelete, onUnpublish }: { s: DraftState; onDelete: () => void; onUnpublish: () => void }) {
  const { can } = s.data;
  const scheduled = s.server.status === "scheduled" && !s.server.live;
  return (
    <div className="flex flex-wrap gap-x-5">
      {s.server.live && can.editor && (
        <button type="button" onClick={onUnpublish} className={button.destructive}>
          Unpublish
        </button>
      )}
      {scheduled && (
        <button type="button" onClick={onUnpublish} className={button.destructive}>
          Cancel schedule
        </button>
      )}
      {(s.server.can_delete || !s.server.id) && (
        <button type="button" onClick={onDelete} className={button.destructive}>
          {!s.server.id ? "Discard" : s.server.status === "draft" ? "Delete draft" : "Delete story"}
        </button>
      )}
    </div>
  );
}

/** Tells screen reader users when a save starts and ends, without repeating the "Saved X ago" clock. */
function SaveAnnouncer({ s }: { s: DraftState }) {
  return (
    <p className="sr-only" aria-live="polite">
      {s.saving ? "Saving" : s.savedAt && !s.dirty ? "Saved" : ""}
    </p>
  );
}

export function ArticleEditor({ data }: { data: EditorData }) {
  const s = useArticleDraft(data);
  const mobile = useIsMobile(data.initialMobile);
  const [confirm, setConfirm] = useState<null | "delete" | "unpublish">(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirm === "delete"}
        title={s.server.status === "draft" ? "Delete this draft?" : "Delete this story?"}
        confirmLabel="Delete"
        pending={s.busy === "delete"}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const err = await s.remove();
          setConfirmError(err);
          if (err) setConfirm(null);
        }}
      >
        {s.server.live ? "It comes off the site and out of the newsroom. This can’t be undone." : "This can’t be undone."}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "unpublish"}
        title={s.server.live ? "Unpublish this story?" : "Cancel the schedule?"}
        confirmLabel={s.server.live ? "Unpublish" : "Cancel schedule"}
        pending={s.busy === "unpublish"}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await s.unpublish();
          setConfirm(null);
        }}
      >
        {s.server.live
          ? "Readers won’t see it any more, and it leaves the homepage. You can publish it again later."
          : "It goes back to being a draft and won’t publish on its own."}
      </ConfirmDialog>
      {confirmError && <Notice tone="error">{confirmError}</Notice>}
    </>
  );

  const story = (compact: boolean) => (
    <div>
      <p id="story-label" className={`${compact ? "text-xs" : "text-[13px]"} mb-2 font-extrabold uppercase tracking-[0.1em]`}>
        Story
      </p>
      <RichTextEditor value={s.draft.body} onChange={s.setBody} labelledBy="story-label" compact={compact} />
      <p className="mt-2 text-[13px] text-cm-meta">
        {s.words} {s.words === 1 ? "word" : "words"}
        {s.words > 0 && ` · about ${Math.max(1, Math.round(s.words / 220))} min read`}
      </p>
    </div>
  );

  if (mobile) {
    return (
      <div className="flex min-h-screen flex-col bg-cm-white" onBlur={s.onFieldBlur}>
        <header className="cm-on-dark sticky top-0 z-10 flex items-center gap-1 bg-cm-black px-2 py-1.5 text-cm-white">
          <Link href="/admin/articles" aria-label="Back to articles" className="flex size-11 items-center justify-center">
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold">{s.server.id ? s.draft.headline || "Untitled story" : "New story"}</h1>
            <p className="text-xs text-cm-meta-dark">
              {s.status[0].toUpperCase() + s.status.slice(1)} · <SaveStatus s={s} tone="dark" />
            </p>
          </div>
          <button type="button" onClick={() => void s.save()} disabled={s.saving} className="h-11 border border-cm-white px-3.5 text-sm font-bold">
            Save
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-[18px] px-4 pt-4 pb-6">
          <Messages s={s} />
          <FeaturedImage image={s.image} onSelect={s.setImage} onMeta={s.setImageMeta} showErrors={s.showErrors} variant="mobile" />
          <HeadlineField s={s} variant="mobile" />
          <CategoryField s={s} size="h-12" />
          <BreakingSwitch s={s} onDark />
          {story(true)}

          <details className="group border-y border-cm-rule">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 text-base font-bold [&::-webkit-details-marker]:hidden">
              More details
              <span className="text-sm font-semibold text-cm-meta">Standfirst, tags, search</span>
            </summary>
            <div className="flex flex-col gap-4 pb-5">
              <StandfirstField s={s} />
              <TagInput s={s} />
              <BylineField s={s} />
              <FeatureSwitch s={s} />
              {s.image && <ImageDetailFields image={s.image} onMeta={s.setImageMeta} />}
              <WhenFields s={s} />
              <SeoFields s={s} />
            </div>
          </details>

          <section aria-labelledby="checklist-mobile" className="bg-cm-paper p-3.5">
            <h2 id="checklist-mobile" className="mb-1.5 text-[13px] font-extrabold uppercase tracking-[0.1em]">
              Before you publish
            </h2>
            <Checklist s={s} compact />
          </section>
          <DangerZone s={s} onDelete={() => setConfirm("delete")} onUnpublish={() => setConfirm("unpublish")} />
          {dialogs}
          <SaveAnnouncer s={s} />
        </div>

        <div className="sticky bottom-0 z-10 flex gap-2.5 border-t-2 border-cm-black bg-cm-white px-4 pt-3 pb-5">
          <button type="button" onClick={() => void s.preview()} className={`${button.secondary} h-[52px] flex-1 text-base`}>
            Preview
          </button>
          <button type="button" onClick={() => onPrimary(s)} disabled={!!s.busy} className={`${button.primary} h-[52px] flex-[2] text-base`}>
            {primaryLabel(s)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onBlur={s.onFieldBlur}>
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-cm-rule bg-cm-white px-4 py-3 sm:px-7">
        <Link href="/admin/articles" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold">
          <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2.4} />
          Articles
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusPill s={s} />
          <SaveStatus s={s} />
        </div>
        <div className="ml-auto flex flex-wrap gap-2.5">
          <button type="button" onClick={() => void s.preview()} className={button.secondary}>
            Preview
          </button>
          {!s.server.live && (
            <button type="button" onClick={() => void s.save()} disabled={s.saving} className={button.secondary}>
              {s.server.status === "scheduled" ? "Save changes" : "Save draft"}
            </button>
          )}
          <button type="button" onClick={() => onPrimary(s)} disabled={!!s.busy} className={`${button.primary} px-[22px]`}>
            {primaryLabel(s)}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-6 px-4 pt-6 pb-12 sm:px-7">
        <section aria-labelledby="editor-title" className="min-w-0 flex-[999_1_520px] border border-cm-rule bg-cm-white px-5 pt-8 pb-10 sm:px-10">
          <h1 id="editor-title" className="sr-only">
            {s.server.id ? `Edit story: ${s.draft.headline || "Untitled"}` : "New article"}
          </h1>
          <div className="mx-auto flex max-w-[760px] flex-col gap-6">
            <Messages s={s} />
            <HeadlineField s={s} variant="desktop" />
            <StandfirstField s={s} />
            <div className="pt-1">
              <FeaturedImage image={s.image} onSelect={s.setImage} onMeta={s.setImageMeta} showErrors={s.showErrors} variant="desktop" />
            </div>
            <div className="pt-2">{story(false)}</div>
          </div>
        </section>

        <aside aria-label="Article settings" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <section aria-labelledby="publish-h" className={panelClass}>
            <h2 id="publish-h" className={`${panelTitleClass} mb-3`}>
              Ready to publish
            </h2>
            <Checklist s={s} />
            <div className="mt-3.5 border-t border-cm-rule pt-3.5">
              <WhenFields s={s} />
            </div>
          </section>

          <section aria-labelledby="placement-h" className={panelClass}>
            <h2 id="placement-h" className={`${panelTitleClass} mb-1.5`}>
              Homepage placement
            </h2>
            <BreakingSwitch s={s} />
            <FeatureSwitch s={s} />
          </section>

          <section aria-labelledby="org-h" className={`${panelClass} flex flex-col gap-3.5`}>
            <h2 id="org-h" className={panelTitleClass}>
              Category, tags and byline
            </h2>
            <CategoryField s={s} />
            <TagInput s={s} />
            <BylineField s={s} />
          </section>

          <section aria-labelledby="seo-h" className={`${panelClass} flex flex-col gap-3`}>
            <h2 id="seo-h" className={panelTitleClass}>
              Search and sharing
            </h2>
            <SeoFields s={s} />
          </section>

          <DangerZone s={s} onDelete={() => setConfirm("delete")} onUnpublish={() => setConfirm("unpublish")} />
          {dialogs}
        </aside>
      </div>
      <SaveAnnouncer s={s} />
    </div>
  );
}
