import { Link, useSearchParams } from "react-router-dom";
import { MapPin, Tag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import { LOCATIONS, locationsByGroup } from "@/lib/locations";
import { useT } from "@/i18n/useT";
import type { Category, Task } from "@/types";

type HomeView = "lokace" | "kategorie";

/**
 * Home page — browse by location OR by category.
 * - Tab switch near the top chooses view. URL ?view=kategorie persists deep-link.
 * - Each card = name + open-count badge; tap → /lokace/:id or /kategorie/:id.
 * - Open count excludes status "Hotovo"; counts both napad + otazka.
 */
export default function Lokace() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const [params, setParams] = useSearchParams();
  const view: HomeView = (params.get("view") as HomeView | null) ?? "lokace";

  function setView(next: HomeView) {
    const np = new URLSearchParams(params);
    if (next === "lokace") np.delete("view");
    else np.set("view", next);
    setParams(np, { replace: true });
  }

  return (
    <section aria-labelledby="home-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <h2 id="home-heading" className="text-xl font-semibold tracking-tight text-ink">
        {view === "lokace" ? t("locations.pageTitle") : t("categories.pageTitle")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {view === "lokace" ? t("locations.pageHint") : t("categories.pageHint")}
      </p>

      <div
        role="tablist"
        aria-label={t("home.viewToggleLabel")}
        className="mt-3 flex items-center gap-1 rounded-md border border-line bg-bg-subtle p-1"
      >
        <ViewTab
          active={view === "lokace"}
          onClick={() => setView("lokace")}
          icon={<MapPin aria-hidden size={16} />}
          label={t("locations.pageTitle")}
        />
        <ViewTab
          active={view === "kategorie"}
          onClick={() => setView("kategorie")}
          icon={<Tag aria-hidden size={16} />}
          label={t("categories.pageTitle")}
        />
      </div>

      {loading && <Skeleton />}
      {!loading && error && (
        <div role="alert" className="mt-6 rounded-lg border border-line bg-surface px-6 py-6 text-center text-sm text-ink">
          {t("list.loadFailed")}
        </div>
      )}

      {!loading && !error && view === "lokace" && (
        <LocationsGrid tasks={tasks} />
      )}

      {!loading && !error && view === "kategorie" && (
        <CategoriesGrid tasks={tasks} categories={categories} />
      )}
    </section>
  );
}

function ViewTab({
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

// ---- Locations grid (V2 content) ----

function LocationsGrid({ tasks }: { tasks: Task[] }) {
  const t = useT();
  const counts = buildOpenCountsByLocation(tasks);
  const groups = locationsByGroup();

  return (
    <div aria-label={t("aria.lokaceGrid")} className="mt-4 flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.group} aria-labelledby={`group-${g.group}`}>
          <h3
            id={`group-${g.group}`}
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
          >
            {t(g.i18nKey)}
          </h3>
          <ul className="grid grid-cols-2 gap-2">
            {g.items.map((loc) => {
              const count = counts.get(loc.id) ?? 0;
              return (
                <li key={loc.id}>
                  <Link
                    to={`/lokace/${encodeURIComponent(loc.id)}`}
                    className="flex h-full min-h-[5rem] flex-col justify-between gap-2 rounded-md border border-line bg-surface px-3 py-3 transition-colors hover:bg-bg-subtle focus-visible:border-line-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                  >
                    <span className="flex items-start gap-2">
                      <MapPin aria-hidden size={16} className="mt-0.5 shrink-0 text-accent-visual" />
                      <span className="text-sm font-medium text-ink leading-snug">{loc.label}</span>
                    </span>
                    <span
                      className={
                        count > 0
                          ? "self-start rounded-pill bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-visual"
                          : "self-start text-xs text-ink-subtle"
                      }
                    >
                      {t("locations.openCount", { n: count })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function buildOpenCountsByLocation(tasks: Task[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "Hotovo") continue;
    if (!t.locationId) continue;
    m.set(t.locationId, (m.get(t.locationId) ?? 0) + 1);
  }
  for (const l of LOCATIONS) if (!m.has(l.id)) m.set(l.id, 0);
  return m;
}

// ---- Categories grid (V3.1 new) ----

function CategoriesGrid({ tasks, categories }: { tasks: Task[]; categories: Category[] }) {
  const t = useT();
  const counts = buildOpenCountsByCategory(tasks);

  if (categories.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-center">
        <p className="text-base font-medium text-ink">{t("categories.empty")}</p>
        <p className="mt-2 text-sm text-ink-muted">{t("categories.emptyHint")}</p>
        <Link
          to="/kategorie"
          className="mt-4 inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          {t("categories.manage")}
        </Link>
      </div>
    );
  }

  return (
    <div aria-label={t("aria.categoriesGrid")} className="mt-4 flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2">
        {categories.map((c) => {
          const count = counts.get(c.id) ?? 0;
          return (
            <li key={c.id}>
              <Link
                to={`/kategorie/${encodeURIComponent(c.id)}`}
                className="flex h-full min-h-[5rem] flex-col justify-between gap-2 rounded-md border border-line bg-surface px-3 py-3 transition-colors hover:bg-bg-subtle focus-visible:border-line-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                <span className="flex items-start gap-2">
                  <Tag aria-hidden size={16} className="mt-0.5 shrink-0 text-accent-visual" />
                  <span className="text-sm font-medium text-ink leading-snug">{c.label}</span>
                </span>
                <span
                  className={
                    count > 0
                      ? "self-start rounded-pill bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-visual"
                      : "self-start text-xs text-ink-subtle"
                  }
                >
                  {t("locations.openCount", { n: count })}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function buildOpenCountsByCategory(tasks: Task[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "Hotovo") continue;
    const ids = t.categoryIds?.length ? t.categoryIds : t.categoryId ? [t.categoryId] : [];
    for (const cid of ids) {
      m.set(cid, (m.get(cid) ?? 0) + 1);
    }
  }
  return m;
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-4 flex flex-col gap-6">
      {[0, 1, 2, 3].map((gi) => (
        <section key={gi}>
          <div className="mb-2 h-3 w-24 rounded bg-surface ring-1 ring-line animate-pulse" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-md bg-surface ring-1 ring-line animate-pulse" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
