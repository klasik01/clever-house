import { Notebook, RotateCcw } from "lucide-react";
import { useState } from "react";
import TaskList from "@/components/TaskList";
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

/**
 * V6.1 /zaznamy — Nápady-only, flat list.
 *
 * Group-by (Plochý/Lokace/Kategorie) was removed in V6.1 — filters alone are
 * sufficient and the toggle was noise. Visibility:
 *   - OWNER sees own napady (all statuses; filters control what's shown).
 *   - PM sees napady the owner explicitly shared (`sharedWithPm: true`).
 */
export default function Zaznamy() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));

  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() => loadCategoryFilter(KEY));
  const [locationId, setLocationId] = useState<string | null>(() => loadLocationFilter(KEY));

  const napady = tasks.filter((tk) => {
    if (tk.type !== "napad") return false;
    // OWNER-created: always visible for OWNER; for PM only if shared.
    // The backing useTasks hook already filters by Firestore rules, so this
    // client-side check primarily guards OWNER-side against glimpsing a
    // transiently-unshared record (belt + suspenders).
    if (tk.createdBy !== user?.uid && !tk.sharedWithPm) return false;
    return true;
  });

  const counts = {
    all: napady.length,
    open: napady.filter((x) => x.status !== "Hotovo").length,
    done: napady.filter((x) => x.status === "Hotovo").length,
  };

  const visible = applyLocation(
    applyCategory(applyOpenClosed(napady, filter), categoryId),
    locationId,
  );

  const isFilterActive =
    filter !== "open" || categoryId !== null || locationId !== null;

  function handleResetFilters() {
    setFilter("open");
    setCategoryId(null);
    setLocationId(null);
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
