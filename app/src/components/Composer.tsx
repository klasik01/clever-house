import { useEffect, useRef, useState } from "react";
import { Paperclip, Link as LinkIcon, X as XIcon } from "lucide-react";
import { useT } from "@/i18n/useT";
import { loadDraft, saveDraft } from "@/lib/storage";
import { isSupportedFile } from "@/lib/attachments";
import { normalizeUrl, parseDomain } from "@/lib/links";
import LinkFavicon from "./LinkFavicon";
import type { TaskType } from "@/types";

interface StagedImage {
  file: File;
  previewUrl: string;
}

interface Props {
  onSave: (
    text: string,
    type: TaskType,
    imageFiles: File[],
    linkUrls: string[]
  ) => Promise<void> | void;
  /**
   * When set, the type toggle is hidden and every save uses this type.
   * Single-type hard lock — still supported for backward compatibility, but
   * `allowedTypes` is preferred because V14 PM can create two types.
   */
  lockedType?: TaskType;
  /**
   * V14 — restrict which pill options render. Order is preserved as visual
   * order. Default: ["napad", "otazka", "ukol"] for OWNER. PM gets
   * ["otazka", "ukol"] so they can pick but can't capture a nápad (nápady are
   * the OWNER's thought capture — PM doesn't author them).
   * Ignored when `lockedType` is set.
   */
  allowedTypes?: TaskType[];
}

const MAX_COMPOSER_IMAGES = 10;

export default function Composer({ onSave, lockedType, allowedTypes }: Props) {
  const types: TaskType[] = allowedTypes && allowedTypes.length > 0
    ? allowedTypes
    : ["napad", "otazka", "ukol", "dokumentace"];
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>(() => loadDraft());
  const [type, setType] = useState<TaskType>(lockedType ?? types[0]);
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [linkUrls, setLinkUrls] = useState<string[]>([]);
  const [lastReturnAt, setLastReturnAt] = useState<number>(0);
  const [justSaved, setJustSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [value]);

  // Revoke all blob URLs on unmount
  useEffect(() => {
    return () => {
      stagedImages.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const next: StagedImage[] = [];
    for (const file of files) {
      if (!isSupportedFile(file)) {
        setError(t("detail.attachmentUnsupported"));
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (next.length === 0) return;

    setStagedImages((prev) => {
      const combined = [...prev, ...next];
      if (combined.length > MAX_COMPOSER_IMAGES) {
        // Revoke the overflow we're rejecting
        combined.slice(MAX_COMPOSER_IMAGES).forEach((s) => URL.revokeObjectURL(s.previewUrl));
      }
      return combined.slice(0, MAX_COMPOSER_IMAGES);
    });
    setError(null);
  }

  function removeImage(index: number) {
    setStagedImages((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function clearAllImages() {
    stagedImages.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStagedImages([]);
  }

  function promptForLink() {
    const input = window.prompt(t("composer.linkPromptTitle"), "");
    if (input === null) return;
    if (!input.trim()) return;
    const normalized = normalizeUrl(input);
    if (!normalized) {
      setError(t("composer.linkInvalid"));
      return;
    }
    setError(null);
    setLinkUrls((prev) => [...prev, normalized]);
  }

  function removeLink(index: number) {
    setLinkUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSave(trimmed, type, stagedImages.map((s) => s.file), linkUrls);
      setValue("");
      saveDraft("");
      setType(lockedType ?? types[0]);
      clearAllImages();
      setLinkUrls([]);
      setJustSaved(true);
      textareaRef.current?.focus();
      window.setTimeout(() => setJustSaved(false), 1800);
    } catch {
      /* parent toast */
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
    type === "napad"
      ? t("composer.placeholder")
      : type === "ukol"
      ? t("composer.placeholderUkol")
      : type === "dokumentace"
      ? t("composer.placeholderDokumentace")
      : t("composer.placeholderOtazka");

  return (
    <section aria-label={t("aria.quickCapture")} className="mx-auto max-w-xl px-4 pt-3 pb-2">
      <div className="rounded-lg bg-surface shadow-sm ring-1 ring-line focus-within:ring-line-focus transition-colors">
        {!lockedType && types.length > 1 && (
          <div
            role="group"
            aria-label={t("composer.typeToggleLabel")}
            className="flex items-center gap-1 border-b border-line bg-bg-subtle/60 p-1 rounded-t-lg"
          >
            {types.map((tp) => (
              <TypePill
                key={tp}
                active={type === tp}
                onClick={() => setType(tp)}
                label={t(
                  tp === "napad"
                    ? "composer.typeNapad"
                    : tp === "otazka"
                    ? "composer.typeOtazka"
                    : tp === "dokumentace"
                    ? "composer.typeDokumentace"
                    : "composer.typeUkol"
                )}
              />
            ))}
          </div>
        )}

        <label htmlFor="composer-textarea" className="sr-only">{placeholder}</label>
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

        {(stagedImages.length > 0 || linkUrls.length > 0) && (
          <div className="mx-2 mb-1 flex flex-wrap items-center gap-2">
            {stagedImages.map((img, i) => (
              <div key={i} className="relative inline-block">
                <img
                  src={img.previewUrl}
                  alt={t("composer.attachPreview")}
                  width={80}
                  height={80}
                  decoding="async"
                  className="h-20 w-20 rounded-md object-cover ring-1 ring-line"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label={t("composer.removeAttachment")}
                  className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-pill bg-black/75 text-white shadow"
                >
                  <XIcon aria-hidden size={14} />
                </button>
              </div>
            ))}
            {linkUrls.map((url, i) => {
              const domain = parseDomain(url) ?? url;
              return (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-pill bg-bg-subtle px-3 py-1 text-sm text-ink-muted">
                  <LinkFavicon url={url} size={14} />
                  <span className="max-w-[10rem] truncate">{domain}</span>
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    aria-label={t("composer.removeAttachment")}
                    className="ml-1 grid size-5 place-items-center rounded-pill hover:bg-black/10"
                  >
                    <XIcon aria-hidden size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line px-2 py-1.5 rounded-b-lg">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || stagedImages.length >= MAX_COMPOSER_IMAGES}
              aria-label={t("composer.attachPhoto")}
              title={
                stagedImages.length >= MAX_COMPOSER_IMAGES
                  ? t("composer.maxImages", { n: MAX_COMPOSER_IMAGES })
                  : t("composer.attachPhoto")
              }
              className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink disabled:opacity-40 transition-colors"
            >
              <Paperclip aria-hidden size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              type="button"
              onClick={promptForLink}
              disabled={submitting}
              aria-label={t("composer.attachLink")}
              className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink disabled:opacity-40 transition-colors"
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
              ? stagedImages.length > 0
                ? t("composer.uploading")
                : t("composer.saving")
              : t("composer.save")}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-[color:var(--color-status-danger-fg)]">
          {error}
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

function TypePill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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
