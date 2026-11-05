import "server-only";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/server/supabase/server";
import { repoFor } from "./backend";
import { isNewsroomError } from "./errors";
import type { NewsroomRepo, Permissions, StaffMember } from "./repo";

// Staff sessions are Supabase Auth cookies (@supabase/ssr). proxy.ts refreshes
// them; the rest of the admin only calls getStaff(), requireStaff() and staffAction().

export type StaffContext = { repo: NewsroomRepo; me: StaffMember; can: Permissions };

/** The signed-in, active staff member for this request, or null. Cached per request. */
export const getStaff = cache(async (): Promise<StaffContext | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (typeof uid !== "string") return null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const repo = await repoFor(uid, email);
  const [me, can] = await Promise.all([repo.me(), repo.permissions()]);
  return me && can ? { repo, me, can } : null;
});

/** For pages: sends anyone without an active staff session to the sign-in screen. */
export async function requireStaff(): Promise<StaffContext> {
  const staff = await getStaff();
  if (!staff) redirect("/sign-in");
  return staff;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps every server action: re-checks the session (the proxy alone is not
 * enough), runs the change through the role-checked repo, and turns failures
 * into a plain sentence. Raw error codes never reach the screen.
 */
export async function staffAction<T>(fn: (ctx: StaffContext) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const staff = await getStaff();
    if (!staff) return { ok: false, error: "Your session has ended. Please sign in again." };
    return { ok: true, data: await fn(staff) };
  } catch (e) {
    unstable_rethrow(e);
    if (isNewsroomError(e)) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong and nothing was saved. Please try again." };
  }
}
