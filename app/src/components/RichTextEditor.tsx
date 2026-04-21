import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Bold, Heading1, Heading2, Italic, List } from "lucide-react";
import { useT } from "@/i18n/useT";

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  /** Fires when the editor DOM gains focus. Useful for cancelling a
   *  blur-scheduled autosave if the user jumps back in to keep typing. */
  onFocus?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

/**
 * Tiptap-backed rich text editor for TaskDetail body.
 * - Serializes to/from Markdown so Firestore storage format stays human-readable
 *   and compatible with the existing PDF + plain-text exports.
 * - Toolbar: H1, H2, Bold, Italic, BulletList (per user decision B1/B2 in V2).
 * - Lazy-loaded by consumers via React.lazy; keep this module side-effect free
 *   except for the default export.
 */
export default function RichTextEditor({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  ariaLabel,
  disabled = false,
}: Props) {
  const t = useT();

  // Tracks the last markdown we emitted via onChange.
  // Prevents the sync effect from fighting our own echoed value.
  const lastEmittedRef = useRef<string>(value);

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        code: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
        emptyEditorClass: "is-editor-empty",
      }),
      Markdown.configure({
        html: false,
        linkify: false,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value || "",
    onUpdate: ({ editor: ed }: { editor: Editor }) => {
      const md = getMarkdown(ed);
      lastEmittedRef.current = md;
      onChange(md);
    },
    onBlur: () => {
      onBlur?.();
    },
    onFocus: () => {
      onFocus?.();
    },
    editorProps: {
      attributes: {
        "aria-label": ariaLabel ?? "",
        role: "textbox",
        "aria-multiline": "true",
        spellcheck: "true",
      },
    },
  });

  // If the external \`value\` changes (e.g. first load after Firestore snapshot arrives
  // for a route that rendered before the task was ready), push it into the editor
  // without losing the cursor on every keystroke.
  useEffect(() => {
    if (!editor) return;
    // Skip if this value matches what we just emitted — it's our own echo.
    if (value === lastEmittedRef.current) return;
    const current = getMarkdown(editor);
    if (value === current) return;
    editor.commands.setContent(value || "", false);
    lastEmittedRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div
        className="mt-3 min-h-[17rem] rounded-md border border-line bg-surface"
        aria-busy="true"
      />
    );
  }

  return (
    <div className="cdv-editor">
      {!disabled && (
      <div
        role="toolbar"
        aria-label={t("editor.toolbar")}
        className="flex flex-wrap items-center gap-1 rounded-t-md border border-line border-b-0 bg-bg-subtle px-1.5 py-1"
      >
        <ToolButton
          pressed={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          label={t("editor.h1")}
        >
          <Heading1 size={16} aria-hidden />
        </ToolButton>
        <ToolButton
          pressed={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label={t("editor.h2")}
        >
          <Heading2 size={16} aria-hidden />
        </ToolButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <ToolButton
          pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label={t("editor.bold")}
        >
          <Bold size={16} aria-hidden />
        </ToolButton>
        <ToolButton
          pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label={t("editor.italic")}
        >
          <Italic size={16} aria-hidden />
        </ToolButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <ToolButton
          pressed={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label={t("editor.bulletList")}
        >
          <List size={16} aria-hidden />
        </ToolButton>
      </div>
      )}
      <EditorContent
        editor={editor}
        className={
          disabled
            ? "rounded-md border border-line bg-surface"
            : "rounded-b-md border border-line bg-surface focus-within:border-line-focus"
        }
      />
    </div>
  );
}

function ToolButton({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Prevent toolbar click from stealing selection from the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`grid size-8 place-items-center rounded-md transition-colors ${
        pressed
          ? "bg-accent text-accent-on"
          : "text-ink-muted hover:bg-bg-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function getMarkdown(editor: Editor): string {
  const storage = editor.storage as Record<string, unknown>;
  const md = storage.markdown as { getMarkdown?: () => string } | undefined;
  return md?.getMarkdown?.() ?? "";
}
