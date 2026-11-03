"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ArticleSummary } from "@/lib/admin/repo";
import { formatListTime } from "@/lib/admin/time";
import { findLiveStories } from "../(desk)/front-page/actions";
import { Notice, button, inputClass } from "./ui";

// Pick a live story (front page pins, Most read). Native <dialog>.
type Props = {
  open: boolean;
  title: string;
  /** Shown first, e.g. the story a slot shows automatically. */
  suggested?: { id: string; headline: string; note: string } | null;
  exclude?: string[];
  onPick: (id: string) => void;
  onClose: () => void;
};

export function StoryPicker({ open, title, suggested, exclude = [], onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    const t = setTimeout(async () => {
      const result = await findLiveStories(search);
      if (stale) return;
      if (result.ok) setItems(result.data);
      else setError(result.error);
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [open, search]);

  const now = new Date();
  const list = (items ?? []).filter((a) => !exclude.includes(a.id) && a.id !== suggested?.id);

  return (
    <dialog
      ref={ref}
      aria-labelledby="story-picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[calc(100vh-32px)] w-[min(640px,calc(100vw-32px))] border-2 border-cm-black bg-cm-white p-0 text-cm-black backdrop:bg-cm-black/60"
    >
      <div className="flex items-center justify-between gap-3 border-b border-cm-rule px-5 py-3">
        <h2 id="story-picker-title" className="text-sm font-extrabold uppercase tracking-[0.1em]">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className={button.icon}>
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="px-5 pt-4">
        <label htmlFor="story-search" className="sr-only">
          Search live stories
        </label>
        <input
          id="story-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search live stories by headline"
          className={inputClass}
        />
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </div>
      <ul className="max-h-[55vh] overflow-y-auto px-5 pt-2 pb-4">
        {suggested && !search && (
          <li className="border-b border-cm-rule">
            <button type="button" onClick={() => onPick(suggested.id)} className="block w-full py-3 text-left hover:underline">
              <span className="block text-base leading-snug font-bold">{suggested.headline}</span>
              <span className="text-[13px] text-cm-meta">{suggested.note}</span>
            </button>
          </li>
        )}
        {items === null ? (
          <li role="status" className="py-6 text-center text-cm-meta">
            Loading stories…
          </li>
        ) : list.length === 0 ? (
          <li className="py-6 text-center">{search ? "No live stories match that search." : "No other live stories."}</li>
        ) : (
          list.map((a) => (
            <li key={a.id} className="border-b border-cm-rule last:border-b-0">
              <button type="button" onClick={() => onPick(a.id)} className="block w-full py-3 text-left hover:underline">
                <span className="block text-base leading-snug font-bold">{a.headline}</span>
                <span className="text-[13px] text-cm-meta">
                  {[a.category_name, a.publish_at && formatListTime(a.publish_at, now)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </dialog>
  );
}
