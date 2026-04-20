import { useCallback } from "react";
import TaskList from "@/components/TaskList";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { deleteTask } from "@/lib/tasks";

/**
 * /otazky — seznam otázek pro Projektanta.
 * No composer — otázky se zakládají buď na `/` (toggle) nebo konverzí z nápadu (S11).
 * Status filter, kategorie/lokace filter přicházejí v S05–S07.
 */
export default function Otazky() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));

  const onDelete = useCallback(async (id: string) => {
    await deleteTask(id);
  }, []);

  const otazky = tasks.filter((tk) => tk.type === "otazka");

  return (
    <section
      aria-labelledby="otazky-heading"
      className="mx-auto max-w-xl px-4 pt-4 pb-4"
    >
      <h2
        id="otazky-heading"
        className="mb-3 text-xl font-semibold tracking-tight text-ink"
      >
        {t("otazky.pageTitle")}
      </h2>

      <TaskList
        tasks={otazky}
        loading={loading}
        error={error}
        onDelete={onDelete}
        emptyTitle={t("otazky.emptyTitle")}
        emptyBody={t("otazky.emptyBody")}
        ariaLabel="Seznam otázek"
      />
    </section>
  );
}
