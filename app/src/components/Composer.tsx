import { useEffect, useRef, useState } from "react";
import { Paperclip, Link as LinkIcon, X as XIcon } from "lucide-react";
import { useT } from "@/i18n/useT";
import { loadDraft, saveDraft } from "@/lib/storage";
import { isSupportedImage } from "@/lib/attachments";
import type { TaskType } from "@/types";

interface Props {
  /** onSave(text, type, imageFile?) — parent handles create + optional upload. */
  onSave: (text: string, type: TaskType, imageFile?: File | null) => Promise<void> | void;
}

export default function Composer({ onSave }: Props) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>(() => loadDraft());
  const [type, setType] = useState<TaskType>("napad");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lastReturnAt, setLastReturnAt] = useState<number>(0);
  const [justSaved, setJustSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [value]);

  // Release blob URLs when preview changes or component unmounts
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking same file again later
    if (!file) return;
    if (!isSupportedImage(file)) {
      setFileError(t("detail.attachmentUnsupported"));
      return;
    }
    setFileError(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearAttachment() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSave(trimmed, type, imageFile);
      setValue("");
      saveDraft("");
      setType("napad");
      clearAttachment();
      setJustSaved(true);
      textareaRef.current?.focus();
      window.setTimeout(() => setJustSaved(false), 1800);
    } catch {
      // Parent surfaces error via toast; keep state so user can retry.
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
    <section aria-label="Rychlý záznam" className="mx-auto max-w-xl px-4 pt-3 pb-2">
      <div className="rounded-lg bg-surface shadow-sm ring-1 ring-line focus-within:ring-line-focus transition-colors">
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

        {imagePreview && (
          <div className="relative mx-2 mb-1 inline-block">
            <img
              src={imagePreview}
              alt={t("composer.attachPreview")}
              className="h-20 w-20 rounded-md object-cover ring-1 ring-line"
            />
            <button
              type="button"
              onClick={clearAttachment}
              aria-label={t("composer.removeAttachment")}
              className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-pill bg-black/75 text-white shadow"
            >
              <XIcon aria-hidden size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line px-2 py-1.5 rounded-b-lg">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              aria-label={t("composer.attachPhoto")}
              className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink disabled:opacity-40 transition-colors"
            >
              <Paperclip aria-hidden size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              type="button"
              aria-label={t("composer.attachLink")}
              title={t("composer.attachmentsComingSoon")}
              disabled
              className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle opacity-40"
            >
              <LinkIcon aria-hidden size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={commit}
            disabled={value.trim().length === 0 || submitting}
            className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover active:bg-accent-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            {submitting
              ? imageFile
                ? t("composer.uploading")
                : t("composer.saving")
              : t("composer.save")}
          </button>
        </div>
      </div>

      {fileError && (
        <p role="alert" className="mt-2 text-center text-xs text-[color:var(--color-status-danger-fg)]">
          {fileError}
        </p>
      )}

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
        active ? "bg-surface text-ink shadow-sm" : "text-ink-subtle hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
