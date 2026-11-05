import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/server/supabase/server";
import { invalid } from "./errors";
import { imageInfo } from "./image-size";
import { MEDIA_BUCKET } from "./media-url";

// Photo files in the Supabase storage bucket, as yyyy/mm/<uuid>.webp. Uploads use
// the signed-in user's session, so storage policies apply. The limit matches the
// bucket's own; browsers resize to 2000px WebP first, usually well under this.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function saveUpload(file: File) {
  if (file.size === 0) throw invalid("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw invalid("Photos must be under 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageInfo(bytes);
  if (!info || !info.width || !info.height) throw invalid("Upload a photo (JPEG, PNG or WebP).");

  const now = new Date();
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storage_path = `${dir}/${randomUUID()}.${info.ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storage_path, bytes, {
    contentType: info.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("Photo upload failed", { message: error.message });
    throw invalid("The photo couldn't be uploaded. Try again.");
  }
  return { storage_path, width: info.width, height: info.height, mime_type: info.type, byte_size: file.size };
}

export async function removeUpload(storagePath: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
  if (error) console.error("Photo file was not removed", { path: storagePath, message: error.message });
}
