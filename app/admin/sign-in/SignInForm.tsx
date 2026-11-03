"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../auth-actions";
import { Notice, button } from "../_components/ui";

const input = "h-12 w-full border-2 border-cm-black px-3.5 text-[17px]";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const invalid = !!state?.error;

  return (
    <form action={action} noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && (
        <div className="mb-5">
          <Notice tone="error" id="sign-in-error">
            {state.error}
          </Notice>
        </div>
      )}
      <label htmlFor="email" className="mb-1.5 block text-[15px] font-bold">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        defaultValue={state?.email}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "sign-in-error" : undefined}
        className={`${input} mb-[18px]`}
      />
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor="password" className="text-[15px] font-bold">
          Password
        </label>
        <Link href="/admin/reset-password" className="text-[15px] font-bold underline">
          Forgot password?
        </Link>
      </div>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "sign-in-error" : undefined}
        className={`${input} mb-3.5`}
      />
      <label className="mb-3.5 flex min-h-11 items-center gap-2.5 text-[15px]">
        <input type="checkbox" name="keep" className="size-[18px] accent-cm-black" />
        Keep me signed in on this device
      </label>
      <button type="submit" disabled={pending} className={`${button.primary} h-[52px] w-full text-[17px]`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-[18px] text-sm text-cm-meta">After 5 wrong attempts, sign-in pauses for 15 minutes.</p>
    </form>
  );
}
