"use client";

import { useEffect, useRef } from "react";
import { button } from "./ui";

// A modal confirmation for anything that deletes or takes work down. Uses the
// native <dialog>, so focus is trapped and Esc cancels.
type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, children, confirmLabel, pending, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(480px,calc(100vw-32px))] border-2 border-cm-black bg-cm-white p-6 text-cm-black backdrop:bg-cm-black/60"
    >
      <h2 id="confirm-title" className="font-serif text-2xl leading-tight font-semibold">
        {title}
      </h2>
      <div className="mt-2 text-[16px] text-cm-ink">{children}</div>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button type="button" onClick={onConfirm} disabled={pending} className={button.primary}>
          {pending ? "Working…" : confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className={button.secondary} autoFocus>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
