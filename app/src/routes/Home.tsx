import { useCallback, useState } from "react";
import Composer from "@/components/Composer";
import TaskList from "@/components/TaskList";
import FilterChips from "@/components/FilterChips";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { createTask } from "@/lib/tasks";
import type { TaskType } from "@/types";
import { applyOpenClosed, loadFilter, saveFilter, type OpenClosedFilter } from "@/lib/filters";

export default function Home() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter("napady"));

  function changeFilter(next: OpenClosedFilter) {
    setFilter(next);
    saveFilter("napady", next);
  }

  const onSave = useCallback(
    async (text: string, type: TaskType) => {
      if (!user) return;
      setSaveError(null);
      try {
        await createTask(
          {
            type,
            title: text.slice(0, 80),
            body: text,
            status: type === "otazka" ? "Otázka" : "Nápad",
          },
          user.uid
        );
      } catch (e) {
        console.error(e);
        setSaveError(t("composer.saveFailed"));
        throw e;
      }
    },
    [user, t]
  );

  const napady = tasks.filter((tk) => tk.type === "napad");
  const counts = {
    all: napady.length,
    open: napady.filter((x) => x.status !== "Hotovo").length,
    done: napady.filter((x) => x.status === "Hotovo").length,
  };
  const visible = applyOpenClosed(napady, filter);

  return (
    <>
      <Composer onSave={onSave} />

      {saveError && (
        <p
          role="alert"
          className="mx-auto max-w-xl px-4 pb-2 text-center text-xs text-[color:var(--color-status-danger-fg)]"
        >
          {saveError}
        </p>
      )}

      <section aria-label="Seznam nápadů" className="mx-auto max-w-xl px-4 pt-2 pb-4">
        <FilterChips value={filter} onChange={changeFilter} counts={counts} />

        <div className="mt-3">
          <TaskList
            tasks={visible}
            loading={loading}
            error={error}
            emptyTitle={t("list.emptyTitle")}
            emptyBody={t("list.emptyBody")}
            ariaLabel="Seznam nápadů"
          />
        </div>
      </section>
    </>
  );
}
