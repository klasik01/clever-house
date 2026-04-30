import { lazy, Suspense, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, Megaphone, X } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import type { TFn } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useReports } from "@/hooks/useReports";
import { useUsers } from "@/hooks/useUsers";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveUserName } from "@/lib/names";
import { canViewReport, markReportRead, isReportUnread } from "@/lib/reports";
import { REPORT_IMPORTANCE_COLORS } from "@/lib/typeColors";
import type { ReportImportance, SiteReport } from "@/types";

const HlaseniDetailPopup = lazy(() => import("./HlaseniDetailPopup"));

/**
 * V26-S07 + fix — top-screen banner pro nová unread hlášení (všechny importance).
 *
 * Klik na banner = otevři detail popup. Detail popup je řízený **separátní**
 * `detailReport` state, takže když banner sám zmizí (readBy update po
 * markReportRead), detail zůstává otevřený dokud user neklikne Zavřít.
 *
 * Logika:
 *   - subscribuje se na /reports
 *   - newest unread non-self report respektující targetRoles → activeReport
 *   - klik banner → setDetailReport(activeReport) → popup mountne nezávisle
 *   - "Rozumím" / X → markReportRead → readBy update → banner zmizí
 *   - po refresh: server data má uid v readBy → banner se neobjeví
 */
export default function CriticalReportBanner() {
  const t = useT();
  const { user } = useAuth();
  const { reports } = useReports(Boolean(user));
  const { byUid } = useUsers(Boolean(user));
  const roleState = useUserRole(user?.uid);
  const role = roleState.status === "ready" ? roleState.profile.role : null;
  const [detailReport, setDetailReport] = useState<SiteReport | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Newest unread report od jiného usera, respektující targetRoles + dismiss.
  const activeReport = useMemo(() => {
    if (!user) return null;
    for (const r of reports) {
      if (r.createdBy === user.uid) continue;
      if (!canViewReport(r, user.uid, role)) continue;
      if (!isReportUnread(r, user.uid)) continue;
      if (dismissedIds.has(r.id)) continue;
      return r;
    }
    return null;
  }, [reports, user, role, dismissedIds]);

  function handleDismiss() {
    if (!activeReport || !user) return;
    setDismissedIds((prev) => new Set(prev).add(activeReport.id));
    void markReportRead(activeReport.id, user.uid).catch((e) => {
      console.warn("markReportRead failed (banner stays dismissed locally)", e);
    });
  }

  function handleOpenDetail() {
    if (!activeReport) return;
    // V26-fix — snapshot reportu do detailReport. Banner pak může zmizet
    //   (readBy update po detail mount → markReportRead), ale detail zůstává
    //   otevřený nezávisle.
    setDetailReport(activeReport);
  }

  // Render obou částí nezávisle. Žádný early return — když je banner null,
  //   detail popup může být stále otevřený.
  return createPortal(
    <>
      {activeReport && (
        <BannerView
          t={t}
          report={activeReport}
          authorName={resolveUserName({
            uid: activeReport.createdBy,
            profileDisplayName: byUid.get(activeReport.createdBy)?.displayName,
            email: byUid.get(activeReport.createdBy)?.email,
          })}
          onOpen={handleOpenDetail}
          onDismiss={handleDismiss}
        />
      )}
      {detailReport && (
        <Suspense fallback={null}>
          <HlaseniDetailPopup
            report={detailReport}
            onClose={() => setDetailReport(null)}
          />
        </Suspense>
      )}
    </>,
    document.body,
  );
}

// ---------- Banner sub-component ----------

interface BannerProps {
  t: TFn;
  report: SiteReport;
  authorName: string;
  onOpen: () => void;
  onDismiss: () => void;
}

function BannerView({ t, report, authorName, onOpen, onDismiss }: BannerProps) {
  const colors = bannerColors(report.importance);
  return (
    <div
      role="alert"
      aria-label={t("hlaseni.criticalBannerLabel")}
      onClick={onOpen}
      className="fixed inset-x-0 top-0 z-[60] cursor-pointer pt-safe"
      style={{ background: colors.bg, color: colors.fg }}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        <BannerIcon importance={report.importance} />
        <div className="flex min-w-0 flex-1 flex-col text-left">
          <span className="text-xs font-semibold opacity-90">
            {importanceLabel(t, report.importance)} · {authorName} ·{" "}
            {formatRelative(t, new Date(report.createdAt))}
          </span>
          <span className="text-sm font-medium line-clamp-2">{report.message}</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label={t("hlaseni.criticalBannerDismiss")}
          className="shrink-0 rounded-md bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          {t("hlaseni.criticalBannerDismiss")}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label={t("common.close")}
          className="shrink-0 grid size-7 place-items-center rounded-md hover:bg-white/20"
        >
          <X aria-hidden size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------- Variant helpers ----------

function bannerColors(importance: ReportImportance): { bg: string; fg: string } {
  return REPORT_IMPORTANCE_COLORS[importance];
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
