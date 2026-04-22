import { useState } from "react";
import { RotateCcw } from "lucide-react";
import TaskList from "@/components/TaskList";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import PriorityFilterChip from "@/components/PriorityFilterChip";
import StatusFilterChip from "@/components/StatusFilterChip";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import {
  applyCategory,
  applyLocation,
  clearAllFilters,
  loadCategoryFilter,
  loadLocationFilter,
  saveCategoryFilter,
  saveLocationFilter,
} from "@/lib/filters";
import { isBallOnMe as isBallOnMeV10, mapLegacyOtazkaStatus } from "@/lib/status";
import type { Task, TaskPriority, TaskStatus } from "@/types";

const KEY = "ukoly";

/**
 * V6 — /ukoly. Dedicated tab for otázky.
 *
 * Filters: Priority, Status (V5 canonical), Category, Location.
 * Order: ball-on-me items first (highlighted via NapadCard border-l-4),
 *        then everyone else by updatedAt DESC.
 */
export default function Ukoly() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));

  // Filters — category + location persist (reuse existing session helpers).
  // Priority + status are transient (not worth another storage key for now).
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    loadCategoryFilter(KEY)
  );
  const [locationId, setLocationId] = useState<string | null>(() =>
    loadLocationFilter(KEY)
  );
  const [priority, setPriority] = useState<TaskPriority | null>(null);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  // V10 — "Moje / Všechny" filter. Defaults to "mine" so the tab feels like
  // a personal inbox; user can flip to "all" for cross-workspace view.
  const [ownerMode, setOwnerMode] = useState<"mine" | "all">(() => {
    try {
      const v = sessionStorage.getItem("filter:ukoly:owner");
      return v === "all" ? "all" : "mine";
    } catch {
      return "mine";
    }
  });
  function setOwnerModePersist(next: "mine" | "all") {
    setOwnerMode(next);
    try { sessionStorage.setItem("filter:ukoly:owner", next); } catch { /* ignore */ }
  }

  const isFilterActive =
    categoryId !== null ||
    locationId !== null ||
    priority !== null ||
    status !== null ||
    ownerMode !== "mine";

  function handleReset() {
    setCategoryId(null);
    setLocationId(null);
    setPriority(null);
    setStatus(null);
    setOwnerModePersist("mine");
    clearAllFilters(KEY);
  }

  // 1. Narrow to otázky, optionally constrained to "mine" (assigned to me
  //    or — for legacy records without assigneeUid — created by me).
  const otazky = tasks.filter((tk) => {
    if (tk.type !== "otazka") return false;
    if (ownerMode === "mine") {
      const assigned = tk.assigneeUid ?? tk.createdBy;
      return assigned === user?.uid;
    }
    return true;
  });

  // 2. Apply status (V5 canonical; legacy Otázka/Čekám mapped on the fly).
  const byStatus = status
    ? otazky.filter((tk) => mapLegacyOtazkaStatus(tk.status) === status)
    : otazky;

  // 3. Apply priority.
  const byPriority = priority
    ? byStatus.filter((tk) => tk.priority === priority)
    : byStatus;

  // 4. Category + location use the shared helpers.
  const filtered = applyLocation(applyCategory(byPriority, categoryId), locationId);

  // 5. Split into ball-on-me + rest; sort each by updatedAt DESC. Concat with
  //    ball-on-me first so NapadCard’s highlight lines up with list position.
  const ballOnMe: Task[] = [];
  const rest: Task[] = [];
  for (const tk of filtered) {
    if (isBallOnMeV10(tk, user?.uid)) ballOnMe.push(tk);
    else rest.push(tk);
  }
  const byUpdated = (a: Task, b: Task) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  ballOnMe.sort(byUpdated);
  rest.sort(byUpdated);
  const visible = [...ballOnMe, ...rest];

  return (
    <section
      aria-labelledby="ukoly-heading"
      className="mx-auto max-w-xl px-4 pt-4 pb-4"
    >
      <header className="mb-3">
        <h2
          id="ukoly-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("ukoly.pageTitle")}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{t("ukoly.pageHint")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <OwnerModeChip value={ownerMode} onChange={setOwnerModePersist} />
        <StatusFilterChip value={status} onChange={setStatus} />
        <PriorityFilterChip value={priority} onChange={setPriority} />
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
            onClick={handleReset}
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
          emptyTitle={t("ukoly.emptyTitle")}
          emptyBody={t("ukoly.emptyBody")}
          ariaLabel={t("ukoly.pageTitle")}
        />
      </div>
    </section>
  );
}

/**
 * V10 — tiny pill toggle. "Moje" = my úkoly (assignee me); "Všechny" = full
 * workspace list (useful when coordinating with wife / PM).
 */
function OwnerModeChip({
  value,
  onChange,
}: {
  value: "mine" | "all";
  onChange: (next: "mine" | "all") => void;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("ukoly.filterOwnerAria")} className="inline-flex rounded-pill border border-line overflow-hidden">
      <button
        type="button"
        role="radio"
        aria-checked={value === "mine"}
        onClick={() => onChange("mine")}
        className={[
          "min-h-tap px-3 py-1.5 text-sm font-medium",
          value === "mine"
            ? "bg-accent text-accent-on"
            : "bg-transparent text-ink-muted hover:text-ink",
        ].join(" ")}
      >
        {t("ukoly.ownerMine")}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "all"}
        onClick={() => onChange("all")}
        className={[
          "min-h-tap px-3 py-1.5 text-sm font-medium border-l border-line",
          value === "all"
            ? "bg-accent text-accent-on"
            : "bg-transparent text-ink-muted hover:text-ink",
        ].join(" ")}
      >
        {t("ukoly.ownerAll")}
      </button>
    </div>
  );
}
