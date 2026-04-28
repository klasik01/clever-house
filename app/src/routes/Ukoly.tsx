import { useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import TaskList from "@/components/TaskList";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import PriorityFilterChip from "@/components/PriorityFilterChip";
import StatusFilterChip from "@/components/StatusFilterChip";
import SearchInput from "@/components/SearchInput";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useVisibleTasks } from "@/hooks/useVisibleTasks";
import { useCategories } from "@/hooks/useCategories";
import { applySearch } from "@/lib/search";
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
import { isBallOnMe as isBallOnMeV10, mapLegacyOtazkaStatus } from "@/lib/status";
import type { Task, TaskPriority, TaskStatus } from "@/types";
import { filterKey } from "@/lib/storageKeys";

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
  const { tasks, loading, error } = useVisibleTasks(Boolean(user));
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
  const [query, setQuery] = useState<string>(() => {
    try { return sessionStorage.getItem(filterKey("ukoly", "q")) ?? ""; } catch { return ""; }
  });
  function setQueryPersist(next: string) {
    setQuery(next);
    try { sessionStorage.setItem(filterKey("ukoly", "q"), next); } catch { /* ignore */ }
  }
  const [sort, setSort] = useState<SortKey>(() => loadSort(KEY));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // V14.9 — default view hides closed tasks (DONE + CANCELED). User can
  // flip to "Vše" to include them. This is the pill that most filters the
  // list in practice, so it goes first in the chip row.
  type StateMode = "active" | "all";
  const [stateMode, setStateMode] = useState<StateMode>(() => {
    try {
      const v = sessionStorage.getItem(filterKey("ukoly", "state"));
      return v === "all" ? "all" : "active";
    } catch {
      return "active";
    }
  });
  function setStateModePersist(next: StateMode) {
    setStateMode(next);
    try { sessionStorage.setItem(filterKey("ukoly", "state"), next); } catch { /* ignore */ }
  }
  // V14 — "Otázky / Úkoly / Vše" type pill. Default "all" so both types are
  // visible on first load; user can narrow via pill.
  type TypeMode = "otazka" | "ukol" | "all";
  const [typeMode, setTypeMode] = useState<TypeMode>(() => {
    try {
      const v = sessionStorage.getItem(filterKey("ukoly", "type"));
      if (v === "otazka" || v === "ukol" || v === "all") return v;
      return "all";
    } catch {
      return "all";
    }
  });
  function setTypeModePersist(next: TypeMode) {
    setTypeMode(next);
    try { sessionStorage.setItem(filterKey("ukoly", "type"), next); } catch { /* ignore */ }
  }
  // V10 — "Moje / Všechny" filter. Defaults to "mine" so the tab feels like
  // a personal inbox; user can flip to "all" for cross-workspace view.
  const [ownerMode, setOwnerMode] = useState<"mine" | "all">(() => {
    try {
      const v = sessionStorage.getItem(filterKey("ukoly", "owner"));
      return v === "all" ? "all" : "mine";
    } catch {
      return "mine";
    }
  });
  function setOwnerModePersist(next: "mine" | "all") {
    setOwnerMode(next);
    try { sessionStorage.setItem(filterKey("ukoly", "owner"), next); } catch { /* ignore */ }
  }

  const advancedActive =
    status !== null || priority !== null || categoryId !== null ||
    locationId !== null || stateMode !== "active";

  const isFilterActive =
    categoryId !== null ||
    locationId !== null ||
    priority !== null ||
    status !== null ||
    ownerMode !== "mine" ||
    typeMode !== "all" ||
    stateMode !== "active" ||
    sort !== "updatedAt" ||
    query.trim() !== "";

  function handleReset() {
    setCategoryId(null);
    setLocationId(null);
    setPriority(null);
    setStatus(null);
    setOwnerModePersist("mine");
    setTypeModePersist("all");
    setStateModePersist("active");
    setSort("updatedAt");
    setQueryPersist("");
    clearAllFilters(KEY);
  }

  // 1. Narrow to actionable items (otázky + úkoly, V14). Honor "Moje"
  //    (assigned to me OR created by me for legacy records without assignee).
  //    Type pill below further narrows to a specific kind.
  const actionable = tasks.filter((tk) => {
    if (tk.type !== "otazka" && tk.type !== "ukol") return false;
    if (typeMode !== "all" && tk.type !== typeMode) return false;
    if (ownerMode === "mine") {
      const assigned = tk.assigneeUid ?? tk.createdBy;
      return assigned === user?.uid;
    }
    return true;
  });

  // 2. Apply status + stateMode (V14.9).
  //    - Explicit StatusFilterChip wins: if user picks one, that's the
  //      absolute truth (even "Hotovo" forced view works).
  //    - Otherwise stateMode drives the visibility. Default "active" keeps
  //      OPEN + BLOCKED visible; "all" includes DONE + CANCELED too.
  const byStatus = status
    ? actionable.filter((tk) => mapLegacyOtazkaStatus(tk.status) === status)
    : stateMode === "active"
    ? actionable.filter((tk) => {
        const s = mapLegacyOtazkaStatus(tk.status);
        return s === "OPEN" || s === "BLOCKED";
      })
    : actionable;

  // 3. Apply priority.
  const byPriority = priority
    ? byStatus.filter((tk) => tk.priority === priority)
    : byStatus;

  // 4. Category + location use the shared helpers.
  // 5. Search (title + body) applied last — diacritic-insensitive.
  const filtered = applySearch(
    applyLocation(applyCategory(byPriority, categoryId), locationId),
    query,
  );

  // 5. Split into ball-on-me + rest; sort each by updatedAt DESC. Concat with
  //    ball-on-me first so NapadCard’s highlight lines up with list position.
  const ballOnMe: Task[] = [];
  const rest: Task[] = [];
  for (const tk of filtered) {
    if (isBallOnMeV10(tk, user?.uid)) ballOnMe.push(tk);
    else rest.push(tk);
  }
  const visible = [...applySort(ballOnMe, sort), ...applySort(rest, sort)];

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
      </header>

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
            onClick={handleReset}
            aria-label={t("filter.resetAriaLabel")}
            className="shrink-0 inline-flex items-center gap-1 rounded-pill border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-subtle hover:text-ink hover:border-line-strong transition-colors"
          >
            <RotateCcw aria-hidden size={11} />
          </button>
        )}
      </div>

      {/* Filter row: type + owner toggle */}
      <div className="flex items-center gap-2 mb-2">
        <TypeModeChip value={typeMode} onChange={setTypeModePersist} />
        <OwnerModeChip value={ownerMode} onChange={setOwnerModePersist} />
      </div>

      {/* Advanced filters — expandable */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <StateModeChip value={stateMode} onChange={setStateModePersist} />
          <StatusFilterChip value={status} onChange={setStatus} />
          <PriorityFilterChip value={priority} onChange={setPriority} />
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

      <div className="mt-4">
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
  const isMine = value === "mine";
  return (
    <button
      type="button"
      aria-pressed={isMine}
      onClick={() => onChange(isMine ? "all" : "mine")}
      aria-label={t("ukoly.filterOwnerAria")}
      className={[
        "rounded-pill border px-2.5 py-1.5 text-xs font-medium transition-colors",
        isMine
          ? "bg-accent text-accent-on border-transparent"
          : "bg-transparent text-ink-muted border-line hover:bg-bg-subtle",
      ].join(" ")}
    >
      {t("ukoly.ownerMine")}
    </button>
  );
}


