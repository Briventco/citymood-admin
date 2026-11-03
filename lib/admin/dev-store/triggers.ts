import { forbidden, invalid } from "../errors";
import { isLive } from "../status";
import type { Article, AuthUser, Profile } from "../types";
import type { PolicyContext } from "./policies";

// Triggers, transcribed from docs/design/admin/schema.sql.

export const BREAKING_HOURS = 6;
const HOUR = 3_600_000;

/**
 * public.guard_article(): BEFORE INSERT OR UPDATE on articles. Stamps the row,
 * applies the reporter limits and sets the breaking window. Mutates `next`.
 */
export function guardArticle(c: PolicyContext, next: Article, prev: Article | null): void {
  const r = c.role;
  if (!prev) {
    next.created_by = next.created_by ?? c.uid;
    if (r === "reporter") {
      if (next.featured) throw forbidden("Only editors can feature stories on the homepage.");
      if (next.author_id !== c.uid) throw forbidden("Reporters can only write under their own byline.");
    }
  } else {
    if (r === "reporter") {
      if (next.featured !== prev.featured) throw forbidden("Only editors can feature stories on the homepage.");
      if (next.author_id !== prev.author_id) throw forbidden("Only editors can change a byline.");
      // CityMood addition, not yet in schema.sql (OPEN_QUESTIONS.md): ADMIN_SPEC §2
      // gives unpublishing to editors, so a reporter can't take a live story down.
      if (isLive(prev, c.now) && (next.status === "draft" || next.status === "unpublished")) {
        throw forbidden("Only editors can unpublish a story.");
      }
    }
    // The slug is locked once a story has gone live.
    if ((prev.status === "published" || prev.status === "scheduled") && next.slug !== prev.slug) {
      throw invalid("The web address cannot change after publishing.");
    }
  }

  const now = c.now.toISOString();
  next.updated_at = now;
  next.updated_by = c.uid ?? next.updated_by;

  // Breaking: default 6-hour window from go-live; clearing the flag clears the window.
  if (next.breaking && next.breaking_until === null) {
    const goLive = Math.max(c.now.getTime(), next.publish_at ? Date.parse(next.publish_at) : c.now.getTime());
    next.breaking_until = new Date(goLive + BREAKING_HOURS * HOUR).toISOString();
  } else if (!next.breaking) {
    next.breaking_until = null;
  }
}

/** public.handle_new_user(): new auth users get an INACTIVE reporter profile. */
export function profileForNewUser(user: AuthUser, now: Date): Profile {
  return {
    id: user.id,
    full_name: user.raw_user_meta_data.full_name ?? "",
    role: "reporter",
    is_active: false,
    created_at: now.toISOString(),
  };
}
