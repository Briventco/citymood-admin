"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { STATUS_LABELS } from "@/lib/admin/status";
import { LIMITS } from "@/lib/admin/text";
import { formatAgo, formatDayTime } from "@/lib/admin/time";
import { Switch } from "../../../_components/Switch";
import {
  CharCount,
  CheckBox,
  FieldError,
  StatusMarker,
  inputClass,
  labelClass,
  sectionLabelClass,
  selectClass,
  textareaClass,
} from "../../../_components/ui";
import type { DraftState } from "./useArticleDraft";

type P = { s: DraftState };

// ───────────── Status line ─────────────

/** "Saved 2 minutes ago", refreshed every 15 seconds. */
export function SaveStatus({ s, tone = "light" }: P & { tone?: "light" | "dark" }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const meta = tone === "dark" ? "text-cm-meta-dark" : "text-cm-meta";
  let text: string;
  if (s.saving) text = "Saving…";
  else if (s.dirty && !s.autosave) text = "Unsaved changes";
  else if (!s.server.id) text = "Not saved yet";
  else if (s.savedAt) text = `Saved ${formatAgo(s.savedAt, now)}`;
  else text = "Saved";
  return (
    <span className={`text-sm ${s.dirty && !s.autosave ? "font-bold" : meta}`}>
      {text}
    </span>
  );
}

export function StatusPill({ s }: P) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-cm-black px-2 py-1 text-xs font-extrabold uppercase tracking-[0.08em]">
      <StatusMarker status={s.status} size="size-[9px]" />
      {STATUS_LABELS[s.status]}
    </span>
  );
}

// ───────────── Headline and standfirst ─────────────

export function HeadlineField({ s, variant }: P & { variant: "desktop" | "mobile" }) {
  const empty = s.showErrors && !s.draft.headline.trim();
  const mobile = variant === "mobile";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor="headline" className={mobile ? "text-xs font-extrabold uppercase tracking-[0.1em]" : sectionLabelClass}>
          Headline
        </label>
        {!mobile && (
          <span>
            <CharCount value={s.draft.headline} limit={LIMITS.headline} /> <span className="text-[13px] font-semibold text-cm-meta">characters</span>
          </span>
        )}
      </div>
      <textarea
        id="headline"
        rows={mobile ? 2 : 2}
        value={s.draft.headline}
        onChange={(e) => s.update({ headline: e.target.value.replace(/\n/g, " ") })}
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        placeholder="Write the headline"
        aria-invalid={empty || undefined}
        aria-describedby={empty ? "headline-error" : undefined}
        className={`w-full resize-none border-0 border-b-2 border-cm-black bg-cm-white px-0 font-serif font-bold text-cm-black [field-sizing:content] placeholder:text-cm-meta focus-visible:outline-offset-4 ${
          mobile ? "min-h-[64px] pt-1 pb-2 text-2xl leading-[1.15]" : "min-h-[96px] pt-1 pb-2.5 text-[30px] leading-[1.1] lg:text-[38px]"
        }`}
      />
      {empty && <FieldError id="headline-error">Add a headline to publish this story</FieldError>}
      {mobile && s.draft.headline.length > LIMITS.headline && (
        <p className="mt-1 text-[13px] font-bold">
          {s.draft.headline.length} / {LIMITS.headline} characters: consider a shorter headline
        </p>
      )}
    </div>
  );
}

export function StandfirstField({ s }: P) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <label htmlFor="standfirst" className={sectionLabelClass}>
          Standfirst
        </label>
        <span id="standfirst-hint" className="text-[13px] font-semibold text-cm-meta">
          One or two sentences, shown under the headline
        </span>
      </div>
      <textarea
        id="standfirst"
        rows={2}
        value={s.draft.standfirst}
        onChange={(e) => s.update({ standfirst: e.target.value })}
        aria-describedby="standfirst-hint"
        className={`${textareaClass} resize-y border-cm-rule text-[17px] leading-normal text-cm-ink sm:text-[19px]`}
      />
    </div>
  );
}

// ───────────── Category, tags, byline ─────────────

export function CategoryField({ s, size = "h-11" }: P & { size?: string }) {
  const empty = s.showErrors && !s.draft.category_id;
  return (
    <div>
      <label htmlFor="category" className={labelClass}>
        Category
      </label>
      <select
        id="category"
        value={s.draft.category_id ?? ""}
        onChange={(e) => s.update({ category_id: e.target.value || null })}
        aria-invalid={empty || undefined}
        aria-describedby={empty ? "category-error" : undefined}
        className={`${selectClass} ${size} ${empty ? "border-2 border-cm-black" : ""}`}
      >
        <option value="">Choose a category</option>
        {s.data.categories
          .filter((c) => c.is_active || c.id === s.draft.category_id)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? "" : " (hidden)"}
            </option>
          ))}
      </select>
      {empty && <FieldError id="category-error">Choose a category to publish this story</FieldError>}
    </div>
  );
}

