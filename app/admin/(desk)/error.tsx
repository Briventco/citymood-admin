"use client";

import Link from "next/link";
import { useEffect } from "react";
import { button } from "../_components/ui";

// Error: a plain sentence with a retry. Never a raw error code.
export default function DeskError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:pt-7">
      <div className="max-w-[560px] border border-cm-rule bg-cm-white px-6 py-8">
        <h1 className="font-serif text-[30px] leading-tight font-semibold">This page didn’t load</h1>
        <p className="mt-2 text-[17px] text-cm-ink">
          Something went wrong on our side. Your saved work is safe. Try again, and if it keeps happening, tell an
          admin.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button type="button" onClick={() => retry()} className={button.primary}>
            Try again
          </button>
          <Link href="/admin/articles" className={button.secondary}>
            Back to articles
          </Link>
        </div>
      </div>
    </div>
  );
}
