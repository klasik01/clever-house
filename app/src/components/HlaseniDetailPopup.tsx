import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Megaphone, AlertTriangle, Bell, Trash2 } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import AvatarCircle from "./AvatarCircle";
import { resolveUserName } from "@/lib/names";
import { deleteReport, markReportRead } from "@/lib/reports";
import { REPORT_IMPORTANCE_COLORS } from "@/lib/typeColors";
import { deleteReportMedia } from "@/lib/attachments";
import { useToast } from "@/components/Toast";
import type { ReportImportance, ReportMedia, SiteReport } from "@/types";

interface Props {
  report: SiteReport;
  onClose: () => void;
}

/**
 * V26 — detail popup hlášení. Žádný workflow:
 *   - text + importance + autor + čas + média
 *   - jen "Zavřít" (per V26 brief)
 *   - auto-mark readBy on open (Mezera H=a)
 */
const Lightbox = lazy(() => import("./Lightbox"));

export default function HlaseniDetailPopup({ report, onClose }: Props) {
  const t = useT();
  const { user } = useAuth();
  const { byUid } = useUsers(Boolean(user));
  const { show: showToast } = useToast();
  const [deleting, setDeleting] = useState(false);
  // V26-fix — lightbox state pro klik na média (image / video).
  const [lightbox, setLightbox] = useState<ReportMedia | null>(null);
  const isAuthor = Boolean(user && user.uid === report.createdBy);

  async function handleDelete() {
    if (!isAuthor || deleting) return;
    if (!window.confirm(t("hlaseni.confirmDelete"))) return;
    setDeleting(true);
    try {
      // V26 — delete attached media first (best-effort), then Firestore doc.
      //   Pokud media cleanup selže, doc zmizí stejně — orphan media jsou
      //   nezávazné (nikdo na ně neodkazuje). Server rule povolí delete jen
      //   autorovi.
      for (const m of report.media ?? []) {
        if (m.path) {
          await deleteReportMedia(m.path).catch(() => {});
        }
      }
      await deleteReport(report.id);
      showToast(t("hlaseni.toastDeleted"), "success");
      onClose();
    } catch (e) {
      console.error("delete report failed", e);
      showToast(t("hlaseni.errorDeleteFailed"), "error");
      setDeleting(false);
    }
  }

  // V26 — auto-mark readBy on open. Idempotentní (arrayUnion na serveru).
  useEffect(() => {
    if (!user) return;
    if ((report.readBy ?? []).includes(user.uid)) return;
    void markReportRead(report.id, user.uid);
  }, [user, report.id, report.readBy]);

  // ESC = close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const author = byUid.get(report.createdBy);
  const authorName = resolveUserName({
    uid: report.createdBy,
    profileDisplayName: author?.displayName,
    email: author?.email,
  });
  const created = new Date(report.createdAt);

  return createPortal(
    <div
      // V26-fix — backdrop click NEZAVŘE detail (per user request).
      //   Closure jen explicitně přes X v headeru nebo ESC keypress.
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label={t("hlaseni.detailTitle")}
    >
      <div
        className="my-8 flex w-full max-w-[min(28rem,calc(100dvw-2rem))] flex-col overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line"
        style={{ maxHeight: "calc(100dvh - 4rem)" }}
      >
        {/* Header s importance badge */}
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ImportanceIcon importance={report.importance} />
            <ImportanceLabel importance={report.importance} />
          </div>
          {isAuthor && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              aria-label={t("common.delete")}
              className="shrink-0 grid size-9 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle hover:text-[color:var(--color-status-danger-fg)] disabled:opacity-40 transition-colors"
            >
              <Trash2 aria-hidden size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            aria-label={t("common.close")}
            className="shrink-0 grid size-9 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle disabled:opacity-40"
          >
            <X aria-hidden size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {/* Message */}
          <p className="whitespace-pre-wrap break-words text-sm text-ink">
            {report.message}
          </p>

          {/* Media — klik otevře Lightbox (V26-fix). */}
          {(report.media?.length ?? 0) > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {report.media!.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setLightbox(m)}
                    aria-label={m.kind === "video" ? t("hlaseni.hasVideo") : t("aria.hasImage")}
                    className="block w-full overflow-hidden rounded-md ring-1 ring-line focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    {m.kind === "image" ? (
                      <img
                        src={m.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video
                        src={m.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover bg-black"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* V26 — Author + čas s avatarem, prominentní v body */}
          <div className="flex items-center gap-2 border-t border-line pt-3">
            <AvatarCircle
              uid={report.createdBy}
              displayName={author?.displayName}
              email={author?.email}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">{authorName}</p>
              <p className="text-xs text-ink-muted">
                {formatRelative(t, created)} · {created.toLocaleString("cs-CZ")}
              </p>
            </div>
          </div>
        </div>

      </div>
      {lightbox && (
        <Suspense fallback={null}>
          <Lightbox
            src={lightbox.url}
            kind={lightbox.kind}
            shareable
            shareTitle={report.message.slice(0, 80)}
            onClose={() => setLightbox(null)}
          />
        </Suspense>
      )}
    </div>
  , document.body);
}

function ImportanceIcon({ importance }: { importance: ReportImportance }) {
  const c = REPORT_IMPORTANCE_COLORS[importance].solid;
  if (importance === "critical")
    return <AlertTriangle aria-hidden size={16} style={{ color: c }} />;
  if (importance === "important")
    return <Bell aria-hidden size={16} style={{ color: c }} />;
  return <Megaphone aria-hidden size={16} style={{ color: c }} />;
}

function ImportanceLabel({ importance }: { importance: ReportImportance }) {
  const t = useT();
  const className = "text-sm font-semibold truncate";
  const c = REPORT_IMPORTANCE_COLORS[importance].solid;
  if (importance === "critical")
    return <h2 className={className} style={{ color: c }}>{t("hlaseni.importanceCritical")}</h2>;
  if (importance === "important")
    return <h2 className={className} style={{ color: c }}>{t("hlaseni.importanceImportant")}</h2>;
  return <h2 className={className} style={{ color: c }}>{t("hlaseni.importanceNormal")}</h2>;
}
