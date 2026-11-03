import { AlertTriangle, Check } from "lucide-react";
import Link from "next/link";
import type { ArticleStatus } from "@/lib/admin/types";
import { STATUS_LABELS } from "@/lib/admin/status";

// Shared newsroom components (ADMIN_SPEC.md §4, "Shared admin components").
// Square corners, no shadows; structure from 1px rules and white panels on paper.

// ───────────── Buttons ─────────────
// Every button is at least 44px tall. Primary: lime with a 2px black border.
// Secondary: white with a 2px black border. Destructive: underlined text.

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 text-[15px] leading-tight disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

export const button = {
  primary: `${base} border-2 border-cm-black bg-cm-lime px-[18px] font-extrabold text-cm-black hover:bg-cm-black hover:text-cm-lime`,
  secondary: `${base} border-2 border-cm-black bg-cm-white px-[18px] font-bold text-cm-black hover:bg-cm-paper`,
  /** Black fill, for the strongest action inside a light area ("Take photo"). */
  dark: `${base} border-2 border-cm-black bg-cm-black px-4 font-bold text-cm-white hover:underline`,
  /** One-pixel border, for compact rows (pins, creatives). */
  outline: `${base} border border-cm-black bg-cm-white px-3 text-sm font-bold text-cm-black hover:bg-cm-paper`,
  destructive: `${base} px-1 font-bold text-cm-black underline decoration-1 underline-offset-2 hover:decoration-2`,
  /** On black panels. */
  onDarkOutline: `${base} border border-cm-white px-3.5 text-sm font-bold text-cm-white hover:bg-cm-white hover:text-cm-black`,
  onDarkSolid: `${base} border border-cm-white bg-cm-white px-3.5 text-sm font-bold text-cm-black hover:bg-cm-lime hover:border-cm-lime`,
  /** Square icon button (44×44). Always give it an aria-label. */
  icon: "inline-flex size-11 shrink-0 items-center justify-center border border-cm-rule bg-cm-white text-cm-black hover:border-cm-black disabled:opacity-40",
};

// ───────────── Page structure ─────────────

/** Padding for a screen inside the work area. */
export const pageClass = "px-4 py-6 sm:px-6 lg:px-8 lg:pt-7 lg:pb-12";

export function PageHeader({
  title,
  note,
  actions,
  className = "mb-6",
}: {
  title: string;
  /** Small line above the title, e.g. "Only Admins can see this page". */
  note?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-3 border-b-[6px] border-cm-black pb-3.5 ${className}`}>
      <div className="min-w-0">
        {note && <p className="mb-1 text-[13px] text-cm-meta">{note}</p>}
        <h1 className="font-serif text-[34px] leading-none font-semibold sm:text-[40px]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  );
}

export const panelClass = "border border-cm-rule bg-cm-white px-[18px] py-[18px] sm:px-[22px] sm:py-5";
export const panelTitleClass = "text-sm font-extrabold uppercase tracking-[0.1em]";

export function Panel({
  id,
  title,
  note,
  aside,
  children,
  className = "",
}: {
  id: string;
  title: React.ReactNode;
  note?: React.ReactNode;
  /** Right-aligned text beside the title. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`${panelClass} ${className}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id} className={panelTitleClass}>
          {title}
        </h2>
        {aside && <span className="text-[13px] text-cm-meta">{aside}</span>}
      </div>
      {note && <p className="-mt-2 mb-2 text-[13px] text-cm-meta">{note}</p>}
      {children}
    </section>
  );
}

// ───────────── Fields ─────────────
// A visible label above the input and a 1px #8A8A84 border. Invalid fields get a
// 2px black border plus an icon and a text message (no red: it isn't in the palette).

export const labelClass = "mb-1 block text-sm font-bold";
export const sectionLabelClass = "text-[13px] font-extrabold uppercase tracking-[0.1em]";
const fieldBase = "w-full min-w-0 bg-cm-white px-3 text-base text-cm-black placeholder:text-cm-meta";
export const inputClass = `${fieldBase} h-11 border border-cm-ad-border aria-invalid:border-2 aria-invalid:border-cm-black`;
export const selectClass = `${fieldBase} h-11 border border-cm-ad-border pr-8`;
export const textareaClass = `${fieldBase} border border-cm-ad-border py-2 leading-snug aria-invalid:border-2 aria-invalid:border-cm-black`;

