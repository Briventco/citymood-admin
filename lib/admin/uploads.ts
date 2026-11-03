import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { invalid } from "./errors";
import { imageInfo } from "./image-size";

// Photo files for the dev store, in public/uploads/ (gitignored), laid out like
// the Supabase "media" bucket: yyyy/mm/<uuid>.webp. Supabase replaces this file
// with Storage uploads and deletes.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ROOT = path.join(process.cwd(), "public", "uploads");

export async function saveUpload(file: File): Promise<{ storage_path: string; width: number; height: number }> {
  if (file.size === 0) throw invalid("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw invalid("Photos must be under 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageInfo(bytes);
  if (!info || !info.width || !info.height) throw invalid("Upload a photo (JPEG, PNG or WebP).");
  const now = new Date();
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storage_path = `${dir}/${randomUUID()}.${info.ext}`;
  await fs.mkdir(path.join(ROOT, dir), { recursive: true });
  await fs.writeFile(path.join(ROOT, storage_path), bytes);
  return { storage_path, width: info.width, height: info.height };
}

export async function removeUpload(storagePath: string): Promise<void> {
  // Seed photos live in public/seed/ and are never deleted.
  if (storagePath.startsWith("seed/") || storagePath.includes("..")) return;
  await fs.rm(path.join(ROOT, storagePath), { force: true });
}
