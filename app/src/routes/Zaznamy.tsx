import { ChevronDown, Notebook, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import TaskList from "@/components/TaskList";
import SearchInput from "@/components/SearchInput";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import PhaseFilterChip from "@/components/PhaseFilterChip";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useVisibleTasks } from "@/hooks/useVisibleTasks";
import { useCategories } from "@/hooks/useCategories";
import { applySearch } from "@/lib/search";
import { filterKey } from "@/lib/storageKeys";
import {
  applyCategory,
  applyLocation,
  applyOpenClosed,
  applyPhase,
  applySort,
  clearAllFilters,
  loadCategoryFilter,
  loadFilter,
  loadLocationFilter,
  loadPhaseFilter,
  loadSort,
  saveCategoryFilter,
  saveFilter,
  saveLocationFilter,
  savePhaseFilter,
  saveSort,
  type OpenClosedFilter,
  type SortKey,
} from "@/lib/filters";

const KEY = "napady";

/**
 * V23 /zaznamy — Témata list with improved filter layout.
 *
 * Row 1: search bar
 * Row 2: open/all toggle + sort combobox
 * Row 3: expandable advanced filters (lokace, fáze, kategorie)
 */
export default function Zaznamy() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, allTasks, loading, error } = useVisibleTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));

  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [sort, setSort] = useState<SortKey>(() => loadSort(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() => loadCategoryFilter(KEY));
  const [locationId, setLocationId] = useState<string | null>(() => loadLocationFilter(KEY));
  const [phaseId, setPhaseId] = useState<string | null>(() => loadPhaseFilter(KEY));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [query, setQuery] = useState<string>(() => {
    try { return sessionStorage.getItem(filterKey("napady", "q")) ?? ""; } catch { return ""; }
  });
  function setQueryPersist(next: string) {
    setQuery(next);
    try { sessionStorage.setItem(filterKey("napady", "q"), next); } catch { /* ignore */ }
  }

  const napady = tasks.filter((tk) => tk.type === "napad");

  const counts = {
    all: napady.length,
    open: napady.filter((x) => x.status !== "Hotovo").length,
  };

  const visible = applySort(
    applySearch(
      applyPhase(
        applyLocation(
          applyCategory(applyOpenClosed(napady, filter), categoryId),
          locationId,
        ),
        phaseId,
      ),
      query,
    ),
    sort,
  );

  const advancedActive = categoryId !== null || locationId !== null || phaseId !== null;
  const isFilterActive =
    filter !== "open" || advancedActive || sort !== "updatedAt" || query.trim() !== "";

  function handleResetFilters() {
    setFilter("open");
    setSort("updatedAt");
    setCategoryId(null);
    setLocationId(null);
    setPhaseId(null);
    setQueryPersist("");
    setShowAdvanced(false);
    clearAllFilters(KEY);
  }

  return (
    <section
      aria-labelledby="zaznamy-heading"
      className="mx-auto max-w-xl px-4 pt-4 pb-4"
    >
      <header className="mb-3">
        <h2
          id="zaznamy-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("zaznamy.pageTitle")}
        </h2>
      </header>

      {/* Row 1: Search */}
      <div className="mb-3">
        <SearchInput value={query} onChange={setQueryPersist} />
      </div>

      {/* Row 3: Sort + advanced toggle + reset (right-aligned) */}
      <div className="flex items-center justify-end gap-2 mb-2">
        {/* Sort combobox */}
        <label className="relative inline-flex items-center shrink-0">
          <span
            aria-hidden
            className="inline-flex items-center gap-1 rounded-pill border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted"
          >
            {t(`sort.${sort}`)}
            <ChevronDown size={12} aria-hidden />
          </span>
          <select
            value={sort}
            onChange={(e) => { const v = e.target.value as SortKey; setSort(v); saveSort(KEY, v); }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={t("sort.ariaLabel")}
          >
            <option value="updatedAt">{t("sort.updatedAt")}</option>
            <option value="createdAt">{t("sort.createdAt")}</option>
            <option value="title">{t("sort.title")}</option>
          </select>
        </label>

        {/* Advanced filter toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          aria-label={t("filter.advancedToggle")}
          className={[
            "shrink-0 inline-flex items-center gap-1 rounded-pill border px-2.5 py-1.5 text-xs font-medium transition-colors",
            showAdvanced || advancedActive
              ? "bg-accent text-accent-on border-transparent"
              : "bg-transparent text-ink-muted border-line hover:bg-bg-subtle",
          ].join(" ")}
        >
          <SlidersHorizontal size={12} aria-hidden />
          {t("filter.advanced")}
        </button>

        {isFilterActive && (
          <button
            type="button"
            onClick={handleResetFilters}
            aria-label={t("filter.resetAriaLabel")}
            className="shrink-0 inline-flex items-center gap-1 rounded-pill border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-subtle hover:text-ink hover:border-line-strong transition-colors"
          >
            <RotateCcw aria-hidden size={11} />
          </button>
        )}
      </div>

      {/* Row 2: Open/All toggle */}
      <div className="flex items-center gap-2 mb-2">
        <div
          role="radiogroup"
          aria-label={t("filter.ariaLabel")}
          className="flex gap-1"
        >
          {(["open", "all"] as OpenClosedFilter[]).map((opt) => {
            const active = opt === filter;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => { setFilter(opt); saveFilter(KEY, opt); }}
                className={[
                  "rounded-pill px-2.5 py-1.5 text-xs font-medium transition-colors border",
                  active
                    ? "bg-accent text-accent-on border-transparent"
                    : "bg-transparent text-ink-muted border-line hover:bg-bg-subtle",
                ].join(" ")}
              >
                {t(`filter.${opt}`)}
                <span className={active ? "ml-1.5 opacity-80" : "ml-1.5 text-ink-subtle"}>
                  {(counts as Record<string, number>)[opt] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: Advanced filters (expandable) */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2 mb-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <LocationFilterChip
            value={locationId}
            onChange={(v) => { setLocationId(v); saveLocationFilter(KEY, v); }}
          />
          <PhaseFilterChip
            value={phaseId}
            onChange={(v) => { setPhaseId(v); savePhaseFilter(KEY, v); }}
          />
          <CategoryFilterChip
            value={categoryId}
            categories={categories}
            onChange={(v) => { setCategoryId(v); saveCategoryFilter(KEY, v); }}
          />
        </div>
      )}

      {/* Task list */}
      <div className="mt-4">
        <TaskList
          tasks={visible}
          allTasks={allTasks}
          categories={categories}
          loading={loading}
          error={error}
          emptyTitle={t("list.emptyTitle")}
          emptyBody={t("list.emptyBody")}
          emptyIcon={<Notebook size={22} aria-hidden />}
          ariaLabel={t("aria.napadyList")}
        />
      </div>
    </section>
  );
}
