import type { Media } from "./types";

export const MEDIA_BUCKET = "article-media";

/** Public URL for a file in the storage bucket. */
export function mediaUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`;
}

export const mediaSrc = (m: Pick<Media, "storage_path">) => mediaUrl(m.storage_path);

/** CSS object-position from the stored focal point. */
export const focalPosition = (m: Pick<Media, "focal_x" | "focal_y">) =>
  `${Math.round(m.focal_x * 100)}% ${Math.round(m.focal_y * 100)}%`;
