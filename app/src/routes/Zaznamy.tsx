import { AlertTriangle, HelpCircle, Notebook, RotateCcw } from "lucide-react";
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
  clearAllFilters,
  loadCategoryFilter,
  loadFilter,
  loadLocationFilter,
  saveCategoryFilter,
  saveFilter,
  saveLocationFilter,
  type OpenClosedFilter,
} from "@/lib/filters";
import type { TaskType } from "@/types";

/**
 * V3.1 /zaznamy — merged Nápady + Otázky list with internal type toggle.
 * URL state:
 *   ?type=napad|otazka   — which list we show (default napad)
 *   ?group=lokace|kategorie|flat  — group-by
 * Filter chips (status / category / location) persisted in sessionStorage
 * per-type (separate KEY for each to avoid cross-contamination).
 */
export default function Zaznamy() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const [searchParams, setSearchParams] = useSearchParams();

  const type: TaskType = (searchParams.get("type") as TaskType | null) ?? "napad";
  const groupBy: GroupBy = (searchParams.get("group") as GroupBy | null) ?? "flat";

  // Per-type filter storage keys so toggle between type doesn't leak state.
  const KEY = type === "otazka" ? "otazky" : "napady";
  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() => loadCategoryFilter(KEY));
  const [locationId, setLocationId] = useState<string | null>(() => loadLocationFilter(KEY));

  function setType(next: TaskType) {
    const np = new URLSearchParams(searchParams);
    np.set("type", next);
    setSearchParams(np, { replace: true });
    // Reload persisted filters for new type
    const nextKey = next === "otazka" ? "otazky" : "napady";
    setFilter(loadFilter(nextKey));
    setCategoryId(loadCategoryFilter(nextKey));
    setLocationId(loadLocationFilter(nextKey));
  }

  function setGroupBy(next: GroupBy) {
    const np = new URLSearchParams(searchParams);
    if (next === "flat") np.delete("group");
    else np.set("group", next);
    setSearchParams(np, { replace: true });
  }

  const typed = tasks.filter((tk) => tk.type === type);
  const counts = {
    all: typed.length,
    open: typed.filter((x) => x.status !== "Hotovo").length,
    done: typed.filter((x) => x.status === "Hotovo").length,
  };
  const visible = applyLocation(
    applyCategory(applyOpenClosed(typed, filter), categoryId),
    locationId
  );

  const isFilterActive = filter !== "open" || categoryId !== null || locationId !== null;
  function handleResetFilters() {
    setFilter("open");
    setCategoryId(null);
    setLocationId(null);
    clearAllFilters(KEY);
  }

  // Uvízlé pill only meaningful for otázky.
  const stuckCount =
    type === "otazka" ? computePrehledGroups(tasks, user?.uid ?? "").stuck.length : 0;

  const emptyCopy = type === "otazka"
    ? { title: t("otazky.emptyTitle"), body: t("otazky.emptyBody"), icon: <HelpCircle size={22} aria-hidden /> }
    : { title: t("list.emptyTitle"), body: t("list.emptyBody"), icon: <Notebook size={22} aria-hidden /> };

  return (
    <section aria-labelledby="zaznamy-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id="zaznamy-heading" className="text-xl font-semibold tracking-tight text-ink">
          {t("zaznamy.pageTitle")}
        </h2>
        {type === "otazka" && stuckCount > 0 && (
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

      {/* Type toggle — Nápady / Otázky */}
      <div
        role="tablist"
        aria-label={t("zaznamy.typeToggleLabel")}
        className="mb-3 flex items-center gap-1 rounded-md border border-line bg-bg-subtle p-1"
      >
        <TypeTab
          active={type === "napad"}
          onClick={() => setType("napad")}
          icon={<Notebook aria-hidden size={16} />}
          label={t("tabs.napady")}
        />
        <TypeTab
          active={type === "otazka"}
          onClick={() => setType("otazka")}
          icon={<HelpCircle aria-hidden size={16} />}
          label={t("tabs.questions")}
        />
      </div>

      {/* Group-by tabs */}
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
          ariaLabelBase={type === "otazka" ? t("aria.otazkyList") : t("aria.napadyList")}
          emptyTitle={emptyCopy.title}
          emptyBody={emptyCopy.body}
          emptyIcon={emptyCopy.icon}
        />
      </div>
    </section>
  );
}

function TypeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "inline-flex flex-1 items-center justify-center gap-2 min-h-tap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
        active
          ? "bg-surface text-ink shadow-sm ring-1 ring-line"
          : "text-ink-subtle hover:text-ink",
      ].join(" ")}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
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
        "inline-flex flex-1 items-center justify-center gap-2 min-h-tap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
        active
          ? "bg-surface text-ink shadow-sm ring-1 ring-line"
          : "text-ink-subtle hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
