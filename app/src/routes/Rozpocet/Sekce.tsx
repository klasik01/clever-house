import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useBudgetSections } from "@/hooks/useBudgetSections";
import { useAllInvoices } from "@/hooks/useAllInvoices";
import { useAllPayments } from "@/hooks/useAllPayments";
import { computeSectionPaidTotal, computeSectionVariance } from "@/lib/budget/totals";
import { formatCzk } from "@/lib/budget/format";
import SectionModal from "@/components/budget/SectionModal";
import VarianceChip from "@/components/budget/VarianceChip";
import { rozpocetSekceDetail } from "@/lib/routes";
import type { BudgetSection } from "@/types";

export default function RozpocetSekce() {
  const t = useT();
  const navigate = useNavigate();
  const sectionsState = useBudgetSections();
  const invoicesState = useAllInvoices();
  const paymentsState = useAllPayments();
  const [modalOpen, setModalOpen] = useState(false);

  const grandTotal = useMemo(() => {
    if (sectionsState.status !== "ready" || invoicesState.status !== "ready") return 0;
    const paymentsBy =
      paymentsState.status === "ready" ? paymentsState.paymentsBySectionId : {};
    return sectionsState.sections.reduce((sum, s) => {
      const invs = invoicesState.invoicesBySectionId[s.id] ?? [];
      const pays = paymentsBy[s.id] ?? [];
      return sum + computeSectionPaidTotal(invs, pays);
    }, 0);
  }, [sectionsState, invoicesState, paymentsState]);

  return (
    <section
      aria-labelledby="rozpocet-sekce-heading"
      className="mx-auto max-w-xl space-y-4 px-4 py-6"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="rozpocet-sekce-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("budget.sekce.title")}
        </h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          <Plus aria-hidden size={16} />
          {t("budget.sekce.addCta")}
        </button>
      </header>

      {sectionsState.status === "loading" || invoicesState.status === "loading" ? (
        <p aria-busy className="text-sm text-ink-muted">
          {t("budget.sekce.loading")}
        </p>
      ) : sectionsState.status === "error" ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {t("budget.sekce.errorLoad")}
        </p>
      ) : sectionsState.sections.length === 0 ? (
        <EmptyState onCreate={() => setModalOpen(true)} />
      ) : (
        <ul className="space-y-2">
          {sectionsState.sections.map((s) => {
            const invs =
              invoicesState.status === "ready"
                ? invoicesState.invoicesBySectionId[s.id] ?? []
                : [];
            const pays =
              paymentsState.status === "ready"
                ? paymentsState.paymentsBySectionId[s.id] ?? []
                : [];
            const v = computeSectionVariance(s, invs, pays);
            return (
              <SectionRow
                key={s.id}
                section={s}
                paidTotal={computeSectionPaidTotal(invs, pays)}
                variance={v}
                onClick={() => navigate(rozpocetSekceDetail(s.id))}
              />
            );
          })}
        </ul>
      )}

      {sectionsState.status === "ready" && sectionsState.sections.length > 0 ? (
        <footer className="sticky bottom-[calc(var(--tap-target-min)+0.5rem)] mt-4 rounded-md border border-line bg-surface-raised px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-muted">
              {t("budget.sekce.totalLabel")}
            </span>
            <span className="text-base font-semibold text-ink tabular-nums">
              {formatCzk(grandTotal)}
            </span>
          </div>
        </footer>
      ) : null}

      <SectionModal
        open={modalOpen}
        mode="create"
        onClose={() => setModalOpen(false)}
        onSaved={(id) => navigate(rozpocetSekceDetail(id))}
      />
    </section>
  );
}

function SectionRow({
  section,
  paidTotal,
  variance,
  onClick,
}: {
  section: BudgetSection;
  paidTotal: number;
  variance: ReturnType<typeof computeSectionVariance>;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full min-h-tap rounded-md border border-line bg-surface px-4 py-3 text-left hover:bg-bg-subtle transition-colors flex items-center justify-between gap-3"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block truncate text-base font-semibold text-ink">
            {section.title}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {variance.plannedCzk !== null ? (
              <span className="text-xs text-ink-muted tabular-nums">
                {t("budget.sekce.planLabel")}: {formatCzk(variance.plannedCzk)}
              </span>
            ) : null}
            <VarianceChip
              state={variance.state}
              variance={variance.variance}
              variancePercent={variance.variancePercent}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-base font-semibold text-ink tabular-nums">
            {formatCzk(paidTotal)}
          </span>
          <span className="text-xs text-ink-muted">{t("budget.sekce.paidLabel")}</span>
        </div>
      </button>
    </li>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center space-y-3">
      <p className="text-3xl" aria-hidden>🗂️</p>
      <p className="text-base font-semibold text-ink">{t("budget.sekce.emptyTitle")}</p>
      <p className="mx-auto max-w-md text-sm text-ink-muted leading-relaxed">
        {t("budget.sekce.emptyDesc")}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
      >
        <Plus aria-hidden size={16} />
        {t("budget.sekce.addCta")}
      </button>
    </div>
  );
}
