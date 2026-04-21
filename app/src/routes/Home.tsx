import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lightbulb, RotateCcw } from "lucide-react";
import TaskGroupedView, { type GroupBy } from "@/components/TaskGroupedView";
import FilterChips from "@/components/FilterChips";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import {
  applyCategory,
  applyLocation,
  applyOpenClosed,
  loadCategoryFilter,
  loadFilter,
  loadLocationFilter,
  saveCategoryFilter,
  saveFilter,
  saveLocationFilter,
  clearAllFilters,
  type OpenClosedFilter,
} from "@/lib/filters";

const KEY = "napady";

export default function Home() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    loadCategoryFilter(KEY)
  );
  const [locationId, setLocationId] = useState<string | null>(() =>
    loadLocationFilter(KEY)
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const groupBy: GroupBy = (searchParams.get("group") as GroupBy | null) ?? "flat";
  function setGroupBy(next: GroupBy) {
    const np = new URLSearchParams(searchParams);
    if (next === "flat") np.delete("group");
    else np.set("group", next);
    setSearchParams(np, { replace: true });
  }

  function changeFilter(next: OpenClosedFilter) {
    setFilter(next);
    saveFilter(KEY, next);
  }
  function changeCategory(next: string | null) {
    setCategoryId(next);
    saveCategoryFilter(KEY, next);
  }
  function changeLocation(next: string | null) {
    setLocationId(next);
    saveLocationFilter(KEY, next);
  }

  const isFilterActive = filter !== "open" || categoryId !== null || locationId !== null;
  function handleResetFilters() {
    setFilter("open");
    setCategoryId(null);
    setLocationId(null);
    clearAllFilters(KEY);
  }

  const napady = tasks.filter((tk) => tk.type === "napad");
  const counts = {
    all: napady.length,
    open: napady.filter((x) => x.status !== "Hotovo").length,
    done: napady.filter((x) => x.status === "Hotovo").length,
  };
  const visible = applyLocation(
    applyCategory(applyOpenClosed(napady, filter), categoryId),
    locationId
  );

  return (
    <>
      <section aria-label={t("aria.napadyList")} className="mx-auto max-w-xl px-4 pt-2 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips value={filter} onChange={changeFilter} counts={counts} />
          <CategoryFilterChip
            value={categoryId}
            categories={categories}
            onChange={changeCategory}
          />
          <LocationFilterChip value={locationId} onChange={changeLocation} />
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

        <div
          role="tablist"
          aria-label={t("otazky.groupByLabel")}
          className="mt-3 mb-3 flex items-center gap-1 rounded-md border border-line bg-bg-subtle p-1"
        >
          <HomeGroupTab active={groupBy === "flat"} onClick={() => setGroupBy("flat")} label={t("otazky.groupFlat")} />
          <HomeGroupTab active={groupBy === "lokace"} onClick={() => setGroupBy("lokace")} label={t("otazky.groupLokace")} />
          <HomeGroupTab active={groupBy === "kategorie"} onClick={() => setGroupBy("kategorie")} label={t("otazky.groupKategorie")} />
        </div>

        <div className="mt-3">
          <TaskGroupedView
            tasks={visible}
            categories={categories}
            groupBy={groupBy}
            loading={loading}
            error={error}
            ariaLabelBase={t("aria.napadyList")}
            emptyTitle={t("list.emptyTitle")}
            emptyBody={t("list.emptyBody")}
            emptyIcon={<Lightbulb size={22} aria-hidden />}
          />
        </div>
      </section>
    </>
  );
}


function HomeGroupTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "inline-flex flex-1 items-center justify-center gap-2 min-h-tap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-surface text-ink shadow-sm ring-1 ring-line"
          : "text-ink-subtle hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
