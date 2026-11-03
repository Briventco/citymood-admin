import Image from "next/image";
import { focalPosition, mediaSrc } from "@/lib/admin/media-url";
import type { Media } from "@/lib/admin/types";

// Small decorative thumbnail (the headline beside it names the story). Without a
// photo it is an empty paper box, which is fine inside the newsroom.
export function Thumb({ media, className = "h-[43px] w-16", sizes = "64px" }: { media: Media | null; className?: string; sizes?: string }) {
  return (
    <div aria-hidden="true" className={`relative shrink-0 overflow-hidden bg-cm-paper ${className}`}>
      {media && (
        <Image
          src={mediaSrc(media)}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
          style={{ objectPosition: focalPosition(media) }}
        />
      )}
    </div>
  );
}
