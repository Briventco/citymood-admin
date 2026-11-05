"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { FieldError, Notice, button } from "../_components/ui";

// The link in the email signs the person in, by one of three routes depending on
// how Supabase issued it: tokens in the URL hash (invites), a ?code= (password
// reset), or a ?token_hash= (custom email templates).
async function sessionFromLink(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  const code = query.get("code");
  const token_hash = query.get("token_hash");

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) return false;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return false;
  } else if (token_hash) {
    const type = query.get("type") === "invite" ? "invite" : "recovery";
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return false;
  }
  window.history.replaceState(null, "", window.location.pathname);
  return !!(await supabase.auth.getSession()).data.session;
}

export function SetPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient({ detectSessionInUrl: false }), []);
  const [state, setState] = useState<"checking" | "ready" | "expired">("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    sessionFromLink(supabase).then((ok) => setState(ok ? "ready" : "expired"));
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters.");
    setPending(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      return setError("That password couldn’t be saved. Try a different one.");
    }
    router.replace("/articles");
    router.refresh();
  }

  if (state === "checking") return <p className="text-[17px] text-cm-ink">Checking your link…</p>;
  if (state === "expired") {
    return (
      <>
        <Notice tone="error">This link has expired or has already been used.</Notice>
        <Link href="/reset-password" className={`${button.secondary} mt-6`}>
          Send a new link
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="new-password" className="mb-1.5 block text-[15px] font-bold">
        New password
      </label>
      <input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? "password-error" : undefined}
        className="h-12 w-full border-2 border-cm-black px-3.5 text-[17px]"
      />
      {error && <FieldError id="password-error">{error}</FieldError>}
      <button type="submit" disabled={pending} className={`${button.primary} mt-5 h-[52px] w-full text-[17px]`}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
