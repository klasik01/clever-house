import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { useBudgetSections } from "@/hooks/useBudgetSections";
import { useAllInvoices } from "@/hooks/useAllInvoices";
import { computeDashboardKpis } from "@/lib/budget/totals";
import { formatCzk } from "@/lib/budget/format";
import KPITile from "@/components/budget/KPITile";
import { rozpocetSekce } from "@/lib/routes";

export default function RozpocetDashboard() {
  const t = useT();
  const navigate = useNavigate();
  const sectionsState = useBudgetSections();
  const invoicesState = useAllInvoices();

  const kpis = useMemo(() => {
    if (invoicesState.status !== "ready") {
      return { paidTotalCzk: 0, openTotalCzk: 0 };
    }
    return computeDashboardKpis(invoicesState.invoicesBySectionId);
  }, [invoicesState]);

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
          <div className="grid grid-cols-1 gap-3">
            <KPITile
              label={t("budget.dashboard.kpiPaidLabel")}
              value={formatCzk(kpis.paidTotalCzk)}
              subText={
                kpis.openTotalCzk > 0
                  ? t("budget.dashboard.kpiPaidSub", {
                      open: formatCzk(kpis.openTotalCzk),
                    })
                  : undefined
              }
              onClick={() => navigate(rozpocetSekce())}
            />
          </div>

          <div className="rounded-md border border-status-info-border bg-status-info-bg px-4 py-3 text-sm text-status-info-fg">
            <p className="font-semibold">{t("budget.dashboard.upcomingTitle")}</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 leading-relaxed">
              <li>{t("budget.dashboard.upcomingS05")}</li>
              <li>{t("budget.dashboard.upcomingS06")}</li>
              <li>{t("budget.dashboard.upcomingS07")}</li>
              <li>{t("budget.dashboard.upcomingS08")}</li>
            </ul>
          </div>
        </>
      )}
    </section>
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
