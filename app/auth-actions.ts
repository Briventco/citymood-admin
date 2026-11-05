"use server";

import { redirect } from "next/navigation";
import { setPasswordUrl } from "@/lib/admin/backend";
import { createClient } from "@/server/supabase/server";

// Sign-in, sign-out and password reset, on Supabase Auth. The attempt limit here
// is the one the sign-in screen promises ("After 5 wrong attempts, sign-in pauses
// for 15 minutes"). It is per server process; Supabase Auth's own rate limits
// apply on top.

const MAX_ATTEMPTS = 5;
const PAUSE_MS = 15 * 60_000;
const failures = new Map<string, number[]>();

export type SignInState = { error?: string; email?: string } | null;

/** Only same-site admin paths, so ?next= can't send anyone elsewhere. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return /^\/(?!\/)[\w\-/?=&%.]*$/.test(n) && !n.startsWith("/sign-in") ? n : "/articles";
}

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const key = email.toLowerCase();
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < PAUSE_MS);

  if (!email || !password) return { error: "Enter your email and password.", email };
  if (recent.length >= MAX_ATTEMPTS) {
    return { error: "Too many wrong attempts. Sign-in is paused for 15 minutes for this email.", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: key, password });
  if (error || !data.user) {
    failures.set(key, [...recent, now]);
    return { error: "That email and password don’t match an active staff account.", email };
  }

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    failures.set(key, [...recent, now]);
    return { error: "That email and password don’t match an active staff account.", email };
  }
  failures.delete(key);
  await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);
  redirect(safeNext(form.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export type ResetState = { sent?: boolean; error?: string } | null;

export async function requestPasswordReset(_prev: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the email address you sign in with." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await setPasswordUrl() });
  if (error) console.error("Password reset request failed", { status: error.status });
  // Same answer whether or not the account exists, so the form can't be used to find staff emails.
  return { sent: true };
}
