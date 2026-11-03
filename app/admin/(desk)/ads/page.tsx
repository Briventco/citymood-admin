import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AD_SLOT_INFO } from "@/lib/admin/ad-slots";
import type { CampaignItem } from "@/lib/admin/repo";
import { requireStaff } from "@/lib/admin/session";
import { formatDateRange } from "@/lib/admin/time";
import { AD_SLOTS } from "@/lib/admin/types";
import { Thumb } from "../../_components/Thumb";
import { EmptyState, PageHeader, PermissionDenied, button, pageClass } from "../../_components/ui";

export const metadata: Metadata = { title: "Ad campaigns" };

const state = (c: CampaignItem, now: number) =>
  Date.parse(c.starts_at) > now ? "Upcoming" : Date.parse(c.ends_at) < now ? "Ended" : "Running";

export default async function AdsPage() {
  const { repo, can } = await requireStaff();
  if (!can.editor) {
    return (
      <div className={pageClass}>
        <PermissionDenied need="Ad campaigns are managed by admins." />
      </div>
    );
  }
  const campaigns = await repo.listCampaigns();
  const now = new Date();

  return (
    <div className={pageClass}>
      <PageHeader
        title="Ad campaigns"
        note={can.admin ? "Direct-sold campaigns per slot. Changes show without a redeploy." : "Only admins can change campaigns"}
        actions={
          can.admin && (
            <Link href="/admin/ads/new" className={button.primary}>
              <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
              Add campaign
            </Link>
          )
        }
      />
      <p className="mb-4 text-sm">
        <Link href="/admin/front-page" className="font-bold underline">
          Back to the Front page
        </Link>
      </p>
      {campaigns.length === 0 ? (
        <EmptyState>No campaigns yet. Every slot shows the “Advertise with CityMood” house ad.</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {AD_SLOTS.map((slot) => {
            const list = campaigns.filter((c) => c.slot === slot);
            return (
              <section key={slot} aria-labelledby={`slot-${slot}`} className="border border-cm-rule bg-cm-white">
                <h2 id={`slot-${slot}`} className="border-b-2 border-cm-black px-4 py-3 text-sm font-extrabold uppercase tracking-[0.1em]">
                  {AD_SLOT_INFO[slot].label}
                </h2>
                {list.length === 0 ? (
                  <p className="px-4 py-3 text-[15px] text-cm-meta">No campaigns. The house ad shows.</p>
                ) : (
                  <ul>
                    {list.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cm-rule px-4 py-3 last:border-b-0">
                        <Thumb media={c.desktop ?? c.mobile} className="h-[43px] w-24" sizes="96px" />
                        <div className="min-w-0 flex-[1_1_200px]">
                          {can.admin ? (
                            <Link href={`/admin/ads/${c.id}`} className="text-base font-bold hover:underline">
                              {c.advertiser_name}
                            </Link>
                          ) : (
                            <p className="text-base font-bold">{c.advertiser_name}</p>
                          )}
                          <p className="text-sm text-cm-meta">{formatDateRange(c.starts_at, c.ends_at, now)}</p>
                        </div>
                        <span className="text-sm font-bold">{state(c, now.getTime())}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
