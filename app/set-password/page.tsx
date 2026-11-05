import type { Metadata } from "next";
import { AuthLayout } from "../_components/AuthLayout";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "Set your password" };

// Where invite and reset emails land.
export default function SetPasswordPage() {
  return (
    <AuthLayout>
      <h1 className="mb-1.5 font-serif text-[40px] leading-[1.05] font-semibold">Set your password</h1>
      <p className="mb-7 text-[17px] text-cm-ink">Choose a password of at least 8 characters.</p>
      <SetPasswordForm />
    </AuthLayout>
  );
}
