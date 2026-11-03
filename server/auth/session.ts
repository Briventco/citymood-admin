import { redirect } from "next/navigation";

import type { Actor, Role } from "./permissions";
import { createClient } from "@/server/supabase/server";

export type CurrentActor = Actor & {
  displayName: string;
  email: string | null;
  status: "active" | "suspended" | "invited";
};

function isRole(value: string): value is Role {
  return ["reporter", "editor", "ad_manager", "administrator"].includes(value);
}

export async function getCurrentActor(): Promise<CurrentActor | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;
  if (typeof userId !== "string") return null;

  const [profileResult, rolesResult] = await Promise.all([
    supabase.from("profiles").select("id,display_name,status").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role_name").eq("user_id", userId),
  ]);

  if (profileResult.error || rolesResult.error || !profileResult.data) return null;
  const roles = (rolesResult.data ?? []).map((row) => row.role_name).filter(isRole);
  const status = profileResult.data.status;
  if (status !== "active" && status !== "suspended" && status !== "invited") return null;

  return {
    id: userId,
    roles,
    displayName: profileResult.data.display_name || "CityMood newsroom",
    email: typeof claims?.email === "string" ? claims.email : null,
    status,
  };
}

export async function requireStaff(): Promise<CurrentActor> {
  const actor = await getCurrentActor();
  if (!actor || actor.status !== "active" || actor.roles.length === 0) {
    redirect("/login?error=account_pending");
  }
  return actor;
}
