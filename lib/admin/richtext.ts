import type { RichTextNode } from "./types";

// Story body: Tiptap JSON in, sanitized HTML out (ADMIN_SPEC §3, "Rich text").
// The HTML is built from an allowlist rather than cleaned afterwards: only
// paragraphs, H2, bold, italic, links, blockquotes, bullet lists and inline
// images are emitted, every text and attribute value is escaped, and links and
// image sources must use a safe scheme. Anything else is dropped (its text kept).

const BLOCKS = new Set(["paragraph", "heading", "blockquote", "bulletList", "listItem", "image", "hardBreak", "text"]);
const MARKS = new Set(["bold", "italic", "link"]);
const MAX_DEPTH = 12;

export const emptyDoc = (): RichTextNode => ({ type: "doc", content: [] });

export function docFromParagraphs(text: string): RichTextNode {
  return {
    type: "doc",
    content: text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** http(s), mailto, or a same-site path. Never javascript:, data: or protocol-relative URLs. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const h = href.trim();
  if (/^(https?:|mailto:)/i.test(h)) return h;
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  return null;
}

/** Inline images come from the media library: local uploads, seed files, or https storage. */
export function safeImageSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const s = src.trim();
  if (/^\/(uploads|seed)\/[\w\-./]+$/.test(s) && !s.includes("..")) return s;
  if (/^https:\/\//i.test(s)) return s;
  return null;
}

/** Keeps only the node types, marks and attributes the editor allows. Use on any body from the client. */
export function normalizeDoc(input: unknown): RichTextNode {
  const clean = (node: unknown, depth: number): RichTextNode | null => {
    if (!node || typeof node !== "object" || depth > MAX_DEPTH) return null;
    const n = node as Record<string, unknown>;
    if (typeof n.type !== "string") return null;
    if (n.type === "text") {
      if (typeof n.text !== "string" || n.text === "") return null;
      const marks = Array.isArray(n.marks)
        ? n.marks
            .filter(
              (m: unknown): m is { type: string; attrs?: Record<string, unknown> } =>
                !!m && typeof m === "object" && MARKS.has(String((m as { type?: unknown }).type)),
            )
            .map((m) => (m.type === "link" ? { type: "link", attrs: { href: safeHref(m.attrs?.href) } } : { type: m.type }))
            .filter((m) => m.type !== "link" || m.attrs?.href)
        : [];
      return marks.length ? { type: "text", text: n.text, marks } : { type: "text", text: n.text };
    }
    const children = Array.isArray(n.content)
      ? n.content.map((c) => clean(c, depth + 1)).filter((c): c is RichTextNode => c !== null)
      : [];
    if (n.type === "image") {
      const attrs = (n.attrs ?? {}) as Record<string, unknown>;
      const src = safeImageSrc(attrs.src);
      return src ? { type: "image", attrs: { src, alt: typeof attrs.alt === "string" ? attrs.alt : "" } } : null;
    }
    if (n.type === "heading") return { type: "heading", attrs: { level: 2 }, content: children };
    if (n.type === "doc" || BLOCKS.has(n.type)) return { type: n.type, content: children };
    // Unknown block (e.g. pasted from elsewhere): keep its text as a paragraph.
    const text = children.filter((c) => c.type === "text");
    return text.length ? { type: "paragraph", content: text } : null;
  };
  const doc = clean(input, 0);
  return doc && doc.type === "doc" ? doc : emptyDoc();
}

function renderText(node: RichTextNode): string {
  let html = escapeHtml(node.text ?? "");
  const marks = node.marks ?? [];
  if (marks.some((m) => m.type === "italic")) html = `<em>${html}</em>`;
  if (marks.some((m) => m.type === "bold")) html = `<strong>${html}</strong>`;
  const link = marks.find((m) => m.type === "link");
  const href = link ? safeHref(link.attrs?.href) : null;
  if (href) html = `<a href="${escapeHtml(href)}" rel="noopener">${html}</a>`;
  return html;
}

function renderNode(node: RichTextNode): string {
  const inner = () => (node.content ?? []).map(renderNode).join("");
  switch (node.type) {
    case "doc":
      return inner();
    case "text":
      return renderText(node);
    case "paragraph": {
      const body = inner();
      return body.trim() ? `<p>${body}</p>` : "";
    }
    case "heading":
      return `<h2>${inner()}</h2>`;
    case "blockquote":
      return `<blockquote>${inner()}</blockquote>`;
    case "bulletList":
      return `<ul>${inner()}</ul>`;
    case "listItem":
      return `<li>${inner()}</li>`;
    case "hardBreak":
      return "<br>";
    case "image": {
      const src = safeImageSrc(node.attrs?.src);
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">` : "";
    }
    default:
      return inner();
  }
}

/** Sanitized HTML for articles.body_html. */
export function renderBodyHtml(doc: unknown): string {
  return renderNode(normalizeDoc(doc));
}

/** Plain text, paragraphs separated by blank lines. */
export function plainText(doc: RichTextNode | null | undefined): string {
  if (!doc) return "";
  const blocks: string[] = [];
  const walk = (n: RichTextNode, out: string[]) => {
    if (n.type === "text") out.push(n.text ?? "");
    else if (n.type === "hardBreak") out.push(" ");
    else (n.content ?? []).forEach((c) => walk(c, out));
  };
  const visit = (n: RichTextNode) => {
    if (["paragraph", "heading", "listItem"].includes(n.type)) {
      const out: string[] = [];
      walk(n, out);
      const text = out.join("").trim();
      if (text) blocks.push(text);
    } else (n.content ?? []).forEach(visit);
  };
  visit(doc);
  return blocks.join("\n\n");
}

export function wordCount(doc: RichTextNode | null | undefined): number {
  return plainText(doc).split(/\s+/).filter(Boolean).length;
}
