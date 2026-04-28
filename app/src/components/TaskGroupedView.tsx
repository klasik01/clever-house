import TaskList from "./TaskList";
import { useT } from "@/i18n/useT";
import { LOCATIONS, LOCATION_GROUPS, getLocation } from "@/lib/locations";
import type { Category, Task } from "@/types";

export type GroupBy = "flat" | "lokace" | "kategorie";

interface Props {
  tasks: Task[];
  /** Full unfiltered task pool for linked task resolution. */
  allTasks?: Task[];
  categories: Category[];
  groupBy: GroupBy;
  loading: boolean;
  error: Error | null;
  /** aria-label for the flat list + section sub-lists (suffixed by group name). */
  ariaLabelBase: string;
  /** Empty-state copy when groupBy === "flat" and no tasks. */
  emptyTitle: string;
  emptyBody: string;
  emptyIcon?: React.ReactNode;
}

/**
 * Renders a TaskList flat or grouped by location/category.
 * - Location groups follow LOCATION_GROUPS order; per-group locations then
 *   surface their tasks as mini-sections. Tasks without location fall into
 *   "Bez lokace".
 * - Category groups iterate the `categories` prop; tasks without any
 *   category fall into "Bez kategorie".
 * - Groups with zero tasks are omitted from the DOM (no empty shells).
 */
export default function TaskGroupedView({
  tasks,
  allTasks,
  categories,
  groupBy,
  loading,
  error,
  ariaLabelBase,
  emptyTitle,
  emptyBody,
  emptyIcon,
}: Props) {
  const t = useT();

  if (groupBy === "flat") {
    return (
      <TaskList
        tasks={tasks}
        allTasks={allTasks ?? tasks}
        categories={categories}
        loading={loading}
        error={error}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
        emptyIcon={emptyIcon}
        ariaLabel={ariaLabelBase}
      />
    );
  }

  if (loading || error) {
    // Defer to TaskList for skeletons + error alert in flat mode.
    return (
      <TaskList
        tasks={[]}
        allTasks={allTasks}
        categories={categories}
        loading={loading}
        error={error}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
        emptyIcon={emptyIcon}
        ariaLabel={ariaLabelBase}
      />
    );
  }

  if (groupBy === "lokace") {
    return (
      <div className="flex flex-col gap-6">
        {LOCATION_GROUPS.map((g) => {
          const groupLocations = LOCATIONS.filter((l) => l.group === g.id);
          const sectionTasks = tasks.filter(
            (tk) => tk.locationId && groupLocations.some((l) => l.id === tk.locationId)
          );
          if (sectionTasks.length === 0) return null;
          return (
            <section key={g.id} aria-labelledby={`grp-${g.id}`}>
              <h3 id={`grp-${g.id}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {t(g.i18nKey)}
              </h3>
              <div className="flex flex-col gap-3">
                {groupLocations.map((loc) => {
                  const locTasks = sectionTasks.filter((tk) => tk.locationId === loc.id);
                  if (locTasks.length === 0) return null;
                  return (
                    <div key={loc.id}>
                      <p className="mb-1 text-xs text-ink-subtle">{loc.label}</p>
                      <TaskList
                        tasks={locTasks}
                        categories={categories}
                        loading={false}
                        error={null}
                        emptyTitle=""
                        emptyBody=""
                        ariaLabel={`${ariaLabelBase} — ${loc.label}`}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {(() => {
          const noLoc = tasks.filter((tk) => !tk.locationId || !getLocation(tk.locationId));
          if (noLoc.length === 0) return null;
          return (
            <section aria-labelledby="grp-noloc">
              <h3 id="grp-noloc" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {t("locations.noLocationLabel")}
              </h3>
              <TaskList
                tasks={noLoc}
                categories={categories}
                loading={false}
                error={null}
                emptyTitle=""
                emptyBody=""
                ariaLabel={ariaLabelBase}
              />
            </section>
          );
        })()}
        {tasks.length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-center">
            <p className="text-base font-medium text-ink">{emptyTitle}</p>
            <p className="mt-2 text-sm text-ink-muted">{emptyBody}</p>
          </div>
        )}
      </div>
    );
  }

  // groupBy === "kategorie"
  return (
    <div className="flex flex-col gap-6">
      {categories.map((c) => {
        const catTasks = tasks.filter((tk) => {
          const ids = tk.categoryIds?.length ? tk.categoryIds : tk.categoryId ? [tk.categoryId] : [];
          return ids.includes(c.id);
        });
        if (catTasks.length === 0) return null;
        return (
          <section key={c.id} aria-labelledby={`cat-${c.id}`}>
            <h3 id={`cat-${c.id}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {c.label}
            </h3>
            <TaskList
              tasks={catTasks}
              categories={categories}
              loading={false}
              error={null}
              emptyTitle=""
              emptyBody=""
              ariaLabel={`${ariaLabelBase} — ${c.label}`}
            />
          </section>
        );
      })}
      {(() => {
        const noCat = tasks.filter((tk) => {
          const ids = tk.categoryIds?.length ? tk.categoryIds : tk.categoryId ? [tk.categoryId] : [];
          return ids.length === 0;
        });
        if (noCat.length === 0) return null;
        return (
          <section aria-labelledby="cat-none">
            <h3 id="cat-none" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("detail.categoryNone")}
            </h3>
            <TaskList
              tasks={noCat}
              allTasks={allTasks ?? tasks}
              categories={categories}
              loading={false}
              error={null}
              emptyTitle=""
              emptyBody=""
              ariaLabel={ariaLabelBase}
            />
          </section>
        );
      })()}
      {tasks.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-center">
          <p className="text-base font-medium text-ink">{emptyTitle}</p>
          <p className="mt-2 text-sm text-ink-muted">{emptyBody}</p>
        </div>
      )}
    </div>
  );
}
