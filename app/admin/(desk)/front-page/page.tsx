import type { Metadata } from "next";
import Link from "next/link";
import { getHomepage, type Article } from "@/lib/content";
import { AD_SLOT_INFO, slotSizes } from "@/lib/admin/ad-slots";
import type { CampaignItem } from "@/lib/admin/repo";
import { requireStaff } from "@/lib/admin/session";
import { formatClock, formatDateRange, formatShortDate } from "@/lib/admin/time";
import { AD_SLOTS, TOP_SLOTS } from "@/lib/admin/types";
import { PageHeader, Panel, PermissionDenied, button, pageClass } from "../../_components/ui";
import { BreakingPanel, LeadPanel, MostReadPanel, TopStoriesPanel, type Story } from "./FrontPageControls";

export const metadata: Metadata = { title: "Front page" };

// What the homepage shows is computed by the same code the homepage uses
// (lib/content getHomepage), so "automatic" here always matches the site.

export default async function FrontPagePage() {
  const { repo, can } = await requireStaff();
  if (!can.editor) {
    return (
      <div className={pageClass}>
        <PermissionDenied need="The Front page is run by editors." />
      </div>
    );
  }

  const now = new Date();
  const [{ home, categories }, front, breaking, live, campaigns] = await Promise.all([
    getHomepage(now),
    repo.getFrontPage(),
    repo.listBreaking(),
    repo.searchLiveArticles("", 1000),
    repo.listCampaigns(),
  ]);

  const categoryName = (slug: string | null) => categories.find((c) => c.slug === slug)?.name ?? null;
  const story = (a: Article): Story => ({
    id: a.id,
    headline: a.title,
    categoryName: categoryName(a.category),
    imageSrc: a.image?.src ?? null,
    focal: a.image?.focalPoint ? `${a.image.focalPoint.x * 100}% ${a.image.focalPoint.y * 100}%` : "50% 50%",
  });

  const pin = (slot: string) => front.pins.find((p) => p.slot === slot);
  const leadPin = pin("lead");
  const leadPinned = !!leadPin && home.lead?.id === leadPin.article_id;
  const pinnedTopIds = TOP_SLOTS.map((slot) => pin(slot)?.article_id ?? null);
  const liveById = new Map(live.map((a) => [a.id, a]));

  const running = (slot: string) =>
    campaigns.find((c) => c.slot === slot && Date.parse(c.starts_at) <= now.getTime() && now.getTime() <= Date.parse(c.ends_at));
  const upcoming = (slot: string) =>
    campaigns
      .filter((c) => c.slot === slot && Date.parse(c.starts_at) > now.getTime())
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  const campaignLine = (c: CampaignItem) =>
    Date.parse(c.starts_at) <= now.getTime() - 24 * 3_600_000
      ? `${c.advertiser_name} · ends ${formatShortDate(c.ends_at, now)}`
      : `${c.advertiser_name} · ${formatDateRange(c.starts_at, c.ends_at, now)}`;

  return (
    <div className={pageClass}>
      <PageHeader
        title="Front page"
        note="Changes show on the homepage straight away"
        actions={
          <Link href="/" target="_blank" className={button.secondary}>
            View homepage<span className="sr-only"> (opens in a new tab)</span>
          </Link>
        }
      />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[3_1_480px] flex-col gap-6">
          <LeadPanel
            lead={home.lead ? story(home.lead) : null}
            pinned={leadPinned}
            pinnedNote={leadPin ? `Pinned by ${leadPin.pinned_by_name ?? "an editor"} at ${formatClock(leadPin.pinned_at)}` : null}
            pinNotLive={!!leadPin && !leadPinned}
          />
          <BreakingPanel
            items={breaking.map((b) => ({ id: b.id, headline: b.headline, until: b.breaking_until! }))}
            now={now.toISOString()}
          />
          <TopStoriesPanel
            slots={home.topSlots.map((a, i) => ({ story: a ? story(a) : null, pinned: !!a && pinnedTopIds[i] === a.id }))}
            pinnedIds={pinnedTopIds}
          />
        </div>

        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-6">
          <MostReadPanel
            picks={front.picks.map((p) => {
              const a = liveById.get(p.article_id);
              return { id: p.article_id, headline: a?.headline ?? "A story that isn’t live", live: !!a };
            })}
          />
          <Panel id="ads-h" title="Ad slots" note="Empty slots show the “Advertise with CityMood” house ad">
            <ul>
              {AD_SLOTS.map((slot) => {
                const now_ = running(slot);
                const next = upcoming(slot);
                return (
                  <li key={slot} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-cm-rule py-3">
                    <div className="min-w-0 flex-[1_1_180px]">
                      <p className="text-[15px] font-bold">
                        {AD_SLOT_INFO[slot].label} <span className="font-semibold text-cm-meta">{slotSizes(slot)}</span>
                      </p>
                      <p className="text-sm">{now_ ? campaignLine(now_) : "House ad (empty)"}</p>
                      {next && (
                        <p className="text-[13px] text-cm-meta">
                          Next: {next.advertiser_name} from {formatShortDate(next.starts_at, now)}
                        </p>
                      )}
                    </div>
                    {can.admin &&
                      (now_ ? (
                        <Link href={`/admin/ads/${now_.id}`} className={button.outline}>
                          Change creative<span className="sr-only">: {AD_SLOT_INFO[slot].label}</span>
                        </Link>
                      ) : (
                        <Link href={`/admin/ads/new?slot=${slot}`} className={button.outline}>
                          Add campaign<span className="sr-only">: {AD_SLOT_INFO[slot].label}</span>
                        </Link>
                      ))}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              {!can.admin && <span className="text-cm-meta">Admins manage ad campaigns.</span>}
              <Link href="/admin/ads" className="inline-flex min-h-11 items-center font-bold underline">
                All campaigns
              </Link>
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
