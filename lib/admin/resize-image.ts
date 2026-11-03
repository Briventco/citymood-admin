// Browser-side resize before upload (ADMIN_SPEC §3, "Images"): longest side
// 2000px, WebP at quality 0.8, JPEG where the browser can't encode WebP. Saves
// reporters' mobile data and storage. Runs in the browser only.

export const MAX_SIDE = 2000;
export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;

export type Resized = { file: File; width: number; height: number };

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export async function resizeForUpload(original: File): Promise<Resized> {
  if (!original.type.startsWith("image/")) throw new Error("Choose a photo (JPEG, PNG, WebP or HEIC).");
  if (original.size > MAX_ORIGINAL_BYTES) throw new Error("That photo is over 10 MB. Choose a smaller one.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(original, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This browser can’t read that photo. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await toBlob(canvas, "image/webp", 0.8);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.8);
  if (!blob) throw new Error("We couldn’t prepare that photo. Try another one.");
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const name = original.name.replace(/\.[^.]+$/, "") || "photo";
  return { file: new File([blob], `${name}.${ext}`, { type: blob.type }), width, height };
}