export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1 flex items-center gap-1.5 text-[13px] font-bold">
      <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.2} />
      {children}
    </p>
  );
}

/** "58 / 60": warns past the limit, never blocks. */
export function CharCount({ value, limit, id }: { value: string; limit: number; id?: string }) {
  const over = value.length > limit;
  return (
    <span id={id} className={`text-[13px] ${over ? "font-extrabold text-cm-black" : "font-semibold text-cm-meta"}`}>
      {value.length} / {limit}
      {over && <span className="sr-only"> characters, over the limit</span>}
    </span>
  );
}

// ───────────── Markers ─────────────
// The shape carries the meaning, not colour alone.

const MARKERS: Record<ArticleStatus, string> = {
  published: "bg-cm-lime outline outline-1 outline-cm-black",
  draft: "border-[1.5px] border-cm-black",
  scheduled: "border-[1.5px] border-cm-black",
  unpublished: "border-[1.5px] border-dashed border-cm-meta",
};

export function StatusMarker({ status, size = "size-[11px]" }: { status: ArticleStatus; size?: string }) {
  // rounded-full is the one exception to square corners: Scheduled is a circle by spec.
  return <span aria-hidden="true" className={`inline-block shrink-0 ${size} ${MARKERS[status]}`} style={status === "scheduled" ? { borderRadius: "50%" } : undefined} />;
}

export function StatusLabel({ status }: { status: ArticleStatus }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold whitespace-nowrap">
      <StatusMarker status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** "BREAKING", "FEATURED": black text on a lime fill with a 1px outline. */
export function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-cm-lime px-1.5 py-px text-[11px] font-extrabold uppercase tracking-[0.08em] text-cm-black outline outline-1 outline-cm-black">
      {children}
    </span>
  );
}

/** Ready-to-publish checklist box: ticked (lime) or needs attention (!). */
export function CheckBox({ done, required = true }: { done: boolean; required?: boolean }) {
  if (done) {
    return (
      <span aria-hidden="true" className="flex size-[18px] shrink-0 items-center justify-center bg-cm-lime outline outline-1 outline-cm-black">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex size-[18px] shrink-0 items-center justify-center border-2 text-xs font-extrabold ${required ? "border-cm-black" : "border-cm-ad-border text-cm-meta"}`}
    >
      {required ? "!" : ""}
    </span>
  );
}

export function Avatar({ initials, tone = "black" }: { initials: string; tone?: "black" | "lime" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-9 shrink-0 items-center justify-center text-[13px] font-extrabold ${
        tone === "lime" ? "bg-cm-lime text-cm-black" : "bg-cm-black text-cm-white"
      }`}
    >
      {initials}
    </span>
  );
}

// ───────────── States every screen needs ─────────────

/** Loading: skeleton rows in --cm-paper. */
export function SkeletonRows({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`border border-cm-rule bg-cm-white ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 border-b border-cm-rule px-4 py-3 last:border-b-0">
          <div className="h-[43px] w-16 shrink-0 bg-cm-paper" />
          <div className="h-4 flex-1 bg-cm-paper" style={{ maxWidth: `${70 - (i % 3) * 12}%` }} />
          <div className="hidden h-4 w-24 bg-cm-paper md:block" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border border-cm-rule bg-cm-white px-6 py-10 text-center">
      <p className="text-[17px]">{children}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** An inline message after an action. Errors are plain sentences, never codes. */
export function Notice({ tone, children, id }: { tone: "error" | "success"; children: React.ReactNode; id?: string }) {
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 border-l-4 px-3 py-2 text-[15px] ${
        tone === "error" ? "border-cm-black bg-cm-white font-bold" : "border-cm-lime bg-cm-white"
      }`}
    >
      {tone === "error" && <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />}
      <span>{children}</span>
    </p>
  );
}

export function PermissionDenied({ need }: { need?: string }) {
  return (
    <div className="max-w-[560px] border border-cm-rule bg-cm-white px-6 py-8">
      <h1 className="font-serif text-[30px] leading-tight font-semibold">You don’t have access to this page</h1>
      <p className="mt-2 text-[17px] text-cm-ink">
        {need ?? "Your role doesn’t include this part of the newsroom."} If you think you should have access, ask
        an admin.
      </p>
      <Link href="/admin/articles" className={`${button.secondary} mt-5`}>
        Back to articles
      </Link>
    </div>
  );
}
