"use client";

import { createBrowserClient } from "@supabase/ssr";

/** detectSessionInUrl off lets a page handle auth links itself (see app/set-password). */
export function createClient(options: { detectSessionInUrl?: boolean } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase browser configuration is missing.");
  }

  return createBrowserClient(url, publishableKey, { auth: options });
}
