import { lazy, Suspense, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, Megaphone, X } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useReports } from "@/hooks/useReports";
import { useUsers } from "@/hooks/useUsers";
import { resolveUserName } from "@/lib/names";
import { markReportRead, isReportUnread } from "@/lib/reports";

const HlaseniDetailPopup = lazy(() => import("./HlaseniDetailPopup"));

/**
 * V26-S07 — transient in-app banner pro kritická hlášení.
 *
 * Pattern: subscribuje se na /reports přes useReports. Když dorazí nové
 * critical hlášení od jiného uživatele než current user, zobrazí top-screen
 * sticky banner s "Rozumím" tlačítkem. Banner je transient — nikam se
 * neukládá (Stáňa Mezera C — non-blocking, žádná persistence).
 *
 * Logika:
 *   - sleduje newest report ID z subscription
 *   - když přijde nový report (newer createdAt než lastSeenAt) + critical +
 *     not by current user, ukáže banner
 *   - dismiss Rozumím = setState clear (žádný server write)
 *   - klik na banner = otevře detail popup
 */
export default function CriticalReportBanner() {
  const t = useT();
  const { user } = useAuth();
  const { reports } = useReports(Boolean(user));
  const { byUid } = useUsers(Boolean(user));
  const [showDetail, setShowDetail] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // V26-fix — banner ukáže nejnovější UNREAD critical report od někoho jiného
  //   než current user. Po dismiss zavoláme markReportRead (arrayUnion uid →
  //   readBy), což na další refresh způsobí, že isReportUnread vrátí false
  //   a banner se neobjeví. Local `dismissedIds` zachycuje optimistic state
  //   pro race window mezi dismiss a server snapshot.
  // V26-fix — banner pro VŠECHNY importance levels (nejen critical).
  //   Iteruje newest first, vrátí první nepřečtené hlášení od jiného uživatele.
  //   Po dismiss → readBy update → banner mizí + neobjeví se po refresh.
  const activeReport = useMemo(() => {
    if (!user) return null;
    for (const r of reports) {
      if (r.createdBy === user.uid) continue;       // self-filter
      if (!isReportUnread(r, user.uid)) continue;   // už přečtené
      if (dismissedIds.has(r.id)) continue;         // optimistic dismiss
      return r;
    }
    return null;
  }, [reports, user, dismissedIds]);

  function handleDismiss() {
    if (!activeReport || !user) return;
    setDismissedIds((prev) => new Set(prev).add(activeReport.id));
    void markReportRead(activeReport.id, user.uid).catch((e) => {
      console.warn("markReportRead failed (banner stays dismissed locally)", e);
    });
  }

  function handleOpenDetail() {
    setShowDetail(true);
  }

  if (!activeReport) return null;

  const author = byUid.get(activeReport.createdBy);
  const authorName = resolveUserName({
    uid: activeReport.createdBy,
    profileDisplayName: author?.displayName,
    email: author?.email,
  });

  return createPortal(
        <>
      <div
        role="alert"
        aria-label={t("hlaseni.criticalBannerLabel")}
        className="fixed inset-x-0 top-0 z-[60] pt-safe"
        style={{
          background: bannerColors(activeReport.importance).bg,
          color: bannerColors(activeReport.importance).fg,
        }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <BannerIcon importance={activeReport.importance} />
          <button
            type="button"
            onClick={handleOpenDetail}
            className="flex min-w-0 flex-1 flex-col text-left"
          >
            <span className="text-xs font-semibold opacity-90">
              {importanceLabel(t, activeReport.importance)} · {authorName} · {formatRelative(t, new Date(activeReport.createdAt))}
            </span>
            <span className="text-sm font-medium line-clamp-2">
              {activeReport.message}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t("hlaseni.criticalBannerDismiss")}
            className="shrink-0 rounded-md bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors"
          >
            {t("hlaseni.criticalBannerDismiss")}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t("common.close")}
            className="shrink-0 grid size-7 place-items-center rounded-md hover:bg-white/20"
          >
            <X aria-hidden size={14} />
          </button>
        </div>
      </div>
      {showDetail && (
        <Suspense fallback={null}>
          <HlaseniDetailPopup
            report={activeReport}
            onClose={() => {
              // V26-fix — Detail popup auto-marks readBy on open; banner se
              //   vyčistí automaticky na dalším renderu (isReportUnread → false).
              setShowDetail(false);
            }}
          />
        </Suspense>
      )}
    </>
  , document.body);
}

// ---------- V26-fix — variant helpers ----------

import type { ReportImportance } from "@/types";
import type { TFn } from "@/i18n/useT";

function bannerColors(importance: ReportImportance): { bg: string; fg: string } {
  if (importance === "critical")
    return { bg: "var(--color-status-danger-fg)", fg: "white" };
  if (importance === "important")
    return { bg: "var(--color-status-otazka-fg)", fg: "white" };
  // normal — neutral (ink) bg, white text. Distinct from kritické / důležité.
  return { bg: "var(--color-ink)", fg: "var(--color-bg)" };
}

function BannerIcon({ importance }: { importance: ReportImportance }) {
  if (importance === "critical")
    return <AlertTriangle aria-hidden size={20} className="shrink-0" />;
  if (importance === "important")
    return <Bell aria-hidden size={20} className="shrink-0" />;
  return <Megaphone aria-hidden size={20} className="shrink-0" />;
}

function importanceLabel(t: TFn, importance: ReportImportance): string {
  if (importance === "critical") return t("hlaseni.importanceCritical");
  if (importance === "important") return t("hlaseni.importanceImportant");
  return t("hlaseni.importanceNormal");
}
