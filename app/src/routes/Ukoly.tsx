import { useState } from "react";
import { RotateCcw } from "lucide-react";
import TaskList from "@/components/TaskList";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import PriorityFilterChip from "@/components/PriorityFilterChip";
import StatusFilterChip from "@/components/StatusFilterChip";
import SearchInput from "@/components/SearchInput";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import { applySearch } from "@/lib/search";
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
  const [query, setQuery] = useState<string>(() => {
    try { return sessionStorage.getItem(filterKey("ukoly", "q")) ?? ""; } catch { return ""; }
  });
  function setQueryPersist(next: string) {
    setQuery(next);
    try { sessionStorage.setItem(filterKey("ukoly", "q"), next); } catch { /* ignore */ }
  }
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

  const isFilterActive =
    categoryId !== null ||
    locationId !== null ||
    priority !== null ||
    status !== null ||
    ownerMode !== "mine" ||
    typeMode !== "all" ||
    stateMode !== "active" ||
    query.trim() !== "";

  function handleReset() {
    setCategoryId(null);
    setLocationId(null);
    setPriority(null);
    setStatus(null);
    setOwnerModePersist("mine");
    setTypeModePersist("all");
    setStateModePersist("active");
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

      <div className="mb-4">
        <SearchInput value={query} onChange={setQueryPersist} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StateModeChip value={stateMode} onChange={setStateModePersist} />
        <TypeModeChip value={typeMode} onChange={setTypeModePersist} />
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
    <div role="radiogroup" aria-label={t("ukoly.filterTypeAria")} className="inline-flex rounded-pill border border-line overflow-hidden">
      {opts.map((o, i) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={[
            "min-h-tap px-3 py-1.5 text-sm font-medium",
            i > 0 ? "border-l border-line" : "",
            value === o.v
              ? "bg-accent text-accent-on"
              : "bg-transparent text-ink-muted hover:text-ink",
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
  return (
    <div role="radiogroup" aria-label={t("ukoly.filterStateAria")} className="inline-flex rounded-pill border border-line overflow-hidden">
      <button
        type="button"
        role="radio"
        aria-checked={value === "active"}
        onClick={() => onChange("active")}
        className={[
          "min-h-tap px-3 py-1.5 text-sm font-medium",
          value === "active"
            ? "bg-accent text-accent-on"
            : "bg-transparent text-ink-muted hover:text-ink",
        ].join(" ")}
      >
        {t("ukoly.stateActive")}
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
        {t("ukoly.stateAll")}
      </button>
    </div>
  );
}

