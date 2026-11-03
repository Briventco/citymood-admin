import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { devStore, devStoreEnabled, repoFor } from "./backend";
import { isNewsroomError } from "./errors";
import { permissionsFor, type NewsroomRepo, type Permissions, type StaffMember } from "./repo";
import type { Uuid } from "./types";

// Demo sessions for the dev store: an HMAC-signed cookie holding the user id.
// Supabase replaces this file with @supabase/ssr cookie sessions. The rest of the
// admin only calls getStaff(), requireStaff() and staffAction().

export const SESSION_COOKIE = "cm_newsroom";
const LONG_SESSION_SECONDS = 30 * 24 * 60 * 60;

async function signature(value: string): Promise<string> {
  return createHmac("sha256", await devStore().sessionSecret()).update(value).digest("base64url");
}

export async function startSession(uid: Uuid, keepSignedIn: boolean): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, `${uid}.${await signature(uid)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Without "Keep me signed in" this is a browser-session cookie.
    ...(keepSignedIn ? { maxAge: LONG_SESSION_SECONDS } : {}),
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

async function sessionUid(): Promise<Uuid | null> {
  // Reading the cookie first also keeps every admin page dynamic, whichever backend is configured.
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw || !devStoreEnabled) return null;
  const dot = raw.lastIndexOf(".");
  const uid = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(await signature(uid));
  return given.length === expected.length && timingSafeEqual(given, expected) ? uid : null;
}

export type StaffContext = { repo: NewsroomRepo; me: StaffMember; can: Permissions };

/** The signed-in, active staff member for this request, or null. Cached per request. */
export const getStaff = cache(async (): Promise<StaffContext | null> => {
  // No backend in this build (production without Supabase yet) means nobody is signed in.
  const uid = await sessionUid();
  if (!uid) return null;
  const repo = repoFor(uid);
  const me = await repo.me();
  return me ? { repo, me, can: permissionsFor(me.role) } : null;
});

/** For pages: sends anyone without an active staff session to the sign-in screen. */
export async function requireStaff(): Promise<StaffContext> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/sign-in");
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
