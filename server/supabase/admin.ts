import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { assertServerRuntime } from "@/server/runtime";
import { readServerEnvironment } from "@/server/env";

assertServerRuntime();

/**
 * Use only for narrowly scoped trusted operations after application-level
 * authorization. This key bypasses RLS and must never reach a browser.
 */
export function createAdminClient() {
  const { supabaseUrl, supabaseSecretKey } = readServerEnvironment();
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase admin configuration is missing.");
  }

  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
