"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ArticleSummary } from "@/lib/admin/repo";
import { effectiveStatus, isBreakingNow } from "@/lib/admin/status";
import { formatListTime } from "@/lib/admin/time";
import { ConfirmDialog } from "../../_components/ConfirmDialog";
import { Thumb } from "../../_components/Thumb";
import { Flag, Notice, StatusLabel, button } from "../../_components/ui";
import { removeArticles } from "./actions";

type ConfirmState = {
  ids: string[];
  title: string;
  body: string;
  success: string;
};

function Flags({ a, now }: { a: ArticleSummary; now: Date }) {
  const breaking = a.breaking && (!a.live || isBreakingNow(a, now));
  if (!breaking && !a.featured) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {breaking && <Flag>Breaking</Flag>}
      {a.featured && <Flag>Featured</Flag>}
    </span>
  );
}

function Headline({ a }: { a: ArticleSummary }) {
  const text = a.headline || "Untitled draft";
  const cls = "font-serif text-[17px] leading-tight font-semibold";
  return a.can_edit ? (
    <Link href={`/articles/${a.id}`} className={`${cls} hover:underline`}>
      {text}
    </Link>
  ) : (
    <span className={cls}>
      {text}
      <span className="sr-only"> (you can’t edit this story)</span>
    </span>
  );
}

const when = (a: ArticleSummary, now: Date) =>
  formatListTime(a.status === "scheduled" && a.publish_at ? a.publish_at : a.updated_at, now);

export function ArticlesList({
  items,
  nowIso,
  initialNotice,
}: {
  items: ArticleSummary[];
  nowIso: string;
  initialNotice: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(
    initialNotice ? { tone: "success", text: initialNotice } : null,
  );

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const deletableIds = useMemo(() => items.filter((a) => a.can_delete).map((a) => a.id), [items]);
  const selectedIds = useMemo(() => deletableIds.filter((id) => selected.has(id)), [deletableIds, selected]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hasDeletable = deletableIds.length > 0;
  const allSelected = hasDeletable && selectedIds.length === deletableIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(deletableIds) : new Set());
  }

  function promptSingle(a: ArticleSummary) {
    setConfirm({
      ids: [a.id],
      title: a.status === "draft" ? "Delete this draft?" : "Delete this story?",
      body: a.live
        ? `“${a.headline}” comes off the site and out of the newsroom. This can’t be undone.`
        : `“${a.headline}” will be permanently removed. This can’t be undone.`,
      success: `Deleted “${a.headline}”.`,
    });
  }

  function promptBulk() {
    const hasLive = items.some((a) => selectedSet.has(a.id) && a.live);
    const n = selectedIds.length;
    setConfirm({
      ids: selectedIds,
      title: `Delete ${n} ${n === 1 ? "story" : "stories"}?`,
      body: hasLive
        ? "Live stories come off the site and out of the newsroom. This can’t be undone."
        : "Selected stories will be permanently removed. This can’t be undone.",
      success: `Deleted ${n} ${n === 1 ? "story" : "stories"}.`,
    });
  }

  function executeDelete() {
    if (!confirm) return;
    const { ids, success } = confirm;
    start(async () => {
      const result = await removeArticles(ids);
      setConfirm(null);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setNotice({ tone: "success", text: success });
      router.refresh();
    });
  }

  return (
    <>
      {notice && (
        <div className="mb-3">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-cm-black bg-cm-white px-4 py-2">
          <p className="text-[15px] font-bold">
            {selectedIds.length} {selectedIds.length === 1 ? "story" : "stories"} selected
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSelected(new Set())} disabled={pending} className={button.destructive}>
              Clear selection
            </button>
            <button type="button" onClick={promptBulk} disabled={pending} className={button.outline}>
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* From 768px: the table in the reference. */}
      <div className="relative hidden overflow-x-auto border border-cm-rule bg-cm-white md:block">
        <table className="w-full min-w-[760px] border-collapse text-[15px]">
          <caption className="sr-only">Stories, most recently changed first</caption>
          <thead>
            <tr className="border-b-2 border-cm-black text-left text-xs font-extrabold uppercase tracking-[0.1em]">
              {hasDeletable && (
                <th scope="col" className="w-11 px-2 py-1">
                  <label className="inline-flex size-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label="Select all deletable stories on this page"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={(e) => toggleAll(e.target.checked)}
                      disabled={pending}
                      className="size-4 cursor-pointer accent-cm-black"
                    />
                  </label>
                </th>
              )}
              <th scope="col" className="px-4 py-3">Story</th>
              <th scope="col" className="px-3 py-3">Category</th>
              <th scope="col" className="px-3 py-3">Author</th>
              <th scope="col" className="px-3 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Updated</th>
              {hasDeletable && <th scope="col" className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b border-cm-rule last:border-b-0">
                {hasDeletable && (
                  <td className="px-2 py-1">
                    {a.can_delete && (
                      <label className="inline-flex size-11 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${a.headline}`}
                          checked={selectedSet.has(a.id)}
                          onChange={(e) => toggleOne(a.id, e.target.checked)}
                          disabled={pending}
                          className="size-4 cursor-pointer accent-cm-black"
                        />
                      </label>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3.5">
                    <Thumb media={a.image} />
                    <div className="min-w-0">
                      <Headline a={a} />
                      <Flags a={a} now={now} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{a.category_name ?? <span className="text-cm-meta">None</span>}</td>
                <td className="px-3 py-3 whitespace-nowrap">{a.author_name ?? "—"}</td>
                <td className="px-3 py-3"><StatusLabel status={effectiveStatus(a, now)} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-cm-meta">{when(a, now)}</td>
                {hasDeletable && (
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {a.can_delete && (
                      <button type="button" onClick={() => promptSingle(a)} disabled={pending} className={button.destructive}>
                        Delete<span className="sr-only"> {a.headline}</span>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Below 768px: one story per row, no sideways scrolling. */}
      <ul className="border border-cm-rule bg-cm-white md:hidden">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-2 border-b border-cm-rule p-3 last:border-b-0">
            {a.can_delete && (
              <label className="-ml-1.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  aria-label={`Select ${a.headline}`}
                  checked={selectedSet.has(a.id)}
                  onChange={(e) => toggleOne(a.id, e.target.checked)}
                  disabled={pending}
                  className="size-4 cursor-pointer accent-cm-black"
                />
              </label>
            )}
            <Thumb media={a.image} />
            <div className="min-w-0 flex-1">
              <Headline a={a} />
              <Flags a={a} now={now} />
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <StatusLabel status={effectiveStatus(a, now)} />
                <span className="text-cm-meta">
                  {[a.category_name, a.author_name, when(a, now)].filter(Boolean).join(" · ")}
                </span>
              </p>
              {a.can_delete && (
                <div className="mt-1">
                  <button type="button" onClick={() => promptSingle(a)} disabled={pending} className={button.destructive}>
                    Delete<span className="sr-only"> {a.headline}</span>
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        confirmLabel="Delete"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={executeDelete}
      >
        {confirm?.body}
      </ConfirmDialog>
    </>
  );
}