export function TagInput({ s }: P) {
  const [text, setText] = useState("");
  const tags = s.draft.tags;
  const add = (raw: string) => {
    const names = raw.split(",").map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean);
    const next = [...tags];
    for (const n of names) if (!next.some((t) => t.toLowerCase() === n.toLowerCase())) next.push(n);
    if (next.length !== tags.length) s.update({ tags: next });
    setText("");
  };
  return (
    <div>
      <label htmlFor="tag-input" className={labelClass}>
        Tags
      </label>
      {tags.length > 0 && (
        <ul aria-label="Tags on this story" className="mb-1.5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <li key={t} className="inline-flex h-8 items-center border border-cm-black pl-2.5 text-sm font-semibold">
              {t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => s.update({ tags: tags.filter((x) => x !== t) })}
                className="-my-1.5 inline-flex h-11 w-9 items-center justify-center"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id="tag-input"
        list="tag-suggestions"
        value={text}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          }
        }}
        onBlur={() => text && add(text)}
        placeholder="Add a tag"
        aria-describedby="tag-hint"
        className={inputClass}
      />
      <p id="tag-hint" className="sr-only">
        Press Enter or type a comma to add each tag.
      </p>
      <datalist id="tag-suggestions">
        {s.data.tagSuggestions
          .filter((t) => !tags.includes(t))
          .map((t) => (
            <option key={t} value={t} />
          ))}
      </datalist>
    </div>
  );
}

