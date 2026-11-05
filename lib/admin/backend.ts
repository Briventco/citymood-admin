import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/server/supabase/admin";
import { createClient } from "@/server/supabase/server";
import { createSupabaseRepo, type SupabaseRepo } from "./supabase/repo";
import type { Uuid } from "./types";

// The one place that builds the newsroom data layer for a request.

/** Where staff land from invite and reset emails. Add it to Supabase Auth's redirect URLs. */
export async function setPasswordUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_ADMIN_URL;
  const origin = configured || (await headers()).get("origin") || "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/set-password`;
}

/** A repo bound to the signed-in user's session, so RLS applies to everything it does. */
export async function repoFor(uid: Uuid, email: string | null): Promise<SupabaseRepo> {
  return createSupabaseRepo({
    client: await createClient(),
    uid,
    email,
    service: createAdminClient,
    setPasswordUrl,
  });
}
