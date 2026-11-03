"use client";

import { Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { focalPosition, mediaSrc } from "@/lib/admin/media-url";
import type { MediaItem } from "@/lib/admin/repo";
import { searchPhotos } from "../media-actions";
import { Notice, button, inputClass } from "./ui";
import { usePhotoUpload } from "./usePhotoUpload";

// Choose a photo from the media library, or upload a new one. Native <dialog>:
// focus stays inside and Esc closes it.

type Props = {
  open: boolean;
  title?: string;
  onPick: (media: MediaItem) => void;
  onClose: () => void;
};

export function MediaPicker({ open, title = "Choose a photo", onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photo = usePhotoUpload();

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
      const result = await searchPhotos(search);
      if (stale) return;
      if (result.ok) {
        setItems(result.data);
        setError(null);
      } else setError(result.error);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [open, search]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const media = await photo.upload(file);
    if (media) onPick(media);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="media-picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[calc(100vh-32px)] w-[min(880px,calc(100vw-32px))] border-2 border-cm-black bg-cm-white p-0 text-cm-black backdrop:bg-cm-black/60"
    >
      <div className="flex items-center justify-between gap-3 border-b border-cm-rule px-5 py-3">
        <h2 id="media-picker-title" className="text-sm font-extrabold uppercase tracking-[0.1em]">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className={button.icon}>
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5 px-5 pt-4">
        <label htmlFor="media-search" className="sr-only">
          Search photos
        </label>
        <input
          id="media-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search alt text, captions or credits"
          className={`${inputClass} flex-[3_1_240px]`}
        />
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={photo.uploading} className={button.secondary}>
          <Upload aria-hidden="true" className="size-4" />
          {photo.uploading ? "Uploading…" : "Upload new"}
        </button>
      </div>
      <div className="px-5 pt-3">
        {(error || photo.error) && <Notice tone="error">{error ?? photo.error}</Notice>}
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-5 pt-3 pb-5">
        {items === null ? (
          <p role="status" className="py-8 text-center text-cm-meta">
            Loading photos…
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center">{search ? "No photos match that search." : "No photos yet. Upload one."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className="block w-full text-left hover:outline hover:outline-2 hover:outline-cm-black"
                >
                  <span className="relative block aspect-[3/2] bg-cm-paper">
                    <Image
                      src={mediaSrc(m)}
                      alt=""
                      fill
                      sizes="200px"
                      className="object-cover"
                      style={{ objectPosition: focalPosition(m) }}
                    />
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[13px]">
                    {m.alt || <span className="font-bold">No alt text yet</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