export function BylineField({ s }: P) {
  const { can, authors, me } = s.data;
  if (!can.editor) {
    const name = authors.find((a) => a.id === s.draft.author_id)?.full_name ?? me.full_name;
    return (
      <div>
        <p className={labelClass}>Byline</p>
        <p className="text-base">{name}</p>
        <p className="mt-0.5 text-[13px] text-cm-meta">Editors can change the byline.</p>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor="byline" className={labelClass}>
        Byline
      </label>
      <select id="byline" value={s.draft.author_id ?? ""} onChange={(e) => s.update({ author_id: e.target.value || null })} className={selectClass}>
        {authors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ───────────── Homepage placement ─────────────

export function BreakingSwitch({ s, onDark = false }: P & { onDark?: boolean }) {
  return (
    <div className={onDark ? "cm-on-dark flex items-center gap-3 bg-cm-black px-3.5 py-3 text-cm-white" : "flex items-start gap-3 border-b border-cm-rule py-3"}>
      <div className="flex-1">
        <p id="breaking-label" className={onDark ? "text-base font-extrabold" : "text-[15px] font-bold"}>
          Breaking news
        </p>
        <p id="breaking-hint" className={`text-[13px] ${onDark ? "text-cm-meta-dark" : "text-cm-meta"}`}>
          {onDark ? "Ticker for 6 hours after publishing" : "Shows in the ticker for 6 hours"}
        </p>
      </div>
      <Switch checked={s.draft.breaking} onChange={(v) => s.update({ breaking: v })} labelledBy="breaking-label" describedBy="breaking-hint" onDark={onDark} />
    </div>
  );
}

export function FeatureSwitch({ s }: P) {
  // Hidden for reporters: only editors feature stories (the data layer refuses it too).
  if (!s.data.can.editor) return null;
  return (
    <div className="flex items-start gap-3 pt-3 pb-0.5">
      <div className="flex-1">
        <p id="featured-label" className="text-[15px] font-bold">
          Feature on homepage
        </p>
        <p id="featured-hint" className="text-[13px] text-cm-meta">
          Can be picked as the lead story
        </p>
      </div>
      <Switch checked={s.draft.featured} onChange={(v) => s.update({ featured: v })} labelledBy="featured-label" describedBy="featured-hint" />
    </div>
  );
}

// ───────────── Search and sharing ─────────────

export function SeoFields({ s }: P) {
  const category = s.data.categories.find((c) => c.id === s.draft.category_id);
  const title = s.draft.seo_title || s.draft.headline || "Headline";
  const description = s.draft.seo_description || s.draft.standfirst;
  const shown = description.length > 155 ? `${description.slice(0, 152).trimEnd()}…` : description;
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="slug" className={labelClass}>
          Web address
        </label>
        <div className="flex h-11 items-center border border-cm-ad-border bg-cm-white text-[15px] focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-cm-black">
          <span aria-hidden="true" className="shrink-0 pr-1 pl-2.5 text-cm-meta">
            /{category?.slug ?? "news"}/
          </span>
          <input
            id="slug"
            value={s.draft.slug}
            readOnly={s.slugLocked}
            onChange={(e) => s.setSlug(e.target.value)}
            aria-describedby="slug-hint"
            className="h-10 min-w-0 flex-1 bg-transparent pr-2 outline-none read-only:text-cm-meta"
          />
        </div>
        <p id="slug-hint" className="mt-1 text-[13px] text-cm-meta">
          {s.slugLocked ? "Locked after publishing, so links to the story keep working." : "Made from the headline. You can change it until the story is published."}
        </p>
      </div>
      <div>
        <div className="mb-1 flex justify-between">
          <label htmlFor="seo-title" className="text-sm font-bold">
            Search title
          </label>
          <CharCount value={s.draft.seo_title} limit={LIMITS.seoTitle} />
        </div>
        <input id="seo-title" value={s.draft.seo_title} onChange={(e) => s.update({ seo_title: e.target.value })} placeholder={s.draft.headline} className={`${inputClass} text-[15px]`} />
      </div>
      <div>
        <div className="mb-1 flex justify-between">
          <label htmlFor="seo-description" className="text-sm font-bold">
            Search description
          </label>
          <CharCount value={s.draft.seo_description} limit={LIMITS.seoDescription} />
        </div>
        <textarea
          id="seo-description"
          rows={5}
          value={s.draft.seo_description}
          onChange={(e) => s.update({ seo_description: e.target.value })}
          className={`${textareaClass} resize-y text-[15px]`}
        />
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-bold text-cm-meta">Search result preview</p>
        <div className="bg-cm-paper px-3.5 py-3">
          <p className="text-[13px] text-cm-meta">
            {s.data.siteHost} › {category?.slug ?? "news"}
          </p>
          <p className="mt-0.5 mb-1 text-[17px] leading-snug font-bold break-words">{title}</p>
          <p className="text-sm leading-snug break-words text-cm-ink">{shown || "Add a search description or standfirst."}</p>
        </div>
      </div>
    </div>
  );
}

// ───────────── Ready to publish ─────────────

export function Checklist({ s, compact = false }: P & { compact?: boolean }) {
  const items = compact ? s.checklist.filter((c) => c.required || c.key === "image") : s.checklist;
  return (
    <ul className="text-[15px]">
      {items.map((c) => {
        const label = compact && c.key === "image" && !c.done ? "Add a photo, or publish without one" : c.label;
        return (
          <li key={c.key} className={`flex items-center gap-2.5 py-[5px] sm:py-[7px] ${!c.done && (c.required || compact) ? "font-bold" : ""}`}>
            <CheckBox done={c.done} required={c.required || compact} />
            <span>
              {label}
              <span className="sr-only">{c.done ? ": done" : c.required ? ": needed to publish" : ": recommended"}</span>
            </span>
            {!c.done && !c.required && !compact && <span className="text-[13px] text-cm-meta">(recommended)</span>}
            {!c.done && c.required && c.fix && (
              <a
                href={`#${c.fix}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(c.fix!)?.focus();
                }}
                className="-my-3 ml-auto inline-flex min-h-11 items-center px-1 text-sm font-bold underline"
              >
                Fix<span className="sr-only"> {label}</span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function WhenFields({ s }: P) {
  if (s.server.live) {
    return (
      <p className="text-[15px]">
        Live since <strong>{s.server.publish_at ? formatDayTime(s.server.publish_at, new Date()) : "now"}</strong> (Lagos time)
      </p>
    );
  }
  const schedule = s.when.mode === "schedule" ? s.when : null;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-bold">When</legend>
      <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
        <input type="radio" name="when" checked={!schedule} onChange={() => s.setWhen({ mode: "now" })} className="size-[18px] accent-cm-black" />
        Publish now
      </label>
      <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
        <input
          type="radio"
          name="when"
          checked={!!schedule}
          onChange={() => s.setWhen({ mode: "schedule", ...s.defaultSchedule() })}
          className="size-[18px] accent-cm-black"
        />
        Schedule
      </label>
      {schedule && (
        <div className="ml-7">
          <div className="mt-1 flex gap-2">
            <label htmlFor="schedule-date" className="sr-only">
              Date
            </label>
            <input
              id="schedule-date"
              type="date"
              value={schedule.date}
              onChange={(e) => s.setWhen({ ...schedule, date: e.target.value })}
              className={`${inputClass} flex-[3] px-2.5 text-[15px]`}
            />
            <label htmlFor="schedule-time" className="sr-only">
              Time
            </label>
            <input
              id="schedule-time"
              type="time"
              value={schedule.time}
              onChange={(e) => s.setWhen({ ...schedule, time: e.target.value })}
              className={`${inputClass} flex-[2] px-2.5 text-[15px]`}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-cm-meta">Lagos time (WAT)</p>
        </div>
      )}
    </fieldset>
  );
}
