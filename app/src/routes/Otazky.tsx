import { useState } from "react";
import TaskList from "@/components/TaskList";
import FilterChips from "@/components/FilterChips";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { applyOpenClosed, loadFilter, saveFilter, type OpenClosedFilter } from "@/lib/filters";

export default function Otazky() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter("otazky"));

  function changeFilter(next: OpenClosedFilter) {
    setFilter(next);
    saveFilter("otazky", next);
  }

  const otazky = tasks.filter((tk) => tk.type === "otazka");
  const counts = {
    all: otazky.length,
    open: otazky.filter((x) => x.status !== "Hotovo").length,
    done: otazky.filter((x) => x.status === "Hotovo").length,
  };
  const visible = applyOpenClosed(otazky, filter);

  return (
    <section aria-labelledby="otazky-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <h2 id="otazky-heading" className="mb-3 text-xl font-semibold tracking-tight text-ink">
        {t("otazky.pageTitle")}
      </h2>

      <FilterChips value={filter} onChange={changeFilter} counts={counts} />

      <div className="mt-3">
        <TaskList
          tasks={visible}
          loading={loading}
          error={error}
          emptyTitle={t("otazky.emptyTitle")}
          emptyBody={t("otazky.emptyBody")}
          ariaLabel="Seznam otázek"
        />
      </div>
    </section>
  );
}
