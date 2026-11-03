import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/app/components/shell/Logo";
import { formatArticleDate } from "@/lib/format";
import { focalPosition, mediaSrc } from "@/lib/admin/media-url";
import { requireStaff } from "@/lib/admin/session";
import { STATUS_LABELS, effectiveStatus } from "@/lib/admin/status";
import { formatDayTime } from "@/lib/admin/time";

// Preview in the public style. The article page isn't designed yet (ADMIN_SPEC
// §8 A3), so this is a plain layout built from the tokens. It shows the last
// saved version, and body_html, which the server sanitized when it was saved.

export const metadata: Metadata = { title: "Preview" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo } = await requireStaff();
  const detail = await repo.getArticle(id);
  if (!detail) notFound();
  const { article: a, image, category, author, live } = detail;
  const status = effectiveStatus(a, new Date());

  return (
    <div className="min-h-screen bg-cm-white">
      <header className="cm-on-dark bg-cm-black text-cm-white">
        <div className="mx-auto flex max-w-cm items-center gap-4 px-(--cm-gutter)">
          <Logo height={64} eager className="h-16" />
          <p className="text-sm text-cm-meta-dark">Preview of the last saved version</p>
          {detail.can_edit && (
            <Link href={`/admin/articles/${a.id}`} className="ml-auto inline-flex min-h-11 items-center text-sm font-bold text-cm-white underline">
              Back to the editor
            </Link>
          )}
        </div>
      </header>
      <p className="bg-cm-lime px-(--cm-gutter) py-2 text-center text-sm font-bold text-cm-black">
        {live
          ? "This story is live on the site."
          : status === "scheduled" && a.publish_at
            ? `Scheduled: goes live ${formatDayTime(a.publish_at, new Date())}, Lagos time. Readers can’t see it yet.`
            : `${STATUS_LABELS[status]}: readers can’t see this story.`}
      </p>

      <main className="mx-auto max-w-[760px] px-(--cm-gutter) pt-8 pb-16">
        <article>
          {category && (
            <p className="mb-2 flex items-center gap-2 text-cm-kicker font-extrabold uppercase tracking-cm-caps">
              <span aria-hidden="true" className="size-3 bg-cm-lime outline outline-1 outline-cm-black" />
              {category.name}
            </p>
          )}
          <h1 className="font-serif text-cm-lead font-bold">{a.headline || "Untitled draft"}</h1>
          {a.standfirst && <p className="mt-3 text-cm-standfirst text-cm-ink">{a.standfirst}</p>}
          <p className="mt-4 border-t border-cm-rule pt-3 text-cm-metadata text-cm-meta">
            {author && <strong className="font-bold text-cm-black">{author.full_name}</strong>}
            {author && a.publish_at && " · "}
            {a.publish_at && formatArticleDate(a.publish_at)}
          </p>
          {image?.width && image.height && (
            <figure className="mt-6">
              <div className="relative aspect-[3/2] overflow-hidden lg:aspect-video">
                <Image
                  src={mediaSrc(image)}
                  alt={image.alt}
                  fill
                  priority
                  sizes="(min-width: 760px) 728px, 100vw"
                  className="object-cover"
                  style={{ objectPosition: focalPosition(image) }}
                />
              </div>
              {(image.caption || image.credit) && (
                <figcaption className="mt-2 text-[14px] text-cm-meta">
                  {image.caption} {image.credit && <span>{image.credit.startsWith("Photo") ? image.credit : `Photo: ${image.credit}`}</span>}
                </figcaption>
              )}
            </figure>
          )}
          <div className="cm-prose mt-8" dangerouslySetInnerHTML={{ __html: a.body_html }} />
        </article>
        <p className="mt-12 border-t border-cm-rule pt-3 text-[13px] text-cm-meta">
          The article page isn’t designed yet, so this preview uses a plain layout.
        </p>
      </main>
    </div>
  );
}
