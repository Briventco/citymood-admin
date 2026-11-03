import "server-only";
import { site } from "@/config/site";
import { publicReader } from "@/lib/admin/backend";
import { mediaUrl } from "@/lib/admin/media-url";
import type { PublicArticle, PublicCampaign } from "@/lib/admin/repo";
import { plainText } from "@/lib/admin/richtext";
import { TOP_SLOTS, type Media } from "@/lib/admin/types";
import { defaultCategories } from "./categories";
import type { AdCreative, Article, ArticleImage, Category, ContentSource } from "./types";

// The public site reading the newsroom (admin) store with anon rights, following
// ADMIN_SPEC §5. Only live stories, visible categories and running campaigns
// come through. The Supabase adapter will keep this shape.

const SHORT_NAMES = new Map(defaultCategories.map((c) => [c.slug, c.shortName]));

function image(m: Media | null, alt?: string): ArticleImage | null {
  if (!m || !m.width || !m.height) return null;
  return {
    src: mediaUrl(m.storage_path),
    alt: alt ?? m.alt,
    width: m.width,
    height: m.height,
    focalPoint: { x: m.focal_x, y: m.focal_y },
    caption: m.caption || undefined,
    credit: m.credit || undefined,
  };
}

const creative = (m: Media | null): AdCreative | null =>
  m && m.width && m.height ? { src: mediaUrl(m.storage_path), width: m.width, height: m.height } : null;

function toArticle(a: PublicArticle): Article {
  return {
    id: a.id,
    slug: a.slug,
    title: a.headline,
    standfirst: a.standfirst,
    body: plainText(a.body),
    image: image(a.image),
    category: a.category?.slug ?? null,
    tags: a.tag_names,
    author: a.author_name ?? site.name,
    publishedAt: a.publish_at!,
    featured: a.featured,
    breakingUntil: a.breaking ? a.breaking_until : null,
  };
}

function toCampaign(c: PublicCampaign) {
  return {
    slot: c.slot,
    advertiser: c.advertiser_name,
    href: c.link_url,
    alt: c.alt,
    desktop: creative(c.desktop),
    mobile: creative(c.mobile),
  };
}

export const newsroomSource: ContentSource = {
  async categories(): Promise<Category[]> {
    return (await publicReader().categories()).map((c) => ({
      slug: c.slug,
      name: c.name,
      shortName: SHORT_NAMES.get(c.slug) ?? c.name.split(/\s+/)[0],
      order: c.position,
    }));
  },

  async articles(now) {
    return (await publicReader().liveArticles(now)).map(toArticle);
  },

  async frontPage() {
    const { pins, picks } = await publicReader().frontPage();
    const pinned = new Map(pins.map((p) => [p.slot, p.article_id]));
    return {
      leadId: pinned.get("lead") ?? null,
      topIds: TOP_SLOTS.map((slot) => pinned.get(slot) ?? null),
      mostReadIds: picks.map((p) => p.article_id),
    };
  },

  async adCampaigns(now) {
    return (await publicReader().runningCampaigns(now)).map(toCampaign);
  },

  async siteSettings() {
    const s = await publicReader().settings();
    const label = (network: string) => site.social.find((x) => x.network === network)?.label ?? network;
    return {
      contact: {
        address: s.newsroom_address,
        phone: s.newsroom_phone,
        newsroomEmail: s.newsroom_email,
        correctionsEmail: s.corrections_email,
      },
      social: [
        { network: "Facebook", label: label("Facebook"), url: s.facebook_url },
        { network: "Instagram", label: label("Instagram"), url: s.instagram_url },
        { network: "TikTok", label: label("TikTok"), url: s.tiktok_url },
      ].filter((x) => x.url),
    };
  },
};
