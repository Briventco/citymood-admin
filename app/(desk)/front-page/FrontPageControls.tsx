"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { formatDuration } from "@/lib/admin/time";
import type { ActionResult } from "@/lib/admin/session";
import { StoryPicker } from "../../_components/StoryPicker";
import { Notice, Panel, button, panelTitleClass } from "../../_components/ui";
import { arrangeTopStories, endBreaking, extendBreaking, setLeadPin, setMostRead } from "./actions";

// Interactive front page panels (front-page-1440.png). Every button calls a
// server action; the action revalidates, and the page re-renders with the new
// state in the same round trip.

export type Story = { id: string; headline: string; categoryName: string | null; imageSrc: string | null; focal: string };

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      const result = await fn();
      setError(result.ok ? null : result.error);
    });
  return { pending, error, run };
}

// ───────────── Lead story ─────────────

export function LeadPanel({
  lead,
  pinned,
  pinnedNote,
  pinNotLive,
}: {
  lead: Story | null;
  pinned: boolean;
  pinnedNote: string | null;
  pinNotLive: boolean;
}) {
  const { pending, error, run } = useAction();
  const [picking, setPicking] = useState(false);

  return (
    <Panel id="lead-h" title="Lead story">
      {lead ? (
        <div className="flex flex-wrap items-center gap-[18px]">
          <div className="relative aspect-video w-full shrink-0 bg-cm-paper sm:w-[200px]">
            {lead.imageSrc && (
              <Image src={lead.imageSrc} alt="" fill sizes="200px" className="object-cover" style={{ objectPosition: lead.focal }} />
            )}
          </div>
          <div className="min-w-0 flex-[1_1_220px]">
            {lead.categoryName && <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.1em]">{lead.categoryName}</p>}
            <p className="font-serif text-[22px] leading-[1.15] font-bold">{lead.headline}</p>
            <p className="mt-1.5 text-sm text-cm-meta">
              {pinned ? pinnedNote : "Chosen automatically: the newest featured story with a photo"}
            </p>
          </div>
          <button type="button" onClick={() => setPicking(true)} disabled={pending} className={button.secondary}>
            Change
          </button>
        </div>
      ) : (
        <p className="text-[15px]">Nothing is live yet, so the homepage shows “No stories yet”.</p>
      )}
      {pinNotLive && (
        <p className="mt-3 text-sm font-bold">The pinned story isn’t live any more, so the newest featured story is showing.</p>
      )}
      <fieldset className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-cm-rule pt-3.5" disabled={pending}>
        <legend className="sr-only">How the lead is chosen</legend>
        <label className={`flex min-h-11 items-center gap-2.5 text-[15px] ${!pinned ? "font-bold" : ""}`}>
          <input type="radio" name="lead-mode" checked={!pinned} onChange={() => run(() => setLeadPin(null))} className="size-[18px] accent-cm-black" />
          Newest featured story (automatic)
        </label>
        <label className={`flex min-h-11 items-center gap-2.5 text-[15px] ${pinned ? "font-bold" : ""}`}>
          <input type="radio" name="lead-mode" checked={pinned} onChange={() => setPicking(true)} className="size-[18px] accent-cm-black" />
          Pinned story
        </label>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <StoryPicker
        open={picking}
        title="Pin the lead story"
        suggested={lead && !pinned ? { id: lead.id, headline: lead.headline, note: "Showing now (automatic)" } : null}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          setPicking(false);
          run(() => setLeadPin(id));
        }}
      />
    </Panel>
  );
}

// ───────────── Breaking ticker ─────────────

export function BreakingPanel({ items, now }: { items: { id: string; headline: string; until: string }[]; now: string }) {
  const { pending, error, run } = useAction();
  return (
    <section aria-labelledby="breaking-h" className="cm-on-dark bg-cm-black px-[18px] py-5 text-cm-white sm:px-[22px]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="breaking-h" className={`${panelTitleClass} flex items-center gap-2.5`}>
          <span className="bg-cm-lime px-2 py-[3px] text-cm-black">Breaking</span>ticker
        </h2>
        <span className="text-[13px] text-cm-meta-dark">Hidden on the site when empty</span>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-[15px] text-cm-meta-dark">
          Nothing is breaking right now. Turn on “Breaking news” in a story to add it here.
        </p>
      ) : (
        <ul>
          {items.map((b, i) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cm-rule-dark py-3">
              <div className="min-w-0 flex-[1_1_260px]">
                <p className="text-base font-bold">{b.headline}</p>
                <p className="text-[13px] text-cm-meta-dark">
                  Live · ends in {formatDuration(Date.parse(b.until) - Date.parse(now))}
                  {i >= 5 && " · waiting: the ticker shows the newest 5"}
                </p>
              </div>
              <button type="button" disabled={pending} onClick={() => run(() => extendBreaking(b.id))} className={button.onDarkOutline}>
                Extend 6 h<span className="sr-only">: {b.headline}</span>
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => endBreaking(b.id))} className={button.onDarkSolid}>
                End now<span className="sr-only">: {b.headline}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="mt-3 text-cm-black">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </section>
  );
}

