import { ChevronDown, FileText, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import TaskList from "@/components/TaskList";
import SearchInput from "@/components/SearchInput";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useVisibleTasks } from "@/hooks/useVisibleTasks";
import { useCategories } from "@/hooks/useCategories";
import { applySearch } from "@/lib/search";
import { filterKey } from "@/lib/storageKeys";
import {
  applyCategory,
  applyLocation,
  applySort,
  clearAllFilters,
  loadCategoryFilter,
  loadLocationFilter,
  loadSort,
  saveCategoryFilter,
  saveLocationFilter,
  saveSort,
  type SortKey,
} from "@/lib/filters";

const KEY = "dokumentace";

/**
 * V23 /dokumentace — dedicated list for dokumentace records.
 * Sort + expandable advanced filters (category, location).
 */
export default function Dokumentace() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const isCm =
    roleState.status === "ready"
    && roleState.profile.role === "CONSTRUCTION_MANAGER";
  const { tasks, loading, error } = useVisibleTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));

  const [sort, setSort] = useState<SortKey>(() => loadSort(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() => loadCategoryFilter(KEY));
  const [locationId, setLocationId] = useState<string | null>(() => loadLocationFilter(KEY));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [query, setQuery] = useState<string>(() => {
    try { return sessionStorage.getItem(filterKey("dokumentace", "q")) ?? ""; } catch { return ""; }
  });
  function setQueryPersist(next: string) {
    setQuery(next);
    try { sessionStorage.setItem(filterKey("dokumentace", "q"), next); } catch { /* ignore */ }
  }

  const dokumentace = tasks.filter((tk) => tk.type === "dokumentace");

  const visible = applySort(
    applySearch(
      applyLocation(
        applyCategory(dokumentace, categoryId),
        locationId,
      ),
      query,
    ),
    sort,
  );

  const advancedActive = categoryId !== null || locationId !== null;
  const isFilterActive = advancedActive || sort !== "updatedAt" || query.trim() !== "";

  function handleResetFilters() {
    setSort("updatedAt");
    setCategoryId(null);
    setLocationId(null);
    setQueryPersist("");
    setShowAdvanced(false);
    clearAllFilters(KEY);
  }

  return (
    <section
      aria-labelledby="dokumentace-heading"
      className="mx-auto max-w-xl px-4 pt-4 pb-4"
    >
      <header className="mb-3">
        <h2
          id="dokumentace-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("dokumentacePage.pageTitle")}
        </h2>
      </header>

      {/* Row 1: Search */}
      <div className="mb-3">
        <SearchInput value={query} onChange={setQueryPersist} />
      </div>

      {/* Row 2: Sort + advanced toggle + reset (right-aligned) */}
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

      {/* Row 3: Advanced filters (expandable) */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <CategoryFilterChip
            value={categoryId}
            categories={categories}
            onChange={(v) => { setCategoryId(v); saveCategoryFilter(KEY, v); }}
          />
          <LocationFilterChip
            value={locationId}
            onChange={(v) => { setLocationId(v); saveLocationFilter(KEY, v); }}
          />
        </div>
      )}

      {/* Task list */}
      <div className="mt-4">
        <TaskList
          tasks={visible}
          categories={categories}
          loading={loading}
          error={error}
          emptyTitle={t(
            isCm ? "dokumentacePage.emptyTitleCm" : "dokumentacePage.emptyTitle",
          )}
          emptyBody={t(
            isCm ? "dokumentacePage.emptyBodyCm" : "dokumentacePage.emptyBody",
          )}
          emptyIcon={<FileText size={22} aria-hidden />}
          ariaLabel={t("dokumentacePage.ariaList")}
        />
      </div>
    </section>
  );
}
