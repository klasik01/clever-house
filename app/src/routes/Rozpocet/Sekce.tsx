import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Milestone, Plus, Search, Tag, X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useBudgetSections } from "@/hooks/useBudgetSections";
import { useAllInvoices } from "@/hooks/useAllInvoices";
import { usePhases } from "@/hooks/usePhases";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { computeSectionPaidTotal, computeSectionVariance } from "@/lib/budget/totals";
import { formatCzk } from "@/lib/budget/format";
import SectionModal from "@/components/budget/SectionModal";
import VarianceChip from "@/components/budget/VarianceChip";
import { rozpocetSekceDetail } from "@/lib/routes";
import type { BudgetSection, BudgetCategory, Phase } from "@/types";

export default function RozpocetSekce() {
  const t = useT();
  const navigate = useNavigate();
  const sectionsState = useBudgetSections();
  const invoicesState = useAllInvoices();
  const { phases } = usePhases(true);
  const categoriesState = useBudgetCategories();
  const [modalOpen, setModalOpen] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const grandTotal = useMemo(() => {
    if (sectionsState.status !== "ready" || invoicesState.status !== "ready") return 0;
    return sectionsState.sections.reduce((sum, s) => {
      const invs = invoicesState.invoicesBySectionId[s.id] ?? [];
      return sum + computeSectionPaidTotal(invs);
    }, 0);
  }, [sectionsState, invoicesState]);

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
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} />
          <FilterChips
            phases={phases}
            categories={categoriesState.status === "ready" ? categoriesState.categories : []}
            phaseFilter={phaseFilter}
            categoryFilter={categoryFilter}
            onPhaseChange={setPhaseFilter}
            onCategoryChange={setCategoryFilter}
          />

          <ul className="space-y-2">
          {sectionsState.sections
            .filter((s) => {
              if (phaseFilter && s.phaseId !== phaseFilter) return false;
              if (
                categoryFilter &&
                !(s.categoryIds ?? []).includes(categoryFilter)
              ) {
                return false;
              }
              if (
                searchQuery.trim() &&
                !s.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
              ) {
                return false;
              }
              return true;
            })
            .map((s) => {
            const invs =
              invoicesState.status === "ready"
                ? invoicesState.invoicesBySectionId[s.id] ?? []
                : [];
            const v = computeSectionVariance(s, invs);
            const phase = s.phaseId ? phases.find((p) => p.id === s.phaseId) : undefined;
            const cats =
              categoriesState.status === "ready"
                ? (s.categoryIds ?? [])
                    .map((cid) => categoriesState.categories.find((c) => c.id === cid))
                    .filter((c): c is BudgetCategory => !!c)
                : [];
            return (
              <SectionRow
                key={s.id}
                section={s}
                paidTotal={computeSectionPaidTotal(invs)}
                variance={v}
                phase={phase}
                categories={cats}
                onClick={() => navigate(rozpocetSekceDetail(s.id))}
              />
            );
          })}
          </ul>
        </>
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
  phase,
  categories,
  onClick,
}: {
  section: BudgetSection;
  paidTotal: number;
  variance: ReturnType<typeof computeSectionVariance>;
  phase?: Phase;
  categories: BudgetCategory[];
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
            {phase ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                <Milestone aria-hidden size={11} />
                {phase.label}
              </span>
            ) : null}
            {categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface px-2 py-0.5 text-xs text-ink-muted"
              >
                <Tag aria-hidden size={11} />
                {c.label}
              </span>
            ))}
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

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useT();
  return (
    <div className="relative">
      <Search
        aria-hidden
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("budget.sekce.searchPlaceholder")}
        aria-label={t("budget.sekce.searchAriaLabel")}
        className="w-full rounded-md border border-line bg-surface pl-9 pr-9 py-2 text-sm text-ink min-h-tap focus:border-accent focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("budget.sekce.searchClear")}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
        >
          <X aria-hidden size={14} />
        </button>
      ) : null}
    </div>
  );
}

function FilterChips({
  phases,
  categories,
  phaseFilter,
  categoryFilter,
  onPhaseChange,
  onCategoryChange,
}: {
  phases: Phase[];
  categories: BudgetCategory[];
  phaseFilter: string | null;
  categoryFilter: string | null;
  onPhaseChange: (id: string | null) => void;
  onCategoryChange: (id: string | null) => void;
}) {
  const t = useT();
  if (phases.length === 0 && categories.length === 0) return null;
  return (
    <div className="space-y-2">
      {phases.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-subtle">{t("budget.sekce.filterPhaseLabel")}:</span>
          <FilterPill
            active={phaseFilter === null}
            onClick={() => onPhaseChange(null)}
          >
            {t("budget.sekce.filterAll")}
          </FilterPill>
          {phases.map((p) => (
            <FilterPill
              key={p.id}
              active={phaseFilter === p.id}
              onClick={() => onPhaseChange(p.id)}
            >
              {p.label}
            </FilterPill>
          ))}
        </div>
      ) : null}
      {categories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-subtle">{t("budget.sekce.filterCategoryLabel")}:</span>
          <FilterPill
            active={categoryFilter === null}
            onClick={() => onCategoryChange(null)}
          >
            {t("budget.sekce.filterAll")}
          </FilterPill>
          {categories.map((c) => (
            <FilterPill
              key={c.id}
              active={categoryFilter === c.id}
              onClick={() => onCategoryChange(c.id)}
            >
              {c.label}
            </FilterPill>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-pill border px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-accent-on"
          : "border-line bg-surface text-ink-muted hover:bg-bg-subtle",
      ].join(" ")}
    >
      {children}
    </button>
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
