"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useTransition } from "react";
import type { CategoryItem, TagItem } from "@/lib/admin/repo";
import type { ActionResult } from "@/lib/admin/session";
import { ConfirmDialog } from "../../_components/ConfirmDialog";
import { Switch } from "../../_components/Switch";
import { Notice, Panel, button, inputClass, labelClass, selectClass } from "../../_components/ui";
import { createCategory, deleteTag, mergeTags, moveCategory, renameTag, updateCategory } from "./actions";

function useAction() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>, success?: string, after?: () => void) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        setMessage(success ? { tone: "success", text: success } : null);
        after?.();
      } else setMessage({ tone: "error", text: result.error });
    });
  return { pending, message, run };
}

// ───────────── Categories (admins: add, rename, reorder, hide) ─────────────

export function CategoriesPanel({ categories, canEdit }: { categories: CategoryItem[]; canEdit: boolean }) {
  const { pending, message, run } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");

  return (
    <Panel id="categories-h" title="Categories" aside={canEdit ? "Order sets the section nav" : "Only admins can change these"}>
      {message && (
        <div className="mb-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      <ol>
        {categories.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-cm-rule py-2.5">
            {canEdit && (
              <div className="flex gap-1.5">
                <button type="button" aria-label={`Move ${c.name} up`} disabled={pending || i === 0} onClick={() => run(() => moveCategory(c.id, -1))} className={button.icon}>
                  <ChevronUp aria-hidden="true" className="size-4" strokeWidth={2.4} />
                </button>
                <button type="button" aria-label={`Move ${c.name} down`} disabled={pending || i === categories.length - 1} onClick={() => run(() => moveCategory(c.id, 1))} className={button.icon}>
                  <ChevronDown aria-hidden="true" className="size-4" strokeWidth={2.4} />
                </button>
              </div>
            )}
            {editing === c.id ? (
              <form
                className="flex min-w-0 flex-[1_1_200px] gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => updateCategory(c.id, { name }), `Renamed to “${name.trim()}”.`, () => setEditing(null));
                }}
              >
                <label htmlFor={`cat-${c.id}`} className="sr-only">
                  New name for {c.name}
                </label>
                <input id={`cat-${c.id}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                <button type="submit" disabled={pending} className={button.outline}>
                  Save
                </button>
                <button type="button" onClick={() => setEditing(null)} className={button.destructive}>
                  Cancel
                </button>
              </form>
            ) : (
              <div className="min-w-0 flex-[1_1_160px]">
                <p className={`text-base font-bold ${c.is_active ? "" : "text-cm-meta"}`}>{c.name}</p>
                <p className="text-[13px] text-cm-meta">
                  /{c.slug} · {c.article_count} {c.article_count === 1 ? "story" : "stories"}
                  {!c.is_active && " · hidden from the site"}
                </p>
              </div>
            )}
            {canEdit && editing !== c.id && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(c.id);
                    setName(c.name);
                  }}
                  className="inline-flex min-h-11 items-center text-sm font-bold underline"
                >
                  Rename<span className="sr-only"> {c.name}</span>
                </button>
                <span id={`shown-${c.id}`} className="sr-only">
                  Show {c.name} on the site
                </span>
                <Switch
                  checked={c.is_active}
                  disabled={pending}
                  labelledBy={`shown-${c.id}`}
                  onChange={(v) => run(() => updateCategory(c.id, { is_active: v }), v ? `${c.name} is shown on the site.` : `${c.name} is hidden. Its stories stay live.`)}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
      {canEdit && (
        <form
          className="mt-4 flex flex-wrap items-end gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createCategory(newName), `Added “${newName.trim()}”.`, () => setNewName(""));
          }}
        >
          <div className="min-w-0 flex-[1_1_200px]">
            <label htmlFor="new-category" className={labelClass}>
              New category
            </label>
            <input id="new-category" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" disabled={pending || !newName.trim()} className={button.secondary}>
            Add category
          </button>
        </form>
      )}
      {canEdit && (
        <p className="mt-3 text-[13px] text-cm-meta">
          A category’s web address is set when it’s added, so renaming never breaks links. Hide a category instead of
          deleting it; its stories stay live.
        </p>
      )}
    </Panel>
  );
}

// ───────────── Tags (editors: rename, merge, delete) ─────────────

export function TagsPanel({ tags }: { tags: TagItem[] }) {
  const { pending, message, run } = useAction();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ id: string; mode: "rename" | "merge" } | null>(null);
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState<TagItem | null>(null);
  const shown = tags.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <Panel id="tags-h" title="Tags" aside={`${tags.length} tags`}>
      {message && (
        <div className="mb-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      <label htmlFor="tag-filter" className="sr-only">
        Filter tags
      </label>
      <input id="tag-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tags" className={`${inputClass} mb-2`} />
      {shown.length === 0 ? (
        <p className="py-4 text-[15px]">{tags.length === 0 ? "No tags yet. Reporters add them in the editor." : "No tags match."}</p>
      ) : (
        <ul>
          {shown.map((t) => (
            <li key={t.id} className="border-b border-cm-rule py-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="min-w-0 flex-1 text-[15px]">
                  <strong>{t.name}</strong>{" "}
                  <span className="text-[13px] text-cm-meta">
                    {t.article_count} {t.article_count === 1 ? "story" : "stories"}
                  </span>
                </p>
                <div className="flex gap-3 text-sm font-bold">
                  <button type="button" onClick={() => { setEditing({ id: t.id, mode: "rename" }); setValue(t.name); }} className="inline-flex min-h-11 items-center underline">
                    Rename<span className="sr-only"> {t.name}</span>
                  </button>
                  <button type="button" onClick={() => { setEditing({ id: t.id, mode: "merge" }); setValue(""); }} disabled={tags.length < 2} className="inline-flex min-h-11 items-center underline disabled:opacity-50">
                    Merge<span className="sr-only"> {t.name}</span>
                  </button>
                  <button type="button" onClick={() => setConfirm(t)} className="inline-flex min-h-11 items-center underline">
                    Delete<span className="sr-only"> {t.name}</span>
                  </button>
                </div>
              </div>
              {editing?.id === t.id && (
                <form
                  className="mt-2 flex flex-wrap items-end gap-2 bg-cm-paper p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editing.mode === "rename") run(() => renameTag(t.id, value), `Renamed to “${value.trim()}”.`, () => setEditing(null));
                    else {
                      const into = tags.find((x) => x.id === value);
                      run(() => mergeTags(t.id, value), `Merged “${t.name}” into “${into?.name}”.`, () => setEditing(null));
                    }
                  }}
                >
                  <div className="min-w-0 flex-[1_1_200px]">
                    <label htmlFor={`tag-edit-${t.id}`} className={labelClass}>
                      {editing.mode === "rename" ? "New name" : `Move its stories to`}
                    </label>
                    {editing.mode === "rename" ? (
                      <input id={`tag-edit-${t.id}`} autoFocus value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
                    ) : (
                      <select id={`tag-edit-${t.id}`} value={value} onChange={(e) => setValue(e.target.value)} className={selectClass}>
                        <option value="">Choose a tag</option>
                        {tags.filter((x) => x.id !== t.id).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button type="submit" disabled={pending || !value.trim()} className={button.outline}>
                    {editing.mode === "rename" ? "Save" : "Merge"}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className={button.destructive}>
                    Cancel
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={`Delete the tag “${confirm?.name ?? ""}”?`}
        confirmLabel="Delete"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && run(() => deleteTag(confirm.id), `Deleted “${confirm.name}”.`, () => setConfirm(null))}
      >
        {confirm && confirm.article_count > 0
          ? `It comes off ${confirm.article_count} ${confirm.article_count === 1 ? "story" : "stories"}. The stories stay. To keep them grouped, merge it into another tag instead.`
          : "This can’t be undone."}
      </ConfirmDialog>
    </Panel>
  );
}
