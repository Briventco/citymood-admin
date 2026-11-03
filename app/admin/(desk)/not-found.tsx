import Link from "next/link";
import { button } from "../_components/ui";

export default function DeskNotFound() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:pt-7">
      <div className="max-w-[560px] border border-cm-rule bg-cm-white px-6 py-8">
        <h1 className="font-serif text-[30px] leading-tight font-semibold">We couldn’t find that</h1>
        <p className="mt-2 text-[17px] text-cm-ink">It may have been deleted, or the link is wrong.</p>
        <Link href="/admin/articles" className={`${button.secondary} mt-5`}>
          Back to articles
        </Link>
      </div>
    </div>
  );
}
