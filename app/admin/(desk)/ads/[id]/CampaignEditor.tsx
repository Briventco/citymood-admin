"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AD_SLOT_INFO, sizeLabel } from "@/lib/admin/ad-slots";
import { mediaSrc } from "@/lib/admin/media-url";
import { lagosToIso } from "@/lib/admin/time";
import { AD_SLOTS, type AdSlot, type Media } from "@/lib/admin/types";
import { ConfirmDialog } from "../../../_components/ConfirmDialog";
import { MediaPicker } from "../../../_components/MediaPicker";
import { Notice, Panel, button, inputClass, labelClass, selectClass } from "../../../_components/ui";
import { usePhotoUpload } from "../../../_components/usePhotoUpload";
import { deleteCampaign, endCampaign, saveCampaign } from "../actions";

// Campaign form (ADMIN_SPEC §4, /admin/ads/[id]): slot, advertiser, desktop and
// mobile creatives with the slot's pixel size beside each upload, link, alt
// text, and start and end in Lagos time.

type DateTime = { date: string; time: string };

type Initial = {
  slot: AdSlot;
  advertiser_name: string;
  link_url: string;
  alt: string;
  desktop: Media | null;
  mobile: Media | null;
  start: DateTime;
  end: DateTime;
};

type Other = { slot: AdSlot; advertiser_name: string; starts_at: string; ends_at: string };

function sizeWarning(media: Media | null, want: { width: number; height: number }): string | null {
  if (!media?.width || !media.height) return null;
  const ratio = media.width / media.height;
  const target = want.width / want.height;
  if (Math.abs(ratio - target) / target > 0.03) {
    return `This creative is ${media.width}×${media.height}, a different shape from ${sizeLabel(want)}. It will show with blank bands (letterboxed), never stretched.`;
  }
  if (media.width < want.width) return `This creative is ${media.width}×${media.height}, smaller than ${sizeLabel(want)}, so it may look soft.`;
  return null;
}

function Creative({
  id,
  label,
  want,
  optional,
  media,
  onChange,
}: {
  id: string;
  label: string;
  want: { width: number; height: number };
  optional?: string;
  media: Media | null;
  onChange: (m: Media | null) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const photo = usePhotoUpload();
  const warning = sizeWarning(media, want);

  return (
    <div>
      <p id={`${id}-label`} className={labelClass}>
        {label} <span className="font-semibold text-cm-meta">{sizeLabel(want)} px</span>
      </p>
      {optional && <p className="-mt-0.5 mb-1.5 text-[13px] text-cm-meta">{optional}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex h-[120px] w-full max-w-[360px] items-center justify-center border border-dashed border-cm-ad-border bg-cm-paper">
          {media ? (
            <Image src={mediaSrc(media)} alt="" fill sizes="360px" className="object-contain" />
          ) : (
            <span className="text-[13px] text-cm-meta">No creative</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const m = await photo.upload(f);
              if (m) onChange(m);
            }}
          />
          <button type="button" aria-describedby={`${id}-label`} disabled={photo.uploading} onClick={() => file.current?.click()} className={button.outline}>
            {photo.uploading ? "Uploading…" : media ? "Upload a new one" : "Upload"}
          </button>
          <button type="button" aria-describedby={`${id}-label`} onClick={() => setPicking(true)} className={button.outline}>
            From library
          </button>
          {media && (
            <button type="button" aria-describedby={`${id}-label`} onClick={() => onChange(null)} className={button.destructive}>
              Remove
            </button>
          )}
        </div>
      </div>
      {warning && <p className="mt-1.5 text-[13px] font-bold">{warning}</p>}
      {photo.error && (
        <div className="mt-2">
          <Notice tone="error">{photo.error}</Notice>
        </div>
      )}
      <MediaPicker
        open={picking}
        title={`${label} (${sizeLabel(want)})`}
        onClose={() => setPicking(false)}
        onPick={(m) => {
          setPicking(false);
          onChange(m);
        }}
      />
    </div>
  );
}

function DateTimeFields({ legend, value, onChange, id }: { legend: string; value: DateTime; onChange: (v: DateTime) => void; id: string }) {
  return (
    <fieldset className="min-w-0 flex-[1_1_220px]">
      <legend className={labelClass}>{legend}</legend>
      <div className="flex gap-2">
        <label htmlFor={`${id}-date`} className="sr-only">
          {legend} date
        </label>
        <input id={`${id}-date`} type="date" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} className={`${inputClass} flex-[3]`} />
        <label htmlFor={`${id}-time`} className="sr-only">
          {legend} time
        </label>
        <input id={`${id}-time`} type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} className={`${inputClass} flex-[2]`} />
      </div>
    </fieldset>
  );
}

