import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { createReport } from "@/lib/reports";
import { uploadReportMedia } from "@/lib/attachments";
import { newId } from "@/lib/id";
import { useToast } from "@/components/Toast";
import type { ReportImportance, ReportMedia, UserRole } from "@/types";
import { REPORT_IMPORTANCE_COLORS } from "@/lib/typeColors";

interface Props {
  onClose: () => void;
}

interface StagedMedia {
  id: string;
  file: File;
  previewUrl: string;
  kind: "image" | "video";
}

const MAX_MEDIA_PER_REPORT = 4;

/**
 * V26 — modal pro vytvoření hlášení ze stavby.
 *
 * Layout:
 *   - povinný textarea s placeholderem ("Co se stalo?")
 *   - importance picker (3 pillsy: Běžné / Důležité / Kritické)
 *   - media uploader: foto/video tlačítko (mobile camera capture)
 *   - Odeslat / Zrušit
 *
 * Per V26 brief Mezera A=a — samostatná Firestore kolekce `/reports`.
 * Permissions: VŠICHNI (OWNER+PM+CM) mohou vytvořit.
 */
export default function HlaseniComposer({ onClose }: Props) {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const role = roleState.status === "ready" ? roleState.profile.role : null;
  const { show: showToast } = useToast();

  const [message, setMessage] = useState("");
  const [importance, setImportance] = useState<ReportImportance>("normal");
  const [staged, setStaged] = useState<StagedMedia[]>([]);
  // V26-fix — targetRoles selection. Empty Set = broadcast (default).
  //   Pokud user zaškrtne nějaké role, jen ty dostanou hlášení.
  const [targetRoles, setTargetRoles] = useState<Set<UserRole>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ESC = close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const next: StagedMedia[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        setError(t("hlaseni.errorUnsupportedMedia"));
        continue;
      }
      if (isVideo && file.size > 50 * 1024 * 1024) {
        setError(t("hlaseni.errorVideoTooBig"));
        continue;
      }
      next.push({
        id: newId(),
        file,
        previewUrl: URL.createObjectURL(file),
        kind: isVideo ? "video" : "image",
      });
    }
    setStaged((prev) => {
      const combined = [...prev, ...next];
      if (combined.length > MAX_MEDIA_PER_REPORT) {
        combined.slice(MAX_MEDIA_PER_REPORT).forEach((s) => URL.revokeObjectURL(s.previewUrl));
        setError(t("hlaseni.errorMaxMedia", { n: MAX_MEDIA_PER_REPORT }));
        return combined.slice(0, MAX_MEDIA_PER_REPORT);
      }
      setError(null);
      return combined;
    });
  }

  function removeMedia(id: string) {
    setStaged((prev) => {
      const m = prev.find((s) => s.id === id);
      if (m) URL.revokeObjectURL(m.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  async function handleSubmit() {
    if (!user || !role) return;
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setError(t("hlaseni.errorMessageRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // V26 — generate reportId pre-upload, používán jako Storage path part.
      const reportId = newId();

      // Upload media sequentially (žádný parallel — videa jsou velká, šetříme bandwidth).
      const uploaded: ReportMedia[] = [];
      for (const s of staged) {
        const result = await uploadReportMedia({
          file: s.file,
          uid: user.uid,
          reportId,
        });
        uploaded.push({
          id: s.id,
          url: result.url,
          path: result.path,
          contentType: result.contentType,
          kind: result.kind,
        });
      }

      await createReport(
        {
          message: trimmed,
          importance,
          media: uploaded,
          targetRoles: targetRoles.size > 0 ? Array.from(targetRoles) : undefined,
        },
        user.uid,
        role,
      );

      // Cleanup blob URLs
      staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      onClose();
      showToast(t("hlaseni.toastSent"), "success");
    } catch (err) {
      console.error("createReport failed", err);
      setError(t("hlaseni.errorSendFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const importanceOptions: Array<{
    key: ReportImportance;
    label: string;
  }> = [
    { key: "normal", label: t("hlaseni.importanceNormal") },
    { key: "important", label: t("hlaseni.importanceImportant") },
    { key: "critical", label: t("hlaseni.importanceCritical") },
  ];

  return createPortal(
        <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label={t("hlaseni.composerTitle")}
    >
      <div
        className="my-8 flex w-full max-w-[min(28rem,calc(100dvw-2rem))] flex-col overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line"
        style={{ maxHeight: "calc(100dvh - 4rem)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
            {t("hlaseni.composerTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t("common.close")}
            className="shrink-0 grid size-9 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle disabled:opacity-40"
          >
            <X aria-hidden size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {/* Message textarea */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("hlaseni.messagePlaceholder")}
            rows={3}
            disabled={submitting}
            className="block w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-line-focus disabled:opacity-60"
          />

          {/* Importance picker */}
          <div className="flex flex-wrap gap-1.5">
            {importanceOptions.map((opt) => {
              const active = importance === opt.key;
              const c = REPORT_IMPORTANCE_COLORS[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setImportance(opt.key)}
                  disabled={submitting}
                  aria-pressed={active}
                  style={
                    active
                      ? { background: c.bg, color: c.fg }
                      : { borderColor: c.solid, color: c.solid }
                  }
                  className={`inline-flex min-h-tap items-center gap-1.5 rounded-pill border-2 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                    active ? "" : "bg-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Staged media preview */}
          {staged.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {staged.map((s) => (
                <li key={s.id} className="relative">
                  {s.kind === "image" ? (
                    <img
                      src={s.previewUrl}
                      alt=""
                      className="size-20 rounded-md object-cover ring-1 ring-line"
                    />
                  ) : (
                    <video
                      src={s.previewUrl}
                      className="size-20 rounded-md object-cover ring-1 ring-line bg-black"
                      muted
                      playsInline
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(s.id)}
                    disabled={submitting}
                    aria-label={t("composer.removeAttachment")}
                    className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-black/75 text-white shadow hover:bg-black focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-40"
                  >
                    <X aria-hidden size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* V26-fix — recipient targeting (default = broadcast all) */}
          <div>
            <p className="text-xs font-medium text-ink-subtle mb-1.5">
              {t("hlaseni.targetRolesLabel")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"] as UserRole[]).map((r) => {
                const active = targetRoles.has(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setTargetRoles((prev) => {
                        const next = new Set(prev);
                        if (active) next.delete(r);
                        else next.add(r);
                        return next;
                      });
                    }}
                    disabled={submitting}
                    aria-pressed={active}
                    className={`inline-flex min-h-tap items-center rounded-pill px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                      active
                        ? "bg-accent text-accent-on ring-2 ring-line-focus"
                        : "bg-bg-subtle text-ink-muted hover:text-ink"
                    }`}
                  >
                    {t(`role.${r}`)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-ink-subtle">
              {targetRoles.size === 0
                ? t("hlaseni.targetRolesAll")
                : t("hlaseni.targetRolesPicked", { n: targetRoles.size })}
            </p>
          </div>

          {/* Hidden file inputs — image/video, with camera capture preference */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={handleFilePick}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFilePick}
          />

          {/* Media upload buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={submitting || staged.length >= MAX_MEDIA_PER_REPORT}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-md border border-line bg-transparent px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg-subtle disabled:opacity-40"
            >
              <Camera aria-hidden size={14} />
              {t("hlaseni.takePhotoVideo")}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || staged.length >= MAX_MEDIA_PER_REPORT}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-md border border-line bg-transparent px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg-subtle disabled:opacity-40"
            >
              <ImageIcon aria-hidden size={14} />
              {t("hlaseni.pickFromGallery")}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs text-[color:var(--color-status-danger-fg)]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-tap rounded-md border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || message.trim().length === 0}
            className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            {submitting ? t("hlaseni.sending") : t("hlaseni.send")}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}
