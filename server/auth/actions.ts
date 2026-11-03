"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/server/supabase/server";

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function signIn(formData: FormData): Promise<void> {
  const email = formString(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!email || typeof password !== "string" || password.length < 1) {
    redirect("/login?error=invalid_input");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid_credentials");
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