/**
 * V14 — type pill: Otázky / Úkoly / Vše. Mirrors OwnerModeChip visually so
 * the filter row reads as one consistent control group.
 */
function TypeModeChip({
  value,
  onChange,
}: {
  value: "otazka" | "ukol" | "all";
  onChange: (next: "otazka" | "ukol" | "all") => void;
}) {
  const t = useT();
  const opts: Array<{ v: "otazka" | "ukol" | "all"; label: string }> = [
    { v: "all", label: t("ukoly.typeAll") },
    { v: "otazka", label: t("ukoly.typeOtazky") },
    { v: "ukol", label: t("ukoly.typeUkoly") },
  ];
  return (
    <div role="radiogroup" aria-label={t("ukoly.filterTypeAria")} className="flex gap-1.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={[
            "rounded-pill border px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === o.v
              ? "bg-accent text-accent-on"
              : "bg-transparent text-ink-muted border-line hover:bg-bg-subtle",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}




/**
 * V14.9 — active/all pill. Hides DONE + CANCELED by default so closed
 * tasks vanish from the main list as soon as they're resolved. User flips
 * to "Vše" when they want to see the archive / follow up on a cancelled
 * task. Mirrors OwnerModeChip / TypeModeChip visually for consistency.
 */
function StateModeChip({
  value,
  onChange,
}: {
  value: "active" | "all";
  onChange: (next: "active" | "all") => void;
}) {
  const t = useT();
  const opts: Array<{ v: "active" | "all"; label: string }> = [
    { v: "active", label: t("ukoly.stateActive") },
    { v: "all", label: t("ukoly.stateAll") },
  ];
  return (
    <div role="radiogroup" aria-label={t("ukoly.filterStateAria")} className="flex gap-1.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={[
            "rounded-pill border px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === o.v
              ? "bg-accent text-accent-on border-transparent"
              : "bg-transparent text-ink-muted border-line hover:bg-bg-subtle",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

