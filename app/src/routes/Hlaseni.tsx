import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Megaphone, AlertTriangle, Bell, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import AvatarCircle from "@/components/AvatarCircle";
import { useReports } from "@/hooks/useReports";
import { useUserRole } from "@/hooks/useUserRole";
import { canViewReport, isReportUnread } from "@/lib/reports";
import { REPORT_IMPORTANCE_COLORS } from "@/lib/typeColors";
import { resolveUserName } from "@/lib/names";
import type { ReportImportance } from "@/types";

const HlaseniDetailPopup = lazy(() => import("@/components/HlaseniDetailPopup"));

/**
 * V26 — `/hlaseni` route.
 * Seznam hlášení (newest first) + detail popup.
 *
 * Deep-link `#r-{id}` — když user dorazí z push notifikace, popup se
 * automaticky otevře nad listem.
 */
export default function Hlaseni() {
  const t = useT();
  const { user } = useAuth();
  const { byUid } = useUsers(Boolean(user));
  const roleState = useUserRole(user?.uid);
  const role = roleState.status === "ready" ? roleState.profile.role : null;
  const { reports: rawReports, loading, error } = useReports(Boolean(user));
  // V26-fix — visibility filter per targetRoles. canViewReport returns true
  //   pro broadcast (no targetRoles) i pro role-targeted matching.
  const reports = rawReports.filter((r) => canViewReport(r, user?.uid, role));
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // V26 — deep-link parsing: hash #r-{id} otevře popup.
  useEffect(() => {
    const hash = location.hash;
    if (hash.startsWith("#r-")) {
      const id = hash.slice(3);
      setSelectedId(id);
    }
  }, [location.hash]);

  const selected = useMemo(
    () => (selectedId ? reports.find((r) => r.id === selectedId) ?? null : null),
    [selectedId, reports],
  );

  function handleClosePopup() {
    setSelectedId(null);
    if (location.hash.startsWith("#r-")) {
      navigate(location.pathname, { replace: true });
    }
  }

  return (
    <section
      aria-labelledby="hlaseni-heading"
      className="mx-auto max-w-xl px-4 pt-4 pb-4"
    >
      <header className="mb-3">
        <h2 id="hlaseni-heading" className="text-xl font-semibold tracking-tight text-ink">
          {t("hlaseni.pageTitle")}
        </h2>
      </header>

      {loading && (
        <ul className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-20 rounded-md bg-surface ring-1 ring-line animate-pulse"
            />
          ))}
        </ul>
      )}

      {!loading && error && (
        <p role="alert" className="text-sm text-[color:var(--color-status-danger-fg)]">
          {t("hlaseni.loadFailed")}
        </p>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="text-center pt-12">
          <p className="text-base font-medium text-ink">{t("hlaseni.emptyTitle")}</p>
          <p className="mt-2 text-sm text-ink-muted">{t("hlaseni.emptyBody")}</p>
        </div>
      )}

      {!loading && !error && reports.length > 0 && (
        <ul aria-label={t("hlaseni.ariaList")} className="flex flex-col gap-2">
          {reports.map((r) => {
            const isUnread = isReportUnread(r, user?.uid);
            const author = byUid.get(r.createdBy);
            const authorName = resolveUserName({
              uid: r.createdBy,
              profileDisplayName: author?.displayName,
              email: author?.email,
            });
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    borderLeftColor: REPORT_IMPORTANCE_COLORS[r.importance].solid,
                  }}
                  className={[
                    "flex w-full items-start gap-3 rounded-md border-l-4 bg-surface shadow-sm ring-1 ring-line px-4 py-3 text-left transition-colors hover:ring-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
                    isUnread ? "ring-2 ring-accent/40" : "",
                  ].join(" ")}
                >
                  <ReportIcon importance={r.importance} />
                  <div className="min-w-0 flex-1">
                    {/* V26 — header s autorem (AvatarCircle + jméno) + čas + media ikony. */}
                    <div className="flex items-center gap-2">
                      <AvatarCircle
                        uid={r.createdBy}
                        displayName={author?.displayName}
                        email={author?.email}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">
                        <span className="font-semibold text-ink">{authorName}</span>
                        <span className="ml-1.5 text-ink-subtle">
                          · {formatRelative(t, new Date(r.createdAt))}
                        </span>
                      </span>
                      {/* V26-fix — media indicator: small icons (foto / video) místo thumbnailů,
                          stejně jako NapadCard má ImageIcon u úkolu. */}
                      {hasImage(r) && (
                        <span title={t("aria.hasImage")} className="shrink-0">
                          <ImageIcon aria-hidden size={14} className="text-ink-subtle" />
                        </span>
                      )}
                      {hasVideo(r) && (
                        <span title={t("hlaseni.hasVideo")} className="shrink-0">
                          <VideoIcon aria-hidden size={14} className="text-ink-subtle" />
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink line-clamp-2">{r.message}</p>
                  </div>
                  {isUnread && (
                    <span
                      aria-hidden
                      className="mt-1 size-2 rounded-full bg-accent"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <Suspense fallback={null}>
          <HlaseniDetailPopup report={selected} onClose={handleClosePopup} />
        </Suspense>
      )}
    </section>
  );
}

function ReportIcon({ importance }: { importance: ReportImportance }) {
  const c = REPORT_IMPORTANCE_COLORS[importance].solid;
  if (importance === "critical")
    return <AlertTriangle aria-hidden size={20} className="shrink-0 mt-0.5" style={{ color: c }} />;
  if (importance === "important")
    return <Bell aria-hidden size={20} className="shrink-0 mt-0.5" style={{ color: c }} />;
  return <Megaphone aria-hidden size={20} className="shrink-0 mt-0.5" style={{ color: c }} />;
}

function hasImage(r: { media?: { kind: "image" | "video" }[] }): boolean {
  return (r.media ?? []).some((m) => m.kind === "image");
}

function hasVideo(r: { media?: { kind: "image" | "video" }[] }): boolean {
  return (r.media ?? []).some((m) => m.kind === "video");
}
