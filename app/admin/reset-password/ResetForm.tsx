"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "../auth-actions";
import { FieldError, Notice, button } from "../_components/ui";

export function ResetForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  if (state?.sent) {
    return (
      <>
        <Notice tone="success">
          If that email belongs to a CityMood staff account, we’ve sent a reset link. It expires after one hour.
        </Notice>
        <Link href="/admin/sign-in" className={`${button.secondary} mt-6`}>
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <form action={action} noValidate>
      <label htmlFor="reset-email" className="mb-1.5 block text-[15px] font-bold">
        Email
      </label>
      <input
        id="reset-email"
        name="email"
        type="email"
        autoComplete="username"
        required
        aria-invalid={!!state?.error || undefined}
        aria-describedby={state?.error ? "reset-error" : undefined}
        className="h-12 w-full border-2 border-cm-black px-3.5 text-[17px]"
      />
      {state?.error && <FieldError id="reset-error">{state.error}</FieldError>}
      <button type="submit" disabled={pending} className={`${button.primary} mt-5 h-[52px] w-full text-[17px]`}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="mt-[18px] text-[15px]">
        <Link href="/admin/sign-in" className="font-bold underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
