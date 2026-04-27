import { FileText, RotateCcw } from "lucide-react";
import { useState } from "react";
import TaskList from "@/components/TaskList";
import FilterChips from "@/components/FilterChips";
import SearchInput from "@/components/SearchInput";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import { applySearch } from "@/lib/search";
import { filterKey } from "@/lib/storageKeys";
import {
  applyCategory,
  applyOpenClosed,
  clearAllFilters,
  loadCategoryFilter,
  loadFilter,
  saveCategoryFilter,
  saveFilter,
  type OpenClosedFilter,
} from "@/lib/filters";

const KEY = "dokumentace";

/**
 * V20 /dokumentace — dedicated list for dokumentace records.
 */
export default function Dokumentace() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));

  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() => loadCategoryFilter(KEY));
  const [query, setQuery] = useState<string>(() => {
    try { return sessionStorage.getItem(filterKey("dokumentace", "q")) ?? ""; } catch { return ""; }
  });
  function setQueryPersist(next: string) {
    setQuery(next);
    try { sessionStorage.setItem(filterKey("dokumentace", "q"), next); } catch { /* ignore */ }
  }

  const dokumentace = tasks.filter((tk) => tk.type === "dokumentace");

  const counts = {
    all: dokumentace.length,
    open: dokumentace.filter((x) => x.status !== "Hotovo").length,
    done: dokumentace.filter((x) => x.status === "Hotovo").length,
  };

  const visible = applySearch(
    applyCategory(applyOpenClosed(dokumentace, filter), categoryId),
    query,
  );

  const isFilterActive =
    filter !== "open" || categoryId !== null || query.trim() !== "";

  function handleResetFilters() {
    setFilter("open");
    setCategoryId(null);
    setQueryPersist("");
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

      <div className="mb-4">
        <SearchInput value={query} onChange={setQueryPersist} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          value={filter}
          onChange={(v) => {
            setFilter(v);
            saveFilter(KEY, v);
          }}
          counts={counts}
        />
        <CategoryFilterChip
          value={categoryId}
          categories={categories}
          onChange={(v) => {
            setCategoryId(v);
            saveCategoryFilter(KEY, v);
          }}
        />
        {isFilterActive && (
          <button
            type="button"
            onClick={handleResetFilters}
            aria-label={t("filter.resetAriaLabel")}
            className="inline-flex items-center gap-1 rounded-pill border border-dashed border-line px-2.5 py-1 text-xs text-ink-subtle hover:text-ink hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus transition-colors"
          >
            <RotateCcw aria-hidden size={11} />
            {t("filter.reset")}
          </button>
        )}
      </div>

      <div className="mt-3">
        <TaskList
          tasks={visible}
          categories={categories}
          loading={loading}
          error={error}
          emptyTitle={t("dokumentacePage.emptyTitle")}
          emptyBody={t("dokumentacePage.emptyBody")}
          emptyIcon={<FileText size={22} aria-hidden />}
          ariaLabel={t("dokumentacePage.ariaList")}
        />
      </div>
    </section>
  );
}
