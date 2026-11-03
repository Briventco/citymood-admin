"use client";

import { useState, useTransition } from "react";
import type { SiteSettings } from "@/lib/admin/types";
import { Notice, Panel, button, inputClass, labelClass, textareaClass } from "../../_components/ui";
import { saveSettings } from "./actions";

type Values = Omit<SiteSettings, "id">;

const CONTACT: { key: keyof Values; label: string; type?: string; hint?: string }[] = [
  { key: "newsroom_address", label: "Newsroom address" },
  { key: "newsroom_phone", label: "Newsroom phone", type: "tel" },
  { key: "newsroom_email", label: "Newsroom email", type: "email" },
  { key: "corrections_email", label: "Corrections email", type: "email", hint: "Shown beside “Corrections” in the footer." },
];

const SOCIAL: { key: keyof Values; label: string }[] = [
  { key: "facebook_url", label: "Facebook page" },
  { key: "instagram_url", label: "Instagram" },
  { key: "tiktok_url", label: "TikTok" },
];

export function SettingsForm({ initial }: { initial: Values }) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const field = (key: keyof Values, label: string, type = "text", hint?: string) => (
    <div key={key}>
      <label htmlFor={key} className={labelClass}>
        {label}
      </label>
      {key === "newsroom_address" ? (
        <textarea id={key} rows={2} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className={textareaClass} />
      ) : (
        <input
          id={key}
          type={type}
          value={values[key]}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          aria-describedby={hint ? `${key}-hint` : undefined}
          className={inputClass}
        />
      )}
      {hint && (
        <p id={`${key}-hint`} className="mt-1 text-[13px] text-cm-meta">
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <form
      noValidate
      className="flex max-w-[720px] flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await saveSettings(values);
          setMessage(result.ok ? { tone: "success", text: "Saved. The site footer shows the new details now." } : { tone: "error", text: result.error });
        });
      }}
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Panel id="contact-h" title="Contact details">
        <div className="flex flex-col gap-3.5">{CONTACT.map((f) => field(f.key, f.label, f.type, f.hint))}</div>
      </Panel>
      <Panel id="social-h" title="Social links" note="Full addresses starting with https://. Leave one empty to hide it.">
        <div className="flex flex-col gap-3.5">{SOCIAL.map((f) => field(f.key, f.label, "url"))}</div>
      </Panel>
      <div>
        <button type="submit" disabled={pending} className={button.primary}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
