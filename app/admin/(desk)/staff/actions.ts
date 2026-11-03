"use server";

import { refresh } from "next/cache";
import { staffAction } from "@/lib/admin/session";
import type { StaffRole } from "@/lib/admin/types";

// Staff management (admins). With Supabase, inviteStaff calls
// auth.admin.inviteUserByEmail from a server-only module using the service
// role, then sets the role and activates the profile (ADMIN_SPEC §3).

export async function inviteStaff(input: { email: string; full_name: string; role: StaffRole }) {
  return staffAction(async ({ repo }) => {
    const member = await repo.inviteStaff(input);
    refresh();
    return { email: member.email };
  });
}

export async function resendInvite(id: string) {
  return staffAction(async ({ repo }) => {
    await repo.resendInvite(id);
    refresh();
    return undefined;
  });
}

/** Removing someone keeps their stories and bylines; their sessions stop working at once. */
export async function updateStaff(id: string, input: { role?: StaffRole; is_active?: boolean }) {
  return staffAction(async ({ repo }) => {
    await repo.updateStaff(id, input);
    refresh();
    return undefined;
  });
}
