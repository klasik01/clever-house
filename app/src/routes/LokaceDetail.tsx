import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, HelpCircle, Notebook } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import { getLocation } from "@/lib/locations";
import TaskList from "@/components/TaskList";
import { useT } from "@/i18n/useT";

type TabId = "napady" | "otazky";

/**
 * S28 — LokaceDetail.
 * Tabs: Nápady / Otázky, each filtered to the given :id.
 * No extra status/category chips per user decision C.2.
 */
export default function LokaceDetail() {
  const { id: rawId } = useParams<{ id: string }>();
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const [tab, setTab] = useState<TabId>("napady");

  const id = rawId ? decodeURIComponent(rawId) : "";
  const location = getLocation(id);

  if (!location) {
    return (
      <section className="mx-auto max-w-xl px-4 py-12 text-center" role="alert">
        <h2 className="text-xl font-semibold text-ink">{t("locations.notFoundTitle")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("locations.notFoundBody")}</p>
        <button
          type="button"
          onClick={() => navigate("/lokace")}
          className="mt-6 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          {t("detail.back")}
        </button>
      </section>
    );
  }

  const forLocation = tasks.filter((tk) => tk.locationId === id);
  const napady = forLocation.filter((tk) => tk.type === "napad" && tk.status !== "Hotovo");
  const otazky = forLocation.filter((tk) => tk.type === "otazka" && tk.status !== "Hotovo");

  const tabTasks = tab === "napady" ? napady : otazky;
  const emptyTitle = t("locations.empty");
  const emptyBody = t("locations.emptyAll");

  return (
    <section aria-labelledby="lokace-detail-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <div className="flex items-center gap-2">
        <Link
          to="/lokace"
          aria-label={t("detail.back")}
          className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
        >
          <ArrowLeft aria-hidden size={20} />
        </Link>
        <h2 id="lokace-detail-heading" className="text-xl font-semibold tracking-tight text-ink">
          {location.label}
        </h2>
      </div>

      <div
        role="tablist"
        aria-label={t("aria.lokaceTabs")}
        className="mt-3 flex items-center gap-1 rounded-md border border-line bg-bg-subtle p-1"
      >
        <TabButton
          active={tab === "napady"}
          onClick={() => setTab("napady")}
          icon={<Notebook aria-hidden size={16} />}
          label={t("locations.tabNapady")}
          count={napady.length}
          controls="lokace-panel-napady"
        />
        <TabButton
          active={tab === "otazky"}
          onClick={() => setTab("otazky")}
          icon={<HelpCircle aria-hidden size={16} />}
          label={t("locations.tabOtazky")}
          count={otazky.length}
          controls="lokace-panel-otazky"
        />
      </div>

      <div
        id={tab === "napady" ? "lokace-panel-napady" : "lokace-panel-otazky"}
        role="tabpanel"
        aria-labelledby={`lokace-tab-${tab}`}
        className="mt-3"
      >
        <TaskList
          tasks={tabTasks}
          categories={categories}
          loading={loading}
          error={error}
          emptyTitle={emptyTitle}
          emptyBody={emptyBody}
          emptyIcon={tab === "napady" ? <Notebook size={22} aria-hidden /> : <HelpCircle size={22} aria-hidden />}
          ariaLabel={
            tab === "napady" ? t("aria.lokaceNapadyList") : t("aria.lokaceOtazkyList")
          }
        />
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  controls,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  controls: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`lokace-tab-${controls.replace("lokace-panel-", "")}`}
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={[
        "inline-flex flex-1 items-center justify-center gap-2 min-h-tap rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-surface text-ink shadow-sm ring-1 ring-line"
          : "text-ink-subtle hover:text-ink",
      ].join(" ")}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
      <span
        aria-hidden
        className={
          active
            ? "ml-1 rounded-pill bg-accent/10 px-1.5 text-xs font-semibold text-accent-visual"
            : "ml-1 rounded-pill bg-bg-muted px-1.5 text-xs font-semibold text-ink-muted"
        }
      >
        {count}
      </span>
    </button>
  );
}
