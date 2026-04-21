import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Tag, X } from "lucide-react";
import type { Category } from "@/types";
import { useT } from "@/i18n/useT";

interface Props {
  /** Array of selected category IDs. */
  value: string[];
  categories: Category[];
  onChange: (next: string[]) => void | Promise<void>;
  disabled?: boolean;
}

/**
 * CategoryPicker — V3 multi-select chip field.
 * - Selected categories render as inline chips with X (tap to remove).
 * - "Add" button opens a dropdown with unselected categories.
 * - No hard cap on count; layout wraps on narrow screens.
 */
export default function CategoryPicker({ value, categories, onChange, disabled }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(value);
  const selected = categories.filter((c) => selectedSet.has(c.id));
  const available = categories.filter((c) => !selectedSet.has(c.id));

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function addCategory(id: string) {
    setOpen(false);
    if (selectedSet.has(id)) return;
    await onChange([...value, id]);
  }

  async function removeCategory(id: string) {
    await onChange(value.filter((x) => x !== id));
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 && (
          <span className="text-sm text-ink-subtle">{t("detail.categoryNone")}</span>
        )}

        {selected.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle pl-2 pr-1 py-0.5 text-xs text-ink-muted"
          >
            <Tag aria-hidden size={11} />
            {c.label}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeCategory(c.id)}
                aria-label={t("categories.remove")}
                className="ml-0.5 grid size-6 place-items-center rounded-full text-ink-subtle hover:bg-bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                <X aria-hidden size={10} />
              </button>
            )}
          </span>
        ))}

        {!disabled && available.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={t("categories.addMore")}
            className="inline-flex items-center gap-1 rounded-pill border border-dashed border-line px-2 py-0.5 text-xs text-ink-subtle hover:text-ink hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus transition-colors"
          >
            <Plus aria-hidden size={11} />
            {t("categories.addMore")}
            <ChevronDown aria-hidden size={11} />
          </button>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 max-h-72 min-w-[12rem] overflow-y-auto rounded-md border border-line bg-surface shadow-sm"
        >
          {available.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => addCategory(c.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-bg-subtle"
              >
                <Tag aria-hidden size={12} className="text-ink-subtle" />
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
