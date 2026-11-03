"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { mediaSrc } from "@/lib/admin/media-url";
import type { Media } from "@/lib/admin/types";

// Sets a photo's focal point: click the photo, or use the arrow keys (Shift for
// bigger steps) when it has focus. The whole photo is shown (letterboxed) so a
// click maps to the right spot. Public pages crop around the point with
// object-position.

export type ImageMetaPatch = Partial<Pick<Media, "alt" | "caption" | "credit" | "focal_x" | "focal_y">>;

/** The photo's box inside a 16:9 (or 16:10) frame, drawn with object-contain so clicks map to the whole photo. */
function containRect(frameW: number, frameH: number, w: number, h: number) {
  const scale = Math.min(frameW / w, frameH / h);
  const width = w * scale;
  const height = h * scale;
  return { left: (frameW - width) / 2, top: (frameH - height) / 2, width, height };
}

export function FocalPicker({ image, onMeta, ratio }: { image: Media; onMeta: (patch: ImageMetaPatch) => void; ratio: string }) {
  const frame = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const w = image.width ?? 3;
  const h = image.height ?? 2;
  const rect = size ? containRect(size.w, size.h, w, h) : null;
  const set = (x: number, y: number) =>
    onMeta({ focal_x: Math.round(Math.min(1, Math.max(0, x)) * 100) / 100, focal_y: Math.round(Math.min(1, Math.max(0, y)) * 100) / 100 });

  return (
    <button
      ref={frame}
      type="button"
      aria-label={`Focal point: ${Math.round(image.focal_x * 100)}% across, ${Math.round(image.focal_y * 100)}% down. Click the photo or use the arrow keys to move it.`}
      onClick={(e) => {
        const el = frame.current!;
        const box = el.getBoundingClientRect();
        const r = containRect(box.width, box.height, w, h);
        set((e.clientX - box.left - r.left) / r.width, (e.clientY - box.top - r.top) / r.height);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.05;
        const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const m = moves[e.key];
        if (!m) return;
        e.preventDefault();
        set(image.focal_x + m[0], image.focal_y + m[1]);
      }}
      className={`relative block w-full cursor-crosshair overflow-hidden bg-cm-black ${ratio}`}
    >
      <Image src={mediaSrc(image)} alt="" fill sizes="(min-width: 1024px) 440px, 100vw" className="object-contain" />
      {rect && (
        <span
          aria-hidden="true"
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 border-2 border-cm-lime outline outline-1 outline-cm-black"
          style={{ left: rect.left + image.focal_x * rect.width, top: rect.top + image.focal_y * rect.height }}
        />
      )}
    </button>
  );
}
