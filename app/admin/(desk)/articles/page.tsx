import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ArticleListQuery, ArticleSummary } from "@/lib/admin/repo";
import { requireStaff } from "@/lib/admin/session";
import { effectiveStatus, isBreakingNow } from "@/lib/admin/status";
import { formatListTime } from "@/lib/admin/time";
import { ARTICLE_STATUSES, type ArticleStatus } from "@/lib/admin/types";
import { AutoSubmitSelect } from "../../_components/AutoSubmitSelect";
import { Thumb } from "../../_components/Thumb";
import { EmptyState, Flag, PageHeader, StatusLabel, button, inputClass, pageClass, selectClass } from "../../_components/ui";

export const metadata: Metadata = { title: "Articles" };

const TABS: { status: ArticleStatus | "all"; label: string }[] = [
  { status: "all", label: "All" },
  { status: "draft", label: "Drafts" },
  { status: "scheduled", label: "Scheduled" },
  { status: "published", label: "Published" },
  { status: "unpublished", label: "Unpublished" },
];

const EMPTY: Record<ArticleStatus | "all", string> = {
  all: "No stories yet. Start a new article.",
  draft: "No drafts yet. Start a new article.",
  scheduled: "Nothing is scheduled. Pick “Schedule” in the editor to publish later.",
  published: "Nothing is published yet.",
  unpublished: "No unpublished stories.",
};

type Search = { status?: string; q?: string; category?: string; author?: string; page?: string };

const one = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

function href(params: Search, change: Partial<Search>) {
  const next = { ...params, ...change };
  const qs = new URLSearchParams(
    Object.entries(next).filter((e): e is [string, string] => !!e[1] && !(e[0] === "status" && e[1] === "all")),
  );
  return `/admin/articles${qs.size ? `?${qs}` : ""}`;
}

function Flags({ a, now }: { a: ArticleSummary; now: Date }) {
  const breaking = a.breaking && (!a.live || isBreakingNow(a, now));
  if (!breaking && !a.featured) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {breaking && <Flag>Breaking</Flag>}
      {a.featured && <Flag>Featured</Flag>}
    </span>
  );
}

function Headline({ a }: { a: ArticleSummary }) {
  const text = a.headline || "Untitled draft";
  const cls = "font-serif text-[17px] leading-tight font-semibold";
  return a.can_edit ? (
    <Link href={`/admin/articles/${a.id}`} className={`${cls} hover:underline`}>
      {text}
    </Link>
  ) : (
    <span className={cls}>
      {text}
      <span className="sr-only"> (you can’t edit this story)</span>
    </span>
  );
}

