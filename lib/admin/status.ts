import type { Article, ArticleStatus } from "./types";

// The scheduling rule (ADMIN_SPEC §3): there is no cron job. A story is live when
// its status is published or scheduled AND publish_at <= now.

export function isLive(a: Pick<Article, "status" | "publish_at">, now: Date): boolean {
  return (
    (a.status === "published" || a.status === "scheduled") &&
    a.publish_at !== null &&
    Date.parse(a.publish_at) <= now.getTime()
  );
}

/** A scheduled story whose time has come shows as Published. */
export function effectiveStatus(a: Pick<Article, "status" | "publish_at">, now: Date): ArticleStatus {
  return a.status === "scheduled" && isLive(a, now) ? "published" : a.status;
}

/** Breaking and still inside its ticker window. */
export function isBreakingNow(a: Pick<Article, "breaking" | "breaking_until">, now: Date): boolean {
  return a.breaking && a.breaking_until !== null && Date.parse(a.breaking_until) > now.getTime();
}

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  unpublished: "Unpublished",
};
