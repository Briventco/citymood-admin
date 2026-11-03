import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { requireStaff } from "@/lib/admin/session";
import { PermissionDenied, pageClass } from "../../../_components/ui";
import { ArticleEditor } from "../_editor/ArticleEditor";
import type { EditorData } from "../_editor/useArticleDraft";

// /admin/articles/new and /admin/articles/[id] share this page, so the editor
// keeps its state when a new draft gets its id on first save.

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: (await params).id === "new" ? "New article" : "Edit article" };
}

/** Server-side guess at the layout, so phones get quick publish on first paint. */
async function looksMobile(): Promise<boolean> {
  const h = await headers();
  if (h.get("sec-ch-ua-mobile") === "?1") return true;
  return /Mobi|Android|iPhone/i.test(h.get("user-agent") ?? "");
}

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo, me, can } = await requireStaff();
  const detail = id === "new" ? null : await repo.getArticle(id);
  if (id !== "new" && !detail) notFound();
  if (detail && !detail.can_edit) {
    return (
      <div className={pageClass}>
        <PermissionDenied need="Reporters can edit only their own stories. An editor can make changes to this one." />
      </div>
    );
  }

  const [categories, authors, tags] = await Promise.all([repo.listCategories(), repo.authors(), repo.listTags()]);
  const data: EditorData = {
    detail,
    categories: categories.map(({ id, name, slug, is_active }) => ({ id, name, slug, is_active })),
    authors: authors.filter((a) => a.full_name).map(({ id, full_name }) => ({ id, full_name })),
    tagSuggestions: tags.map((t) => t.name),
    me: { id: me.id, full_name: me.full_name },
    can,
    siteHost: new URL(site.url).host,
    initialMobile: await looksMobile(),
  };
  return <ArticleEditor data={data} />;
}
