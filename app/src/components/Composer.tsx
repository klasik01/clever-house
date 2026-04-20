import { useEffect, useRef, useState } from "react";
import { Paperclip, Link as LinkIcon } from "lucide-react";
import { useT } from "@/i18n/useT";
import { loadDraft, saveDraft } from "@/lib/storage";

interface Props {
  onSave: (text: string) => void;
}

/**
 * Quick-capture composer — textarea auto-focused, submit on double-Return
 * or on tap of "Uložit". Draft persists in localStorage across reloads.
 * North-star UX rule: this is the *one* primary action on the home screen.
 */
export default function Composer({ onSave }: Props) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState<string>(() => loadDraft());
  const [lastReturnAt, setLastReturnAt] = useState<number>(0);
  const [justSaved, setJustSaved] = useState(false);

  // Auto-focus on mount; don't steal focus on subsequent re-renders.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea to content (capped).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [value]);

  function commit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setValue("");
    saveDraft("");
    setJustSaved(true);
    // Keep focus in composer for next capture — north-star flow.
    textareaRef.current?.focus();
    window.setTimeout(() => setJustSaved(false), 1800);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    saveDraft(v);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter = submit (desktop power user)
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      commit();
      return;
    }
    // Double-Return inside 600ms on mobile = submit
    if (e.key === "Enter" && !e.shiftKey) {
      const now = Date.now();
      if (now - lastReturnAt < 600) {
        e.preventDefault();
        commit();
        setLastReturnAt(0);
      } else {
        setLastReturnAt(now);
      }
    }
  }

  return (
    <section
      aria-label="Rychlý záznam"
      className="mx-auto max-w-xl px-4 pt-3 pb-2"
    >
      <div className="rounded-lg bg-surface shadow-sm ring-1 ring-line focus-within:ring-line-focus transition-colors">
        <label htmlFor="composer-textarea" className="sr-only">
          {t("composer.placeholder")}
        </label>
        <textarea
          id="composer-textarea"
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t("composer.placeholder")}
          rows={2}
          enterKeyHint="send"
          autoCapitalize="sentences"
          spellCheck
          className="block w-full resize-none rounded-lg bg-transparent px-4 py-3 text-base leading-relaxed placeholder:text-ink-subtle focus:outline-none"
        />

        <div className="flex items-center justify-between border-t border-line px-2 py-1.5">
          <div className="flex items-center gap-1">
            <IconButton
              aria={t("composer.attachPhoto")}
              title={t("composer.attachmentsComingSoon")}
              disabled
            >
              <Paperclip aria-hidden size={18} />
            </IconButton>
            <IconButton
              aria={t("composer.attachLink")}
              title={t("composer.attachmentsComingSoon")}
              disabled
            >
              <LinkIcon aria-hidden size={18} />
            </IconButton>
          </div>

          <button
            type="button"
            onClick={commit}
            disabled={value.trim().length === 0}
            className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover active:bg-accent-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            {t("composer.save")}
          </button>
        </div>
      </div>

      {/* "Saved" live region — announced to screen readers */}
      <p
        aria-live="polite"
        className={`mt-2 text-center text-xs text-ink-subtle transition-opacity duration-base ${
          justSaved ? "opacity-100" : "opacity-0"
        }`}
      >
        {justSaved ? t("composer.saved") : ""}
      </p>
    </section>
  );
}

function IconButton({
  children,
  aria,
  title,
  disabled,
}: {
  children: React.ReactNode;
  aria: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      title={title ?? aria}
      disabled={disabled}
      className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink disabled:opacity-40 transition-colors"
    >
      {children}
    </button>
  );
}
