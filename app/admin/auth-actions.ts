"use server";

import { redirect } from "next/navigation";
import { authenticate, demoMode, demoUserFor, devStoreEnabled } from "@/lib/admin/backend";
import { endSession, startSession } from "@/lib/admin/session";
import type { StaffRole } from "@/lib/admin/types";

// Sign-in, sign-out and password reset. The attempt limit here is the one the
// sign-in screen promises ("After 5 wrong attempts, sign-in pauses for 15
// minutes"). With Supabase, configure the same limit in Auth settings, or
// remove that sentence (ADMIN_SPEC §3).

const MAX_ATTEMPTS = 5;
const PAUSE_MS = 15 * 60_000;
const failures = new Map<string, number[]>();

export type SignInState = { error?: string; email?: string } | null;

/** Only same-site admin paths, so ?next= can't send anyone elsewhere. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return /^\/admin(\/[\w\-/?=&%.]*)?$/.test(n) && !n.startsWith("/admin/sign-in") ? n : "/admin/articles";
}

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const key = email.toLowerCase();
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < PAUSE_MS);

  if (!devStoreEnabled) return { error: "The newsroom isn’t connected to its database yet, so sign-in is unavailable.", email };
  if (!email || !password) return { error: "Enter your email and password.", email };
  if (recent.length >= MAX_ATTEMPTS) {
    return { error: "Too many wrong attempts. Sign-in is paused for 15 minutes for this email.", email };
  }

  const uid = await authenticate(email, password);
  if (!uid) {
    failures.set(key, [...recent, now]);
    return { error: "That email and password don’t match an active staff account.", email };
  }
  failures.delete(key);
  await startSession(uid, form.get("keep") === "on");
  redirect(safeNext(form.get("next")));
}

/** Development builds only: the "Demo mode: sign in as …" switcher. */
export async function demoSignIn(role: StaffRole): Promise<void> {
  if (!demoMode) throw new Error("Demo sign-in is not available.");
  await startSession(await demoUserFor(role), true);
  redirect("/admin/articles");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/admin/sign-in");
}

export type ResetState = { sent?: boolean; error?: string } | null;

/** Supabase sends a reset email linking to /admin/reset-password. The dev store has no email, so this only confirms. */
export async function requestPasswordReset(_prev: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the email address you sign in with." };
  // Same answer whether or not the account exists, so the form can't be used to find staff emails.
  return { sent: true };
}
