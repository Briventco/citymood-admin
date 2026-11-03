import type { Media } from "./types";

// Public URL for a file in the "media" bucket. The dev store keeps uploads in
// public/uploads/ and the seed photos in public/seed/. With Supabase this
// becomes `${SUPABASE_URL}/storage/v1/object/public/media/${storage_path}`.

export function mediaUrl(storagePath: string): string {
  if (storagePath.startsWith("seed/")) return `/${storagePath}`;
  return `/uploads/${storagePath}`;
}

export const mediaSrc = (m: Pick<Media, "storage_path">) => mediaUrl(m.storage_path);

/** CSS object-position from the stored focal point. */
export const focalPosition = (m: Pick<Media, "focal_x" | "focal_y">) =>
  `${Math.round(m.focal_x * 100)}% ${Math.round(m.focal_y * 100)}%`;
