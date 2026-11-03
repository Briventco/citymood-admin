import "server-only";
import path from "node:path";
import { asUser, ANON, DevDatabase, SERVICE, type Actor } from "./dev-store/database";
import { createDevPublicReader, createDevRepo } from "./dev-store/repo";
import { DEMO_USERS, buildSeed } from "./dev-store/seed";
import { fileStore, type DevStore } from "./dev-store/store";
import type { NewsroomPublicReader, NewsroomRepo } from "./repo";
import type { StaffRole, Uuid } from "./types";

// The one place that decides which backend the newsroom uses. Today: the dev
// JSON store. When Supabase arrives, these functions return Supabase-backed
// implementations of the same interfaces and nothing else changes.

/** The dev store runs in development, or in a production build only when ADMIN_DEV_STORE=1 (local demos). */
export const devStoreEnabled = process.env.NODE_ENV !== "production" || process.env.ADMIN_DEV_STORE === "1";

const STORE_PATH = process.env.ADMIN_DEV_STORE_PATH ?? path.join(process.cwd(), "data", "admin-dev.json");

const globalStore = globalThis as unknown as { __cityMoodDevStore?: DevStore };

export function devStore(): DevStore {
  if (!devStoreEnabled) throw new Error("The newsroom backend is not connected.");
  globalStore.__cityMoodDevStore ??= fileStore(STORE_PATH, () => buildSeed());
  return globalStore.__cityMoodDevStore;
}

/** A repo bound to one user (or anon), like a Supabase client carrying that session. */
export function repoFor(uid: Uuid | null): NewsroomRepo {
  const actor: Actor = uid ? asUser(uid) : ANON;
  return createDevRepo(devStore(), actor);
}

/** Reader for the public site, with anon rights only. */
export function publicReader(): NewsroomPublicReader {
  return createDevPublicReader(devStore());
}

// ───────────── Sign-in (Supabase: auth.signInWithPassword) ─────────────

/** Demo shortcuts exist only in development builds. */
export const demoMode = process.env.NODE_ENV !== "production";

/**
 * Checks an email and password and returns the user id of an active staff member.
 * The dev store has no passwords: in development any password signs you in, and
 * an email that isn't on the staff list signs you in as Publisher. In a
 * production build with ADMIN_DEV_STORE=1, the email must belong to active staff.
 */
export async function authenticate(email: string, password: string): Promise<Uuid | null> {
  if (!password) return null;
  const wanted = email.trim().toLowerCase();
  return devStore().write((data) => {
    const service = new DevDatabase(data, SERVICE);
    const known = service.select("auth_users", (u) => u.email === wanted)[0];
    const user = known ?? (demoMode ? service.select("auth_users", (u) => u.id === DEMO_USERS.admin.id)[0] : undefined);
    if (!user) return null;
    const active = service.select("profiles", (p) => p.id === user.id && p.is_active)[0];
    if (!active) return null;
    service.update("auth_users", (u) => u.id === user.id, { last_sign_in_at: new Date().toISOString() });
    return user.id;
  });
}

/** Development only: sign in as the seeded user for a role. */
export async function demoUserFor(role: StaffRole): Promise<Uuid> {
  if (!demoMode) throw new Error("Demo sign-in is not available.");
  const id = { admin: DEMO_USERS.admin.id, editor: DEMO_USERS.editor.id, reporter: DEMO_USERS.reporter.id }[role];
  await devStore().write((data) => {
    const service = new DevDatabase(data, SERVICE);
    // Re-activate the demo account if someone deactivated it while testing.
    service.update("profiles", (p) => p.id === id, { role, is_active: true });
    service.update("auth_users", (u) => u.id === id, { last_sign_in_at: new Date().toISOString() });
  });
  return id;
}
