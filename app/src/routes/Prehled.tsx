import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Hourglass, UserCheck } from "lucide-react";
import TaskList from "@/components/TaskList";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useVisibleTasks } from "@/hooks/useVisibleTasks";
import { useCategories } from "@/hooks/useCategories";
import { computePrehledGroups, isM2Ok, type PrehledFilterId } from "@/lib/prehled";


/**
 * /prehled — V3 dashboard.
 * 4 tiles (counts) + list under active filter, all derived from the same
 * `useTasks` snapshot. URL ?filter=X persists active tile for deep-links.
 */
export default function Prehled() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, allTasks, loading, error } = useVisibleTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const [params, setParams] = useSearchParams();
  const active = (params.get("filter") as PrehledFilterId | null) ?? "waiting-me";

  const groups = useMemo(
    () => computePrehledGroups(tasks, user?.uid ?? ""),
    [tasks, user?.uid]
  );
  const counts = {
    "waiting-me": groups["waiting-me"].length,
    "waiting-others": groups["waiting-others"].length,
    overdue: groups.overdue.length,
    stuck: groups.stuck.length,
  };

  const m2Ok = isM2Ok(counts.stuck);

  const FILTER_ORDER: PrehledFilterId[] = ["waiting-me", "waiting-others", "overdue", "stuck"];

  function onTabListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const idx = FILTER_ORDER.indexOf(active);
    const nextIdx = e.key === "ArrowRight"
      ? (idx + 1) % FILTER_ORDER.length
      : (idx - 1 + FILTER_ORDER.length) % FILTER_ORDER.length;
    setActive(FILTER_ORDER[nextIdx]);
  }

  function setActive(next: PrehledFilterId) {
    const np = new URLSearchParams(params);
    np.set("filter", next);
    setParams(np, { replace: true });
  }

  const emptyCopy: Record<PrehledFilterId, { title: string; body: string }> = {
    "waiting-me": { title: t("prehled.emptyWaitingMe"), body: "" },
    "waiting-others": { title: t("prehled.emptyWaitingOthers"), body: "" },
    overdue: { title: t("prehled.emptyOverdue"), body: "" },
    stuck: { title: t("prehled.emptyStuck"), body: "" },
  };

  const ariaLabels: Record<PrehledFilterId, string> = {
    "waiting-me": t("prehled.waitingMe"),
    "waiting-others": t("prehled.waitingOthers"),
    overdue: t("prehled.overdue"),
    stuck: t("prehled.stuck"),
  };

  return (
    <section aria-labelledby="prehled-heading" className="mx-auto max-w-xl px-4 py-4">
      <h2 id="prehled-heading" className="text-xl font-semibold tracking-tight text-ink">
        {t("prehled.pageTitle")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{t("prehled.pageHint")}</p>

      {/* M2 banner */}
      <div
        role={m2Ok ? "status" : "alert"}
        className={`mt-4 flex items-start gap-3 rounded-md border px-4 py-3 ${
          m2Ok ? "border-transparent" : "border-transparent"
        }`}
        style={{
          background: m2Ok
            ? "var(--color-prehled-m2-ok-bg)"
            : "var(--color-prehled-m2-bad-bg)",
          color: m2Ok
            ? "var(--color-prehled-m2-ok-fg)"
            : "var(--color-prehled-m2-bad-fg)",
        }}
      >
        {m2Ok ? (
          <CheckCircle2 aria-hidden size={18} className="mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle aria-hidden size={18} className="mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {m2Ok ? t("prehled.m2OkTitle") : t("prehled.m2BadTitle")}
          </p>
          <p className="mt-0.5 text-xs">
            {t(m2Ok ? "prehled.m2OkBody" : "prehled.m2BadBody", { n: counts.stuck })}
          </p>
        </div>
      </div>

      {/* 4 tiles */}
      <div role="tablist" aria-label={t("prehled.pageTitle")} onKeyDown={onTabListKey} className="mt-4 grid grid-cols-2 gap-2">
        <Tile
          id="waiting-me"
          active={active === "waiting-me"}
          label={t("prehled.waitingMe")}
          count={counts["waiting-me"]}
          icon={<UserCheck aria-hidden size={16} />}
          onClick={() => setActive("waiting-me")}
        />
        <Tile
          id="waiting-others"
          active={active === "waiting-others"}
          label={t("prehled.waitingOthers")}
          count={counts["waiting-others"]}
          icon={<Hourglass aria-hidden size={16} />}
          onClick={() => setActive("waiting-others")}
        />
        <Tile
          id="overdue"
          active={active === "overdue"}
          label={t("prehled.overdue")}
          count={counts.overdue}
          icon={<AlertTriangle aria-hidden size={16} />}
          onClick={() => setActive("overdue")}
        />
        <Tile
          id="stuck"
          active={active === "stuck"}
          label={t("prehled.stuck")}
          count={counts.stuck}
          icon={<Clock aria-hidden size={16} />}
          onClick={() => setActive("stuck")}
        />
      </div>

      <div
        id="prehled-panel"
        role="tabpanel"
        aria-labelledby={`tile-${active}`}
        className="mt-4"
      >
        <TaskList
          tasks={groups[active]}
          allTasks={allTasks}
          categories={categories}
          loading={loading}
          error={error}
          emptyTitle={emptyCopy[active].title}
          emptyBody={emptyCopy[active].body}
          ariaLabel={ariaLabels[active]}
        />
      </div>
    </section>
  );
}

function Tile({
  id,
  active,
  label,
  count,
  icon,
  onClick,
}: {
  id: PrehledFilterId;
  active: boolean;
  label: string;
  count: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tile-${id}`}
      aria-selected={active}
      aria-controls="prehled-panel"
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={[
        "flex flex-col items-start gap-1 rounded-md border px-3 py-3 text-left transition-colors",
        active
          ? "border-line-strong bg-surface shadow-sm ring-2 ring-accent/30"
          : "border-line bg-surface hover:bg-bg-subtle",
      ].join(" ")}
    >
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums text-ink">{count}</span>
    </button>
  );
}