export function CampaignEditor({ id, initial, others, running }: { id: string | null; initial: Initial; others: Other[]; running: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "delete" | "end">(null);
  const info = AD_SLOT_INFO[form.slot];
  const set = (patch: Partial<Initial>) => setForm((f) => ({ ...f, ...patch }));

  const startsAt = lagosToIso(form.start.date, form.start.time);
  const endsAt = lagosToIso(form.end.date, form.end.time);
  const overlaps =
    startsAt && endsAt
      ? others.filter((o) => o.slot === form.slot && Date.parse(o.starts_at) < Date.parse(endsAt) && Date.parse(startsAt) < Date.parse(o.ends_at))
      : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await saveCampaign(id, {
        slot: form.slot,
        advertiser_name: form.advertiser_name,
        image_desktop_id: form.desktop?.id ?? null,
        image_mobile_id: form.mobile?.id ?? null,
        link_url: form.link_url,
        alt: form.alt,
        start: form.start,
        end: form.end,
      });
      if (!result.ok) return setError(result.error);
      router.push("/admin/ads");
    });
  }

  const after = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "That didn’t work. Try again.");
        setConfirm(null);
        return;
      }
      router.push("/admin/ads");
    });

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[860px] flex-col gap-5">
      {error && <Notice tone="error">{error}</Notice>}
      <Panel id="campaign-h" title="Campaign">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="slot" className={labelClass}>
              Slot
            </label>
            <select id="slot" value={form.slot} onChange={(e) => set({ slot: e.target.value as AdSlot })} aria-describedby="slot-where" className={selectClass}>
              {AD_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {AD_SLOT_INFO[s].label}
                </option>
              ))}
            </select>
            <p id="slot-where" className="mt-1 text-[13px] text-cm-meta">
              {info.where}
            </p>
          </div>
          <div>
            <label htmlFor="advertiser" className={labelClass}>
              Advertiser name
            </label>
            <input id="advertiser" value={form.advertiser_name} onChange={(e) => set({ advertiser_name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="link" className={labelClass}>
              Link URL
            </label>
            <input id="link" type="url" inputMode="url" value={form.link_url} onChange={(e) => set({ link_url: e.target.value })} placeholder="https://" className={inputClass} />
          </div>
          <div>
            <label htmlFor="ad-alt" className={labelClass}>
              Alt text
            </label>
            <input id="ad-alt" value={form.alt} onChange={(e) => set({ alt: e.target.value })} aria-describedby="ad-alt-hint" className={inputClass} />
            <p id="ad-alt-hint" className="mt-1 text-[13px] text-cm-meta">
              What the advert says, for screen reader users. For example: “Brand name: spring sale, 20% off”.
            </p>
          </div>
        </div>
      </Panel>

      <Panel id="creatives-h" title="Creatives">
        <div className="flex flex-col gap-5">
          <Creative id="desktop" label={info.mobile ? "Desktop creative" : "Creative"} want={info.desktop} media={form.desktop} onChange={(m) => set({ desktop: m })} />
          {info.mobile && (
            <Creative
              id="mobile"
              label="Mobile creative"
              want={info.mobile}
              optional="Shown below 640px. Without one, the desktop creative is scaled down."
              media={form.mobile}
              onChange={(m) => set({ mobile: m })}
            />
          )}
        </div>
      </Panel>

      <Panel id="dates-h" title="Dates" aside="Lagos time (WAT)">
        <div className="flex flex-wrap gap-4">
          <DateTimeFields id="start" legend="Starts" value={form.start} onChange={(v) => set({ start: v })} />
          <DateTimeFields id="end" legend="Ends" value={form.end} onChange={(v) => set({ end: v })} />
        </div>
        {overlaps.length > 0 && (
          <p className="mt-3 text-sm font-bold">
            Overlaps with {overlaps.map((o) => o.advertiser_name).join(", ")} in this slot. While both run, the one that started most
            recently shows.
          </p>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-2.5">
        <button type="submit" disabled={pending} className={button.primary}>
          {pending ? "Saving…" : id ? "Save campaign" : "Create campaign"}
        </button>
        <button type="button" onClick={() => router.push("/admin/ads")} className={button.secondary}>
          Cancel
        </button>
        {id && running && (
          <button type="button" onClick={() => setConfirm("end")} className={`${button.destructive} ml-auto`}>
            End now
          </button>
        )}
        {id && (
          <button type="button" onClick={() => setConfirm("delete")} className={`${button.destructive} ${running ? "" : "ml-auto"}`}>
            Delete campaign
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "end"}
        title="End this campaign now?"
        confirmLabel="End now"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => after(() => endCampaign(id!))}
      >
        The slot goes back to the house ad straight away. The campaign stays in the list as ended.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete this campaign?"
        confirmLabel="Delete"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => after(() => deleteCampaign(id!))}
      >
        It’s removed from the list. The creatives stay in the media library. This can’t be undone.
      </ConfirmDialog>
    </form>
  );
}
