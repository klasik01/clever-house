import { useCallback, useState } from "react";
import Composer from "@/components/Composer";
import TaskList from "@/components/TaskList";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { createTask, deleteTask } from "@/lib/tasks";
import type { TaskType } from "@/types";

export default function Home() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const [saveError, setSaveError] = useState<string | null>(null);

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
            // Initial status by type. Fine-grained in S05.
            status: type === "otazka" ? "Otázka" : "Nápad",
          },
          user.uid
        );
      } catch (e) {
        console.error(e);
        setSaveError(t("composer.saveFailed"));
        throw e; // keep Composer from clearing
      }
    },
    [user, t]
  );

  const onDelete = useCallback(async (id: string) => {
    await deleteTask(id);
  }, []);

  // Home shows only nápady; otázky live on /otazky.
  const napady = tasks.filter((tk) => tk.type === "napad");

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

      <section
        aria-label="Seznam nápadů"
        className="mx-auto max-w-xl px-4 pt-2 pb-4"
      >
        <TaskList
          tasks={napady}
          loading={loading}
          error={error}
          onDelete={onDelete}
          emptyTitle={t("list.emptyTitle")}
          emptyBody={t("list.emptyBody")}
          ariaLabel="Seznam nápadů"
        />
      </section>
    </>
  );
}
