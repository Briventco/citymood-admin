"use client";

import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, ImagePlus, Italic, Link2, List, Quote } from "lucide-react";
import { useId, useState } from "react";
import { mediaSrc } from "@/lib/admin/media-url";
import type { RichTextNode } from "@/lib/admin/types";
import { MediaPicker } from "../../../_components/MediaPicker";
import { button, inputClass } from "../../../_components/ui";

// Story body (ADMIN_SPEC §3, "Rich text"): Tiptap restricted to paragraphs, H2,
// bold, italic, links, blockquote, bullet list and inline images from the media
// library. The server re-checks the JSON and builds sanitized body_html.

const extensions = [
  StarterKit.configure({
    heading: { levels: [2] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    orderedList: false,
    horizontalRule: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
  }),
  Image.configure({ inline: false }),
  Placeholder.configure({ placeholder: "Keep writing…" }),
];

type Props = {
  value: RichTextNode;
  onChange: (doc: RichTextNode, words: number) => void;
  labelledBy: string;
  /** Mobile quick publish: no toolbar, plain-text look. */
  compact?: boolean;
};

export function RichTextEditor({ value, onChange, labelledBy, compact = false }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const linkId = useId();

  const editor = useEditor({
    extensions,
    content: value.content?.length ? value : undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        class: compact ? "cm-prose cm-prose-compact" : "cm-prose",
      },
    },
    onUpdate: ({ editor }) => {
      const words = editor.getText().split(/\s+/).filter(Boolean).length;
      onChange(editor.getJSON() as RichTextNode, words);
    },
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            link: e.isActive("link"),
            quote: e.isActive("blockquote"),
            list: e.isActive("bulletList"),
          }
        : null,
  });

  const tool = "inline-flex size-11 items-center justify-center text-cm-black hover:bg-cm-white aria-pressed:bg-cm-white aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-cm-black";

  function openLink() {
    setLinkUrl((editor?.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  }

  function applyLink(e: React.FormEvent) {
    e.preventDefault();
    const url = linkUrl.trim();
    const chain = editor?.chain().focus().extendMarkRange("link");
    if (!url) chain?.unsetLink().run();
    else chain?.setLink({ href: /^(https?:|mailto:|\/)/i.test(url) ? url : `https://${url}` }).run();
    setLinkOpen(false);
  }

  return (
    <div className="cm-editor">
      {!compact && (
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border border-b-0 border-cm-rule bg-cm-paper p-1">
          <button type="button" aria-label="Bold" aria-pressed={!!active?.bold} className={tool} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold aria-hidden="true" className="size-[18px]" strokeWidth={2.6} />
          </button>
          <button type="button" aria-label="Italic" aria-pressed={!!active?.italic} className={tool} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic aria-hidden="true" className="size-[18px]" />
          </button>
          <button type="button" aria-label="Subheading" aria-pressed={!!active?.h2} className={tool} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 aria-hidden="true" className="size-5" />
          </button>
          <button type="button" aria-label="Link" aria-pressed={!!active?.link} aria-expanded={linkOpen} aria-controls={linkId} className={tool} onClick={openLink}>
            <Link2 aria-hidden="true" className="size-[18px]" />
          </button>
          <button type="button" aria-label="Quote" aria-pressed={!!active?.quote} className={tool} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote aria-hidden="true" className="size-[18px]" />
          </button>
          <button type="button" aria-label="Bulleted list" aria-pressed={!!active?.list} className={tool} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List aria-hidden="true" className="size-[18px]" />
          </button>
          <button type="button" aria-label="Insert image" className={tool} onClick={() => setPickerOpen(true)}>
            <ImagePlus aria-hidden="true" className="size-[18px]" />
          </button>
        </div>
      )}
      {linkOpen && (
        <form id={linkId} onSubmit={applyLink} className="flex flex-wrap items-center gap-2 border border-b-0 border-cm-rule bg-cm-paper px-2 pb-2">
          <label htmlFor={`${linkId}-url`} className="sr-only">
            Link address
          </label>
          <input
            id={`${linkId}-url`}
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://"
            className={`${inputClass} flex-[1_1_220px]`}
          />
          <button type="submit" className={button.outline}>
            {linkUrl.trim() ? "Apply link" : "Remove link"}
          </button>
          <button type="button" className={button.destructive} onClick={() => setLinkOpen(false)}>
            Cancel
          </button>
        </form>
      )}
      <div
        className={compact ? "min-h-[220px] border border-cm-ad-border bg-cm-white px-3 py-2.5" : "border border-cm-rule bg-cm-white px-4 pt-5 pb-7 sm:px-6"}
        onClick={(e) => {
          if (e.target === e.currentTarget) editor?.commands.focus("end");
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <MediaPicker
        open={pickerOpen}
        title="Insert a photo in the story"
        onClose={() => setPickerOpen(false)}
        onPick={(m) => {
          setPickerOpen(false);
          editor?.chain().focus().setImage({ src: mediaSrc(m), alt: m.alt }).run();
        }}
      />
    </div>
  );
}
