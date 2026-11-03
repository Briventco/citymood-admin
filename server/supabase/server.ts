import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readServerEnvironment } from "@/server/env";

export async function createClient() {
  const { supabaseUrl, supabasePublishableKey } = readServerEnvironment();
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The root proxy refreshes
          // sessions and persists refreshed cookies for the next request.
        }
      },
    },
  });
}
