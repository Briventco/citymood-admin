"use server";

import { revalidatePath } from "next/cache";
import { invalid } from "@/lib/admin/errors";
import type { MediaItem, MediaWrite } from "@/lib/admin/repo";
import { staffAction } from "@/lib/admin/session";
import type { Media } from "@/lib/admin/types";
import { removeUpload, saveUpload } from "@/lib/admin/uploads";

// Photos, shared by the editor, the media library and ad campaigns.

/** The browser has already resized the file (lib/admin/resize-image.ts). */
export async function uploadPhoto(form: FormData) {
  return staffAction(async ({ repo, me }): Promise<MediaItem> => {
    const file = form.get("file");
    if (!(file instanceof File)) throw invalid("Choose a photo to upload.");
    const stored = await saveUpload(file);
    try {
      const media = await repo.createMedia({
        ...stored,
        alt: String(form.get("alt") ?? ""),
        caption: String(form.get("caption") ?? ""),
        credit: String(form.get("credit") ?? ""),
      });
      return { ...media, uploader_name: me.full_name, used_by: 0, can_edit: true };
    } catch (e) {
      await removeUpload(stored.storage_path);
      throw e;
    }
  });
}

export async function searchPhotos(search: string) {
  return staffAction(({ repo }) => repo.listMedia(search));
}

export async function updatePhoto(id: string, input: MediaWrite) {
  return staffAction(async ({ repo }): Promise<Media> => {
    const media = await repo.updateMedia(id, sanitize(input));
    revalidatePath("/", "layout");
    return media;
  });
}

export async function deletePhoto(id: string) {
  return staffAction(async ({ repo }) => {
    const gone = await repo.deleteMedia(id);
    await removeUpload(gone.storage_path);
    revalidatePath("/", "layout");
    return undefined;
  });
}

function sanitize(input: MediaWrite): MediaWrite {
  const out: MediaWrite = {};
  for (const key of ["alt", "caption", "credit"] as const) {
    if (typeof input[key] === "string") out[key] = input[key];
  }
  for (const key of ["focal_x", "focal_y"] as const) {
    const v = input[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.min(1, Math.max(0, Math.round(v * 100) / 100));
  }
  return out;
}