// ───────────── Top stories ─────────────

export function TopStoriesPanel({ slots, pinnedIds }: { slots: { story: Story | null; pinned: boolean }[]; pinnedIds: (string | null)[] }) {
  const { pending, error, run } = useAction();
  const [picking, setPicking] = useState<number | null>(null);

  // Moving a story pins both stories at their new positions: an editor placed them.
  const move = (i: number, j: number) => {
    const next = [...pinnedIds];
    next[i] = slots[j].story?.id ?? null;
    next[j] = slots[i].story?.id ?? null;
    run(() => arrangeTopStories(next));
  };
  const setSlot = (i: number, id: string | null) => {
    const next = pinnedIds.map((x) => (x === id ? null : x));
    next[i] = id;
    run(() => arrangeTopStories(next));
  };

  return (
    <Panel id="top-h" title="Top stories row" aside="Empty slots fill with the newest stories">
      <ol>
        {slots.map(({ story, pinned }, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 border-b border-cm-rule py-2.5 sm:flex-nowrap">
            <span aria-hidden="true" className="min-w-5 font-serif text-[22px] font-bold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base leading-tight font-bold">{story?.headline ?? "Empty"}</p>
              <p className="text-[13px] text-cm-meta">
                {story ? [story.categoryName, pinned ? "pinned" : "automatic"].filter(Boolean).join(" · ") : "Not enough live stories to fill it"}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" aria-label={`Move slot ${i + 1} up`} disabled={pending || i === 0} onClick={() => move(i, i - 1)} className={button.icon}>
                <ChevronUp aria-hidden="true" className="size-4" strokeWidth={2.4} />
              </button>
              <button type="button" aria-label={`Move slot ${i + 1} down`} disabled={pending || i === slots.length - 1} onClick={() => move(i, i + 1)} className={button.icon}>
                <ChevronDown aria-hidden="true" className="size-4" strokeWidth={2.4} />
              </button>
              {pinned ? (
                <button type="button" disabled={pending} onClick={() => setSlot(i, null)} className={`${button.outline} min-w-16`}>
                  Unpin<span className="sr-only"> slot {i + 1}</span>
                </button>
              ) : (
                <button type="button" disabled={pending} onClick={() => setPicking(i)} className={`${button.outline} min-w-16`}>
                  Pin<span className="sr-only"> a story to slot {i + 1}</span>
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <StoryPicker
        open={picking !== null}
        title={`Pin a story to slot ${(picking ?? 0) + 1}`}
        suggested={picking !== null && slots[picking].story ? { id: slots[picking].story!.id, headline: slots[picking].story!.headline, note: "Showing here now (automatic): pin it in place" } : null}
        onClose={() => setPicking(null)}
        onPick={(id) => {
          const i = picking!;
          setPicking(null);
          setSlot(i, id);
        }}
      />
    </Panel>
  );
}

// ───────────── Most read ─────────────

export function MostReadPanel({ picks }: { picks: { id: string; headline: string; live: boolean }[] }) {
  const { pending, error, run } = useAction();
  const [picking, setPicking] = useState(false);
  const ids = picks.map((p) => p.id);

  return (
    <Panel id="most-read-h" title="Most read" note="Picked by editors until view counts are available">
      {picks.length === 0 ? (
        <p className="py-2 text-[15px]">No stories picked. Most read is hidden on the homepage until you add some.</p>
      ) : (
        <ol className="mb-3">
          {picks.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-cm-rule py-2.5 last:border-b-0">
              <span aria-hidden="true" className="min-w-[18px] font-serif text-2xl font-bold">
                {i + 1}
              </span>
              <span className="flex-1 text-[15px] font-bold">
                {p.headline}
                {!p.live && <span className="block text-[13px] font-normal text-cm-meta">Not live, so the homepage skips it</span>}
                {i === 4 && p.live && <span className="block text-[13px] font-normal text-cm-meta">The homepage shows the first 4</span>}
              </span>
              <button
                type="button"
                aria-label={`Remove “${p.headline}” from Most read`}
                disabled={pending}
                onClick={() => run(() => setMostRead(ids.filter((x) => x !== p.id)))}
                className="inline-flex size-11 shrink-0 items-center justify-center hover:bg-cm-paper"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <button type="button" disabled={pending || picks.length >= 5} onClick={() => setPicking(true)} className={button.secondary}>
        Add a story
      </button>
      {picks.length >= 5 && <p className="mt-1.5 text-[13px] text-cm-meta">Most read holds up to 5. Remove one to add another.</p>}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <StoryPicker
        open={picking}
        title="Add to Most read"
        exclude={ids}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          setPicking(false);
          run(() => setMostRead([...ids, id]));
        }}
      />
    </Panel>
  );
}
