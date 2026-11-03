import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/session";
import { PageHeader, PermissionDenied, pageClass } from "../../_components/ui";
import { CategoriesPanel, TagsPanel } from "./TaxonomyControls";

export const metadata: Metadata = { title: "Categories and tags" };

export default async function TaxonomyPage() {
  const { repo, can } = await requireStaff();
  if (!can.editor) {
    return (
      <div className={pageClass}>
        <PermissionDenied need="Editors tidy tags and admins manage categories." />
      </div>
    );
  }
  const [categories, tags] = await Promise.all([repo.listCategories(), repo.listTags()]);
  return (
    <div className={pageClass}>
      <PageHeader title="Categories and tags" note={can.admin ? "Categories are the site’s sections. Tags group stories." : "Admins manage categories. Editors tidy tags."} />
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[1_1_420px]">
          <CategoriesPanel categories={categories} canEdit={can.admin} />
        </div>
        <div className="min-w-0 flex-[1_1_420px]">
          <TagsPanel tags={tags} />
        </div>
      </div>
    </div>
  );
}