const when = (a: ArticleSummary, now: Date) =>
  formatListTime(a.status === "scheduled" && a.publish_at ? a.publish_at : a.updated_at, now);

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { repo, can } = await requireStaff();
  const params = await searchParams;
  const status = (ARTICLE_STATUSES as string[]).includes(params.status ?? "") ? (params.status as ArticleStatus) : "all";
  const query: ArticleListQuery = {
    status,
    search: one(params.q),
    categoryId: one(params.category),
    authorId: one(params.author),
    page: Number(params.page) || 1,
    pageSize: 20,
  };
  const [list, categories, authors] = await Promise.all([repo.listArticles(query), repo.listCategories(), repo.authors()]);
  const now = new Date();
  const filtered = !!(query.search || query.categoryId || query.authorId);
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.page * list.pageSize, list.total);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className={pageClass}>
      <PageHeader
        title="Articles"
        className="mb-0"
        note={can.editor ? "Every story in the newsroom, most recently changed first" : "You can open and edit your own stories"}
        actions={
          <Link href="/admin/articles/new" className={button.primary}>
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
            New article
          </Link>
        }
      />

      <nav aria-label="Filter by status" className="mt-2 flex flex-wrap gap-x-1 border-b border-cm-rule text-[15px] font-bold">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={href(params, { status: t.status, page: undefined })}
            aria-current={status === t.status ? "true" : undefined}
            className={`block border-b-4 px-3 pt-3 pb-[9px] ${status === t.status ? "border-cm-black" : "border-transparent hover:border-cm-rule"}`}
          >
            {t.label} <span className="font-semibold text-cm-meta">{list.counts[t.status]}</span>
          </Link>
        ))}
      </nav>

      <form role="search" action="/admin/articles" className="mt-[18px] mb-4 flex flex-wrap gap-2.5">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <label htmlFor="q" className="sr-only">
          Search articles
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={params.q}
          placeholder="Search headlines, tags or authors"
          className={`${inputClass} flex-[3_1_260px]`}
        />
        <label htmlFor="category" className="sr-only">
          Category
        </label>
        <AutoSubmitSelect id="category" name="category" defaultValue={params.category ?? ""} className={`${selectClass} flex-[1_1_180px] text-[15px]`}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? "" : " (hidden)"}
            </option>
          ))}
        </AutoSubmitSelect>
        <label htmlFor="author" className="sr-only">
          Author
        </label>
        <AutoSubmitSelect id="author" name="author" defaultValue={params.author ?? ""} className={`${selectClass} flex-[1_1_160px] text-[15px]`}>
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </AutoSubmitSelect>
        <button type="submit" className={`${button.secondary} sr-only focus:not-sr-only`}>
          Search
        </button>
      </form>

      {list.items.length === 0 ? (
        <EmptyState
          action={
            filtered ? (
              <Link href={href({}, { status })} className={button.secondary}>
                Clear search and filters
              </Link>
            ) : status === "all" || status === "draft" ? (
              <Link href="/admin/articles/new" className={button.primary}>
                New article
              </Link>
            ) : undefined
          }
        >
          {filtered ? "No stories match your search and filters." : EMPTY[status]}
        </EmptyState>
      ) : (
        <>
          {/* From 768px: the table in the reference. */}
          <div className="hidden relative overflow-x-auto border border-cm-rule bg-cm-white md:block">
            <table className="w-full min-w-[760px] border-collapse text-[15px]">
              <caption className="sr-only">Stories, most recently changed first</caption>
              <thead>
                <tr className="border-b-2 border-cm-black text-left text-xs font-extrabold uppercase tracking-[0.1em]">
                  <th scope="col" className="px-4 py-3">Story</th>
                  <th scope="col" className="px-3 py-3">Category</th>
                  <th scope="col" className="px-3 py-3">Author</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((a) => (
                  <tr key={a.id} className="border-b border-cm-rule last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3.5">
                        <Thumb media={a.image} />
                        <div className="min-w-0">
                          <Headline a={a} />
                          <Flags a={a} now={now} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{a.category_name ?? <span className="text-cm-meta">None</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{a.author_name ?? "—"}</td>
                    <td className="px-3 py-3"><StatusLabel status={effectiveStatus(a, now)} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-cm-meta">{when(a, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Below 768px: one story per row, no sideways scrolling. */}
          <ul className="border border-cm-rule bg-cm-white md:hidden">
            {list.items.map((a) => (
              <li key={a.id} className="flex gap-3 border-b border-cm-rule p-3 last:border-b-0">
                <Thumb media={a.image} />
                <div className="min-w-0 flex-1">
                  <Headline a={a} />
                  <Flags a={a} now={now} />
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <StatusLabel status={effectiveStatus(a, now)} />
                    <span className="text-cm-meta">
                      {[a.category_name, a.author_name, when(a, now)].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {list.total > 0 && (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[15px]">
          <span className="text-cm-meta">
            Showing {first} to {last} of {list.total}
          </span>
          <div className="flex gap-2">
            {list.page > 1 ? (
              <Link href={href(params, { page: String(list.page - 1) })} className={button.secondary}>
                Previous
              </Link>
            ) : (
              <span aria-disabled="true" className={button.secondary}>Previous</span>
            )}
            {list.page < pages ? (
              <Link href={href(params, { page: String(list.page + 1) })} className={button.secondary}>
                Next
              </Link>
            ) : (
              <span aria-disabled="true" className={button.secondary}>Next</span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
