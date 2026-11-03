import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { demoMode, devStoreEnabled } from "@/lib/admin/backend";
import { getStaff } from "@/lib/admin/session";
import { AuthLayout } from "../_components/AuthLayout";
import { Notice } from "../_components/ui";
import { DemoSwitcher } from "./DemoSwitcher";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getStaff()) redirect("/admin/articles");
  const { next } = await searchParams;
  return (
    <AuthLayout>
      <h1 className="mb-1.5 font-serif text-[40px] leading-[1.05] font-semibold">Sign in</h1>
      <p className="mb-7 text-[17px] text-cm-ink">Use the email your editor invited.</p>
      {devStoreEnabled ? (
        <SignInForm next={next} />
      ) : (
        <Notice tone="error">
          The newsroom isn’t connected to its database yet, so sign-in is unavailable. (Production builds need the
          Supabase backend, or ADMIN_DEV_STORE=1 for a local demo.)
        </Notice>
      )}
      {demoMode && <DemoSwitcher />}
    </AuthLayout>
  );
}
