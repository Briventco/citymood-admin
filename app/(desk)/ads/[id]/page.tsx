import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin/session";
import { isoToLagos } from "@/lib/admin/time";
import { AD_SLOTS, type AdSlot } from "@/lib/admin/types";
import { PageHeader, PermissionDenied, pageClass } from "../../../_components/ui";
import { CampaignEditor } from "./CampaignEditor";

export const metadata: Metadata = { title: "Ad campaign" };

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { id } = await params;
  const { repo, can } = await requireStaff();
  if (!can.admin) {
    return (
      <div className={pageClass}>
        <PermissionDenied need="Ad campaigns are managed by admins." />
      </div>
    );
  }
  const campaign = id === "new" ? null : await repo.getCampaign(id);
  if (id !== "new" && !campaign) notFound();
  const others = (await repo.listCampaigns()).filter((c) => c.id !== campaign?.id);
  const slotParam = (await searchParams).slot;
  const slot: AdSlot = campaign?.slot ?? (AD_SLOTS.includes(slotParam as AdSlot) ? (slotParam as AdSlot) : "leaderboard");

  // New campaigns start today at 00:00 and run for 30 days.
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const startsAt = campaign?.starts_at ?? new Date(start.getTime() - 3_600_000).toISOString();
  const endsAt = campaign?.ends_at ?? new Date(start.getTime() + 30 * 86_400_000 - 3_600_000 - 60_000).toISOString();

  return (
    <div className={pageClass}>
      <PageHeader title={campaign ? campaign.advertiser_name : "New campaign"} note="Ad campaign" />
      <CampaignEditor
        id={campaign?.id ?? null}
        initial={{
          slot,
          advertiser_name: campaign?.advertiser_name ?? "",
          link_url: campaign?.link_url ?? "",
          alt: campaign?.alt ?? "",
          desktop: campaign?.desktop ?? null,
          mobile: campaign?.mobile ?? null,
          start: isoToLagos(startsAt),
          end: isoToLagos(endsAt),
        }}
        others={others.map((c) => ({ slot: c.slot, advertiser_name: c.advertiser_name, starts_at: c.starts_at, ends_at: c.ends_at }))}
        running={!!campaign && Date.parse(campaign.starts_at) <= now.getTime() && now.getTime() <= Date.parse(campaign.ends_at)}
      />
    </div>
  );
}
