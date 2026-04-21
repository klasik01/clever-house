import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { LOCATIONS, locationsByGroup } from "@/lib/locations";
import { useT } from "@/i18n/useT";
import type { Task } from "@/types";

/**
 * Home page — browse by location.
 * 2-col card grid grouped by LOCATION_GROUPS; each card opens /lokace/:id.
 * Badge counts *open* tasks (status !== "Hotovo") across both types combined.
 */
export default function Lokace() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));

  const countsById = buildOpenCounts(tasks);
  const groups = locationsByGroup();

  return (
    <section aria-labelledby="lokace-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <h2 id="lokace-heading" className="text-xl font-semibold tracking-tight text-ink">
        {t("locations.pageTitle")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{t("locations.pageHint")}</p>

      {loading && <Skeleton />}
      {!loading && error && (
        <div role="alert" className="mt-6 rounded-lg border border-line bg-surface px-6 py-6 text-center text-sm text-ink">
          {t("list.loadFailed")}
        </div>
      )}

      {!loading && !error && (
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
                  const count = countsById.get(loc.id) ?? 0;
                  return (
                    <li key={loc.id}>
                      <Link
                        to={`/lokace/${encodeURIComponent(loc.id)}`}
                        className="flex h-full min-h-[5rem] flex-col justify-between gap-2 rounded-md border border-line bg-surface px-3 py-3 transition-colors hover:bg-bg-subtle focus-visible:border-line-focus"
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
      )}
    </section>
  );
}

function buildOpenCounts(tasks: Task[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "Hotovo") continue;
    if (!t.locationId) continue;
    m.set(t.locationId, (m.get(t.locationId) ?? 0) + 1);
  }
  for (const l of LOCATIONS) if (!m.has(l.id)) m.set(l.id, 0);
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
