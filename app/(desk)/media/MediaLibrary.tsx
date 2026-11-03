"use client";

import { Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { focalPosition, mediaSrc } from "@/lib/admin/media-url";
import type { MediaItem } from "@/lib/admin/repo";
import { formatShortDate } from "@/lib/admin/time";
import { ConfirmDialog } from "../../_components/ConfirmDialog";
import { FocalPicker, type ImageMetaPatch } from "../../_components/FocalPicker";
import { EmptyState, Notice, button, inputClass, labelClass, panelClass, panelTitleClass } from "../../_components/ui";
import { usePhotoUpload } from "../../_components/usePhotoUpload";
import { deletePhoto, updatePhoto } from "../../media-actions";

// Grid of uploads; selecting one opens its details (alt text, caption, credit,
// focal point). Editors can delete; the uploader or an editor can edit.

function Details({ item, canDelete, onDone }: { item: MediaItem; canDelete: boolean; onDone: (message: string) => void }) {
  const [draft, setDraft] = useState(item);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: ImageMetaPatch) => setDraft((d) => ({ ...d, ...patch }));
  const changed = (["alt", "caption", "credit", "focal_x", "focal_y"] as const).some((k) => draft[k] !== item[k]);
  const readOnly = !item.can_edit;

  return (
    <section aria-labelledby="media-details-h" className={`${panelClass} flex flex-col gap-3.5`}>
      <h2 id="media-details-h" className={panelTitleClass}>
        Photo details
      </h2>
      {readOnly ? (
        <div className="relative aspect-video bg-cm-black">
          <Image src={mediaSrc(item)} alt="" fill sizes="440px" className="object-contain" />
        </div>
      ) : (
        <div>
          <FocalPicker image={draft} onMeta={set} ratio="aspect-video" />
          <p className="mt-1.5 text-[13px] text-cm-meta">Click the photo, or use the arrow keys, to set its focal point.</p>
        </div>
      )}
      <p className="text-[13px] text-cm-meta">
        {item.width}×{item.height} · uploaded {formatShortDate(item.created_at, new Date())}
        {item.uploader_name && ` by ${item.uploader_name}`} ·{" "}
        {item.used_by === 0 ? "not used yet" : `used in ${item.used_by} ${item.used_by === 1 ? "place" : "places"}`}
      </p>
      {readOnly && <p className="text-sm font-bold">Only the person who uploaded this photo, or an editor, can change its details.</p>}
      {(["alt", "caption", "credit"] as const).map((key) => (
        <div key={key}>
          <label htmlFor={`media-${key}`} className={labelClass}>
            {key === "alt" ? "Alt text" : key === "caption" ? "Caption" : "Credit"}
          </label>
          <input
            id={`media-${key}`}
            value={draft[key]}
            readOnly={readOnly}
            onChange={(e) => set({ [key]: e.target.value })}
            placeholder={key === "alt" ? "Describe what the photo shows" : undefined}
            className={`${inputClass} read-only:bg-cm-paper`}
          />
        </div>
      ))}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-2.5">
        {!readOnly && (
          <button
            type="button"
            disabled={pending || !changed}
            onClick={() =>
              start(async () => {
                const result = await updatePhoto(item.id, {
                  alt: draft.alt, caption: draft.caption, credit: draft.credit, focal_x: draft.focal_x, focal_y: draft.focal_y,
                });
                if (result.ok) onDone("Photo details saved.");
                else setError(result.error);
              })
            }
            className={button.primary}
          >
            {pending ? "Saving…" : "Save details"}
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={() => setConfirm(true)} className={`${button.destructive} ml-auto`}>
            Delete photo
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete this photo?"
        confirmLabel="Delete"
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          start(async () => {
            const result = await deletePhoto(item.id);
            setConfirm(false);
            if (result.ok) onDone("Photo deleted.");
            else setError(result.error);
          })
        }
      >
        {item.used_by > 0
          ? `It’s used in ${item.used_by} ${item.used_by === 1 ? "place" : "places"}. Those stories or adverts lose this photo. This can’t be undone.`
          : "This can’t be undone."}
      </ConfirmDialog>
    </section>
  );
}

export function MediaLibrary({ items, search, canDelete }: { items: MediaItem[]; search: string; canDelete: boolean }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const photo = usePhotoUpload();
  const current = items.find((m) => m.id === selected) ?? null;

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    let last: MediaItem | null = null;
    for (const f of files) last = (await photo.upload(f)) ?? last;
    if (last) {
      setMessage(files.length > 1 ? `${files.length} photos uploaded. Add alt text to each.` : "Photo uploaded. Add its alt text.");
      setSelected(last.id);
      router.refresh();
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input ref={file} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFiles} />
        <button type="button" onClick={() => file.current?.click()} disabled={photo.uploading} className={button.primary}>
          <Upload aria-hidden="true" className="size-4" />
          {photo.uploading ? "Resizing and uploading…" : "Upload photos"}
        </button>
        <span className="text-[13px] text-cm-meta">Resized to 2000px WebP in your browser before upload. Up to 10 MB each.</span>
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {photo.error && <Notice tone="error">{photo.error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
      </div>

      {items.length === 0 ? (
        <EmptyState>{search ? `No photos match “${search}”.` : "No photos yet. Upload one, or add one from the article editor."}</EmptyState>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          {current && (
            <div className="order-first min-w-0 flex-[2_1_320px] lg:sticky lg:top-6 lg:order-last">
              <Details
                key={current.id + current.alt + current.focal_x + current.focal_y}
                item={current}
                canDelete={canDelete}
                onDone={(m) => {
                  setMessage(m);
                  if (m === "Photo deleted.") setSelected(null);
                  router.refresh();
                }}
              />
            </div>
          )}
          <ul aria-label="Photos" className="grid min-w-0 flex-[3_1_480px] grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={m.id === selected}
                  onClick={() => {
                    setSelected(m.id === selected ? null : m.id);
                    setMessage(null);
                  }}
                  className="block w-full border border-cm-rule bg-cm-white text-left hover:border-cm-black aria-pressed:outline aria-pressed:outline-3 aria-pressed:outline-cm-black"
                >
                  <span className="relative block aspect-[3/2] bg-cm-paper">
                    <Image src={mediaSrc(m)} alt="" fill sizes="(min-width: 1280px) 220px, 45vw" className="object-cover" style={{ objectPosition: focalPosition(m) }} />
                  </span>
                  <span className="block px-2.5 py-2">
                    <span className="line-clamp-2 block text-[13px] leading-snug">
                      {m.alt || <strong>No alt text yet</strong>}
                    </span>
                    <span className="block text-xs text-cm-meta">{m.used_by === 0 ? "Not used" : `Used ${m.used_by}×`}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
