import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/session";
import { PageHeader, inputClass, pageClass, button } from "../../_components/ui";
import { MediaLibrary } from "./MediaLibrary";

export const metadata: Metadata = { title: "Media library" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { repo, can } = await requireStaff();
  const { q = "" } = await searchParams;
  const items = await repo.listMedia(q);

  return (
    <div className={pageClass}>
      <PageHeader
        title="Media library"
        note={can.editor ? "Every uploaded photo. Click one to edit its details." : "Every uploaded photo. You can edit the ones you uploaded."}
      />
      <form role="search" action="/admin/media" className="mb-5 flex flex-wrap gap-2.5">
        <label htmlFor="media-q" className="sr-only">
          Search photos
        </label>
        <input id="media-q" name="q" type="search" defaultValue={q} placeholder="Search alt text, captions or credits" className={`${inputClass} flex-[1_1_260px]`} />
        <button type="submit" className={button.secondary}>
          Search
        </button>
      </form>
      <MediaLibrary key={q} items={items} search={q} canDelete={can.editor} />
    </div>
  );
}
