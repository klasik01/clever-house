import { AlertTriangle, HelpCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import TaskGroupedView, { type GroupBy } from "@/components/TaskGroupedView";
import FilterChips from "@/components/FilterChips";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import { computePrehledGroups } from "@/lib/prehled";
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

const KEY = "otazky";

export default function Otazky() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() => loadCategoryFilter(KEY));
  const [locationId, setLocationId] = useState<string | null>(() => loadLocationFilter(KEY));

  const [searchParams, setSearchParams] = useSearchParams();
  const groupBy: GroupBy = (searchParams.get("group") as GroupBy | null) ?? "flat";

  function setGroupBy(next: GroupBy) {
    const np = new URLSearchParams(searchParams);
    if (next === "flat") np.delete("group");
    else np.set("group", next);
    setSearchParams(np, { replace: true });
  }

  const otazky = tasks.filter((tk) => tk.type === "otazka");
  const counts = {
    all: otazky.length,
    open: otazky.filter((x) => x.status !== "Hotovo").length,
    done: otazky.filter((x) => x.status === "Hotovo").length,
  };
  const visible = applyLocation(
    applyCategory(applyOpenClosed(otazky, filter), categoryId),
    locationId
  );
  const stuckCount = computePrehledGroups(tasks, user?.uid ?? "").stuck.length;

  const isFilterActive = filter !== "open" || categoryId !== null || locationId !== null;
  function handleResetFilters() {
    setFilter("open");
    setCategoryId(null);
    setLocationId(null);
    clearAllFilters(KEY);
  }

  return (
    <section aria-labelledby="otazky-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id="otazky-heading" className="text-xl font-semibold tracking-tight text-ink">
          {t("otazky.pageTitle")}
        </h2>
        {stuckCount > 0 && (
          <Link
            to="/prehled?filter=stuck"
            aria-label={t("otazky.stuckPillAria", { n: stuckCount })}
            className="inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            style={{
              background: "var(--color-prehled-m2-bad-bg)",
              color: "var(--color-prehled-m2-bad-fg)",
              borderColor: "var(--color-deadline-overdue-border)",
            }}
          >
            <AlertTriangle aria-hidden size={12} />
            {t("otazky.stuckPill", { n: stuckCount })}
          </Link>
        )}
      </header>

      <div
        role="tablist"
        aria-label={t("otazky.groupByLabel")}
        className="mb-3 flex items-center gap-1 rounded-md border border-line bg-bg-subtle p-1"
      >
        <GroupTab active={groupBy === "flat"} onClick={() => setGroupBy("flat")} label={t("otazky.groupFlat")} />
        <GroupTab active={groupBy === "lokace"} onClick={() => setGroupBy("lokace")} label={t("otazky.groupLokace")} />
        <GroupTab active={groupBy === "kategorie"} onClick={() => setGroupBy("kategorie")} label={t("otazky.groupKategorie")} />
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
        <TaskGroupedView
          tasks={visible}
          categories={categories}
          groupBy={groupBy}
          loading={loading}
          error={error}
          ariaLabelBase={t("aria.otazkyList")}
          emptyTitle={t("otazky.emptyTitle")}
          emptyBody={t("otazky.emptyBody")}
          emptyIcon={<HelpCircle size={22} aria-hidden />}
        />
      </div>
    </section>
  );
}

function GroupTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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
