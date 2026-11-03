import type { Metadata } from "next";
import { AuthLayout } from "../_components/AuthLayout";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <h1 className="mb-1.5 font-serif text-[40px] leading-[1.05] font-semibold">Reset password</h1>
      <p className="mb-7 text-[17px] text-cm-ink">We’ll email you a link to choose a new password.</p>
      <ResetForm />
    </AuthLayout>
  );
}
