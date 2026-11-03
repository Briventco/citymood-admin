import type { AdSlot } from "./types";

// What each ad slot is and the creative sizes it needs (DESIGN_SPEC §4.5 and the
// front-page reference). Shown beside every upload in the campaign form.

export type SlotInfo = {
  label: string;
  desktop: { width: number; height: number };
  /** Below 640px. Null when the slot uses the same creative everywhere. */
  mobile: { width: number; height: number } | null;
  where: string;
};

export const AD_SLOT_INFO: Record<AdSlot, SlotInfo> = {
  leaderboard: {
    label: "Leaderboard",
    desktop: { width: 970, height: 90 },
    mobile: { width: 320, height: 50 },
    where: "Top of the homepage. 728×90 boxes letterbox the 970×90 creative on tablets.",
  },
  mpu_1: {
    label: "MPU, first",
    desktop: { width: 300, height: 250 },
    mobile: null,
    where: "After Latest on phones and tablets, and beside Business on desktop.",
  },
  mpu_2: {
    label: "MPU, second",
    desktop: { width: 300, height: 250 },
    mobile: null,
    where: "After Business on phones and tablets.",
  },
  billboard: {
    label: "Billboard",
    desktop: { width: 970, height: 250 },
    mobile: null,
    where: "Above Tourism & Heritage, on desktop only.",
  },
};

export const sizeLabel = (s: { width: number; height: number }) => `${s.width}×${s.height}`;

export function slotSizes(slot: AdSlot): string {
  const info = AD_SLOT_INFO[slot];
  return info.mobile ? `${sizeLabel(info.desktop)} · ${sizeLabel(info.mobile)} on mobile` : sizeLabel(info.desktop);
}
