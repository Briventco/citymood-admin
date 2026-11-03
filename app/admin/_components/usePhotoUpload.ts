"use client";

import { useState } from "react";
import type { MediaItem } from "@/lib/admin/repo";
import { resizeForUpload } from "@/lib/admin/resize-image";
import { uploadPhoto } from "../media-actions";

/** Resize in the browser, then upload. Returns the new media row, or sets `error`. */
export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File, meta: { alt?: string; credit?: string } = {}): Promise<MediaItem | null> {
    setError(null);
    setUploading(true);
    try {
      const resized = await resizeForUpload(file);
      const form = new FormData();
      form.set("file", resized.file);
      if (meta.alt) form.set("alt", meta.alt);
      if (meta.credit) form.set("credit", meta.credit);
      const result = await uploadPhoto(form);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      return result.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload didn’t work. Try again.");
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error, clearError: () => setError(null) };
}
