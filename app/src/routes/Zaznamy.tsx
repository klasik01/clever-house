import { FileText, Notebook, RotateCcw } from "lucide-react";
import { useState } from "react";
import TaskList from "@/components/TaskList";
import FilterChips from "@/components/FilterChips";
import SearchInput from "@/components/SearchInput";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import { applySearch } from "@/lib/search";
import { filterKey } from "@/lib/storageKeys";
import {
  applyCategory,
  applyLocation,
  applyOpenClosed,
  clearAllFilters,
  loadCategoryFilter,
  loadFilter,
  loadLocationFilter,
  saveCategoryFilter,
  saveFilter,
  saveLocationFilter,
  type OpenClosedFilter,
} from "@/lib/filters";

const KEY = "napady";

type TypeFilter = "all" | "napad" | "dokumentace";

/**
 * V6.1 /zaznamy — Nápady + Dokumentace, flat list.
 *
 * V20 — type filter chip to toggle between nápady and dokumentace.
 */
export default function Zaznamy() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));

  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryId, setCategoryId] = useState<string | null>(() => loadCategoryFilter(KEY));
  const [locationId, setLocationId] = useState<string | null>(() => loadLocationFilter(KEY));
  const [query, setQuery] = useState<string>(() => {
    try { return sessionStorage.getItem(filterKey("napady", "q")) ?? ""; } catch { return ""; }
  });
  function setQueryPersist(next: string) {
    setQuery(next);
    try { sessionStorage.setItem(filterKey("napady", "q"), next); } catch { /* ignore */ }
  }

  // V20: include both napad and dokumentace
  const zaznamy = tasks.filter((tk) => {
    if (tk.type !== "napad" && tk.type !== "dokumentace") return false;
    if (typeFilter === "napad") return tk.type === "napad";
    if (typeFilter === "dokumentace") return tk.type === "dokumentace";
    return true;
  });

  const counts = {
    all: zaznamy.length,
    open: zaznamy.filter((x) => x.status !== "Hotovo").length,
    done: zaznamy.filter((x) => x.status === "Hotovo").length,
  };

  const visible = applySearch(
    applyLocation(
      applyCategory(applyOpenClosed(zaznamy, filter), categoryId),
      locationId,
    ),
    query,
  );

  const isFilterActive =
    filter !== "open" || typeFilter !== "all" || categoryId !== null || locationId !== null || query.trim() !== "";

  function handleResetFilters() {
    setFilter("open");
    setTypeFilter("all");
    setCategoryId(null);
    setLocationId(null);
    setQueryPersist("");
    clearAllFilters(KEY);
  }

  // Type counts for chips
  const napadCount = tasks.filter((tk) => tk.type === "napad").length;
  const dokCount = tasks.filter((tk) => tk.type === "dokumentace").length;

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

      <div className="mb-4">
        <SearchInput value={query} onChange={setQueryPersist} />
      </div>

      {/* Type filter chips */}
      <div className="mb-2 flex gap-1.5">
        {([
          { key: "all" as TypeFilter, label: t("zaznamy.typeAll"), count: napadCount + dokCount },
          { key: "napad" as TypeFilter, label: t("zaznamy.typeNapad"), count: napadCount },
          { key: "dokumentace" as TypeFilter, label: t("zaznamy.typeDokumentace"), count: dokCount },
        ]).map(({ key, label, count }) => {
          const active = typeFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={
                active
                  ? "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold bg-accent text-accent-on"
                  : "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium bg-bg-subtle text-ink-muted hover:bg-bg-muted transition-colors"
              }
            >
              {key === "dokumentace" && <FileText aria-hidden size={12} />}
              {key === "napad" && <Notebook aria-hidden size={12} />}
              {label}
              <span className="opacity-60">{count}</span>
            </button>
          );
        })}
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
        <LocationFilterChip
          value={locationId}
          onChange={(v) => {
            setLocationId(v);
            saveLocationFilter(KEY, v);
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
          emptyTitle={t("list.emptyTitle")}
          emptyBody={t("list.emptyBody")}
          emptyIcon={<Notebook size={22} aria-hidden />}
          ariaLabel={t("aria.napadyList")}
        />
      </div>
    </section>
  );
}
