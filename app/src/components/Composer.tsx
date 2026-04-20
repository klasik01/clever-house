import { useEffect, useRef, useState } from "react";
import { Paperclip, Link as LinkIcon } from "lucide-react";
import { useT } from "@/i18n/useT";
import { loadDraft, saveDraft } from "@/lib/storage";
import type { TaskType } from "@/types";

interface Props {
  /** Return a promise to signal async save. Composer clears only on success. */
  onSave: (text: string, type: TaskType) => Promise<void> | void;
}

/**
 * Quick-capture composer with Nápad/Otázka type toggle.
 * Primary north-star action on the home screen. Clears only on successful save.
 */
export default function Composer({ onSave }: Props) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState<string>(() => loadDraft());
  const [type, setType] = useState<TaskType>("napad");
  const [lastReturnAt, setLastReturnAt] = useState<number>(0);
  const [justSaved, setJustSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [value]);

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSave(trimmed, type);
      setValue("");
      saveDraft("");
      // Reset type to "napad" after save — default intent.
      setType("napad");
      setJustSaved(true);
      textareaRef.current?.focus();
      window.setTimeout(() => setJustSaved(false), 1800);
    } catch {
      // Parent surfaces the error toast; keep text + type so user can retry.
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    saveDraft(v);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      commit();
      return;
    }
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

  const placeholder =
    type === "napad" ? t("composer.placeholder") : t("composer.placeholderOtazka");

  return (
    <section
      aria-label="Rychlý záznam"
      className="mx-auto max-w-xl px-4 pt-3 pb-2"
    >
      <div className="rounded-lg bg-surface shadow-sm ring-1 ring-line focus-within:ring-line-focus transition-colors">
        {/* Type toggle — segmented control */}
        <div
          role="group"
          aria-label={t("composer.typeToggleLabel")}
          className="flex items-center gap-1 border-b border-line bg-bg-subtle/60 p-1 rounded-t-lg"
        >
          <TypePill
            active={type === "napad"}
            onClick={() => setType("napad")}
            label={t("composer.typeNapad")}
          />
          <TypePill
            active={type === "otazka"}
            onClick={() => setType("otazka")}
            label={t("composer.typeOtazka")}
          />
        </div>

        <label htmlFor="composer-textarea" className="sr-only">
          {placeholder}
        </label>
        <textarea
          id="composer-textarea"
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          enterKeyHint="send"
          autoCapitalize="sentences"
          spellCheck
          disabled={submitting}
          className="block w-full resize-none rounded-b-none bg-transparent px-4 py-3 text-base leading-relaxed placeholder:text-ink-subtle focus:outline-none disabled:opacity-60"
        />

        <div className="flex items-center justify-between border-t border-line px-2 py-1.5 rounded-b-lg">
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
            disabled={value.trim().length === 0 || submitting}
            className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover active:bg-accent-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            {submitting ? t("composer.saving") : t("composer.save")}
          </button>
        </div>
      </div>

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

function TypePill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "flex-1 min-h-8 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-fast",
        active
          ? "bg-surface text-ink shadow-sm"
          : "text-ink-subtle hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
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
