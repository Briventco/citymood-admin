import { describe, expect, it } from "vitest";
import { normalizeDoc, plainText, renderBodyHtml, safeHref } from "./richtext";
import { slugify } from "./text";
import { formatListTime, isoToLagos, lagosToIso } from "./time";

describe("slugify", () => {
  it("folds Yoruba diacritics instead of dropping letters", () => {
    expect(slugify("Àgbádárìgì night: Ọjà and Ẹ̀kọ́")).toBe("agbadarigi-night-oja-and-eko");
  });

  it("cuts long headlines at a word boundary", () => {
    const slug = slugify("word ".repeat(40), 30);
    expect(slug.length).toBeLessThanOrEqual(30);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("Lagos time", () => {
  it("reads date and time inputs as WAT (UTC+1)", () => {
    expect(lagosToIso("2026-10-14", "07:00")).toBe("2026-10-14T06:00:00.000Z");
    expect(isoToLagos("2026-10-14T06:00:00.000Z")).toEqual({ date: "2026-10-14", time: "07:00" });
  });

  it("rejects malformed input", () => {
    expect(lagosToIso("14/10/2026", "07:00")).toBeNull();
    expect(lagosToIso("2026-02-30", "07:00")).toBeNull();
  });

  it("formats list times like the reference", () => {
    const now = new Date("2026-10-23T12:00:00.000Z");
    expect(formatListTime("2026-10-23T09:42:00.000Z", now)).toBe("10:42 today");
    expect(formatListTime("2026-10-22T09:42:00.000Z", now)).toBe("Yesterday");
    expect(formatListTime("2026-10-25T06:00:00.000Z", now)).toBe("25 Oct, 07:00");
    expect(formatListTime("2026-10-11T09:00:00.000Z", now)).toBe("11 Oct");
  });
});

describe("story body HTML", () => {
  it("renders the allowed elements", () => {
    const html = renderBodyHtml({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Sub" }] },
        { type: "paragraph", content: [
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "text", text: " link", marks: [{ type: "link", attrs: { href: "https://example.com/?a=1&b=2" } }] },
        ] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "q" }] }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "i" }] }] }] },
        { type: "image", attrs: { src: "/uploads/2026/10/a.webp", alt: "A \"boat\"" } },
      ],
    });
    expect(html).toBe(
      '<h2>Sub</h2><p><strong>bold</strong><a href="https://example.com/?a=1&amp;b=2" rel="noopener"> link</a></p>' +
        "<blockquote><p>q</p></blockquote><ul><li><p>i</p></li></ul>" +
        '<img src="/uploads/2026/10/a.webp" alt="A &quot;boat&quot;" loading="lazy">',
    );
  });

  it("drops unsafe links, image sources and attributes", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref(" /local-news/story ")).toBe("/local-news/story");
    const doc = normalizeDoc({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "data:image/png;base64,xx", alt: "x" } },
        { type: "image", attrs: { src: "/uploads/../../etc/passwd" } },
        { type: "paragraph", attrs: { onclick: "x" }, content: [{ type: "text", text: "ok" }] },
      ],
    });
    expect(renderBodyHtml(doc)).toBe("<p>ok</p>");
  });

  it("extracts plain text for reading time", () => {
    const doc = normalizeDoc({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "One two" }] },
        { type: "heading", content: [{ type: "text", text: "Three" }] },
      ],
    });
    expect(plainText(doc)).toBe("One two\n\nThree");
  });
});

describe("imageInfo", () => {
  it("reads PNG and JPEG sizes and rejects other files", async () => {
    const { imageInfo } = await import("./image-size");
    const fs = await import("node:fs");
    const jpeg = new Uint8Array(fs.readFileSync("public/seed/landscape-1.jpg"));
    expect(imageInfo(jpeg)).toMatchObject({ type: "image/jpeg", width: 1800, height: 1200 });
    const png = new Uint8Array(fs.readFileSync("public/citymood-logo.png"));
    expect(imageInfo(png)).toMatchObject({ type: "image/png", width: 1280, height: 1259 });
    expect(imageInfo(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});
