import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Megaphone, AlertTriangle, Bell } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import AvatarCircle from "@/components/AvatarCircle";
import { useReports } from "@/hooks/useReports";
import { isReportUnread } from "@/lib/reports";
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
  const { reports, loading, error } = useReports(Boolean(user));
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
                  className={[
                    "flex w-full items-start gap-3 rounded-md border border-l-4 bg-surface px-4 py-3 text-left transition-colors hover:bg-bg-subtle",
                    importanceBorderClass(r.importance),
                    isUnread ? "ring-1 ring-accent/30" : "",
                  ].join(" ")}
                >
                  <ReportIcon importance={r.importance} />
                  <div className="min-w-0 flex-1">
                    {/* V26 — header s autorem (AvatarCircle + jméno) + čas. */}
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
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink line-clamp-2">{r.message}</p>
                    {(r.media?.length ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-ink-subtle">
                        {r.media!.length} {r.media!.length === 1 ? "soubor" : "souborů"}
                      </p>
                    )}
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

function importanceBorderClass(importance: ReportImportance): string {
  if (importance === "critical")
    return "border-l-[color:var(--color-status-danger-fg)]";
  if (importance === "important")
    return "border-l-[color:var(--color-status-otazka-fg)]";
  return "border-l-line";
}

function ReportIcon({ importance }: { importance: ReportImportance }) {
  if (importance === "critical")
    return <AlertTriangle aria-hidden size={20} className="shrink-0 mt-0.5 text-[color:var(--color-status-danger-fg)]" />;
  if (importance === "important")
    return <Bell aria-hidden size={20} className="shrink-0 mt-0.5 text-[color:var(--color-status-otazka-fg)]" />;
  return <Megaphone aria-hidden size={20} className="shrink-0 mt-0.5 text-ink-muted" />;
}
