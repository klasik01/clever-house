import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useBudgetSections } from "@/hooks/useBudgetSections";
import { useAllInvoices } from "@/hooks/useAllInvoices";
import { useBankDrawdowns } from "@/hooks/useBankDrawdowns";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { computeDashboardKpis } from "@/lib/budget/totals";
import {
  daysOverdue,
  getOverdueInvoices,
  getThisWeekInvoices,
} from "@/lib/budget/invoiceStatus";
import { formatCzk } from "@/lib/budget/format";
import KPITile from "@/components/budget/KPITile";
import StatusChip from "@/components/budget/StatusChip";
import { rozpocetSekce, rozpocetSekceDetail, ROUTES } from "@/lib/routes";
import type { BudgetInvoice, BudgetSection } from "@/types";

export default function RozpocetDashboard() {
  const t = useT();
  const navigate = useNavigate();
  const sectionsState = useBudgetSections();
  const invoicesState = useAllInvoices();
  const drawdownsState = useBankDrawdowns();
  const settingsState = useBudgetSettings();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const allInvoicesFlat = useMemo(() => {
    if (invoicesState.status !== "ready") return [] as BudgetInvoice[];
    return Object.values(invoicesState.invoicesBySectionId).flat();
  }, [invoicesState]);

  const kpis = useMemo(() => {
    const dd = drawdownsState.status === "ready" ? drawdownsState.drawdowns : [];
    const settings = settingsState.status === "ready" ? settingsState.settings : null;
    if (invoicesState.status !== "ready") {
      return {
        paidTotalCzk: 0,
        openTotalCzk: 0,
        drawnTotalCzk: 0,
        mortgageLimitCzk: settings?.mortgageApprovedAmountCzk ?? null,
      };
    }
    return computeDashboardKpis(
      invoicesState.invoicesBySectionId,
      dd,
      settings,
    );
  }, [invoicesState, drawdownsState, settingsState]);

  const overdue = useMemo(
    () => getOverdueInvoices(allInvoicesFlat, today),
    [allInvoicesFlat, today],
  );
  const thisWeek = useMemo(
    () => getThisWeekInvoices(allInvoicesFlat, today),
    [allInvoicesFlat, today],
  );
  const overdueTotal = useMemo(
    () => overdue.reduce((s, i) => s + i.castka, 0),
    [overdue],
  );

  const sectionsById = useMemo(() => {
    if (sectionsState.status !== "ready") return {} as Record<string, BudgetSection>;
    return Object.fromEntries(sectionsState.sections.map((s) => [s.id, s]));
  }, [sectionsState]);

  const isLoading =
    sectionsState.status === "loading" || invoicesState.status === "loading";
  const isError =
    sectionsState.status === "error" || invoicesState.status === "error";
  const hasNoData =
    sectionsState.status === "ready" &&
    sectionsState.sections.length === 0 &&
    invoicesState.status === "ready";

  return (
    <section
      aria-labelledby="rozpocet-dashboard-heading"
      className="mx-auto max-w-xl space-y-4 px-4 py-6"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="rozpocet-dashboard-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("budget.dashboard.title")}
        </h2>
      </header>

      {isError ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {t("budget.dashboard.errorLoad")}
        </p>
      ) : isLoading ? (
        <KPITileSkeleton label={t("budget.dashboard.kpiPaidLabel")} />
      ) : hasNoData ? (
        <EmptyState onCreate={() => navigate(rozpocetSekce())} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KPITile
              label={t("budget.dashboard.kpiPaidLabel")}
              value={formatCzk(kpis.paidTotalCzk)}
              onClick={() => navigate(rozpocetSekce())}
            />
            <KPITile
              label={t("budget.dashboard.kpiOpenLabel")}
              value={formatCzk(kpis.openTotalCzk)}
              subText={
                overdueTotal > 0
                  ? t("budget.dashboard.kpiOpenSub", { overdue: formatCzk(overdueTotal) })
                  : undefined
              }
              onClick={() => navigate(rozpocetSekce())}
            />
            <KPITile
              label={t("budget.dashboard.kpiBankaLabel")}
              value={formatCzk(kpis.drawnTotalCzk)}
              subText={
                kpis.mortgageLimitCzk !== null
                  ? t("budget.dashboard.kpiBankaSub", {
                      limit: formatCzk(kpis.mortgageLimitCzk),
                    })
                  : t("budget.dashboard.kpiBankaSubNoLimit")
              }
              onClick={() => navigate(ROUTES.rozpocetHypoteka)}
            />
          </div>

          {/* Po splatnosti */}
          <Panel
            title={t("budget.dashboard.overdueTitle")}
            icon={<AlertTriangle aria-hidden size={16} className="text-status-danger-fg" />}
            tone="danger"
          >
            {overdue.length === 0 ? (
              <EmptyPanel text={t("budget.dashboard.overdueEmpty")} />
            ) : (
              <ul className="space-y-1.5">
                {overdue.map((inv) => (
                  <DashboardInvoiceRow
                    key={inv.id}
                    invoice={inv}
                    section={sectionsById[inv.sectionId]}
                    today={today}
                    onClick={() => navigate(rozpocetSekceDetail(inv.sectionId))}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {/* K zaplacení tento týden */}
          <Panel
            title={t("budget.dashboard.thisWeekTitle")}
            icon={<CalendarClock aria-hidden size={16} className="text-status-warning-fg" />}
            tone="warning"
          >
            {thisWeek.length === 0 ? (
              <EmptyPanel text={t("budget.dashboard.thisWeekEmpty")} />
            ) : (
              <ul className="space-y-1.5">
                {thisWeek.map((inv) => (
                  <DashboardInvoiceRow
                    key={inv.id}
                    invoice={inv}
                    section={sectionsById[inv.sectionId]}
                    today={today}
                    onClick={() => navigate(rozpocetSekceDetail(inv.sectionId))}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {/* Roadmap card */}
          <div className="rounded-md border border-status-info-border bg-status-info-bg px-4 py-3 text-sm text-status-info-fg">
            <p className="font-semibold">{t("budget.dashboard.upcomingTitle")}</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 leading-relaxed">
              <li>{t("budget.dashboard.upcomingS07")}</li>
              <li>{t("budget.dashboard.upcomingS08")}</li>
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

function Panel({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "danger" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  const ringClass =
    tone === "danger"
      ? "ring-status-danger-border"
      : tone === "warning"
      ? "ring-status-warning-border"
      : "ring-line";
  const bgClass =
    tone === "danger"
      ? "bg-status-danger-bg/30"
      : tone === "warning"
      ? "bg-status-warning-bg/30"
      : "bg-surface";
  return (
    <div className={`rounded-md ring-1 ${ringClass} ${bgClass} px-4 py-3`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="text-xs text-ink-muted">{text}</p>;
}

function DashboardInvoiceRow({
  invoice,
  section,
  today,
  onClick,
}: {
  invoice: BudgetInvoice;
  section: BudgetSection | undefined;
  today: string;
  onClick: () => void;
}) {
  const t = useT();
  const overdueDays =
    invoice.status === "OPEN" && invoice.splatnost && invoice.splatnost < today
      ? daysOverdue(invoice.splatnost, today)
      : undefined;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full min-h-tap items-center gap-2 rounded-md bg-surface px-3 py-2 text-left ring-1 ring-line hover:bg-bg-subtle"
      >
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink truncate">
              {section?.title ?? "—"}
            </span>
            {overdueDays !== undefined ? (
              <StatusChip status="OVERDUE" daysOverdue={overdueDays} />
            ) : null}
          </div>
          {invoice.splatnost ? (
            <span className="text-xs text-ink-muted">
              {t("budget.invoice.splatnostShort")}: {formatDateCs(invoice.splatnost)}
            </span>
          ) : null}
        </div>
        <span className="text-base font-semibold text-ink tabular-nums shrink-0">
          {formatCzk(invoice.castka)}
        </span>
        <ChevronRight aria-hidden size={16} className="text-ink-subtle shrink-0" />
      </button>
    </li>
  );
}

function KPITileSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-busy
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 min-h-[6rem]"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <span className="text-sm text-ink-subtle">…</span>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center space-y-3">
      <p className="text-3xl" aria-hidden>📊</p>
      <p className="text-base font-semibold text-ink">{t("budget.dashboard.emptyTitle")}</p>
      <p className="mx-auto max-w-md text-sm text-ink-muted leading-relaxed">
        {t("budget.dashboard.emptyDesc")}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
      >
        {t("budget.dashboard.emptyCta")}
      </button>
    </div>
  );
}

function formatDateCs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("cs-CZ");
  } catch {
    return iso;
  }
}
