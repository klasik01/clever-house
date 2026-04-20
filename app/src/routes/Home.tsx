import { useCallback, useEffect, useState } from "react";
import Composer from "@/components/Composer";
import NapadCard from "@/components/NapadCard";
import { useT } from "@/i18n/useT";
import { newId } from "@/lib/id";
import { loadTasks, saveTasks } from "@/lib/storage";
import type { Task } from "@/types";

/**
 * Home — aka Zachyt.
 * Primary action (composer) at top, list of nápadů below.
 */
export default function Home() {
  const t = useT();
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());

  // Persist on every change.
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const handleSave = useCallback((text: string) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: newId(),
      type: "napad",
      title: text.slice(0, 80),
      body: text,
      status: "Nápad",
      createdAt: now,
      updatedAt: now,
      createdBy: "local", // S02 swaps for auth uid
    };
    setTasks((prev) => [newTask, ...prev]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setTasks((prev) => prev.filter((tk) => tk.id !== id));
  }, []);

  return (
    <>
      <Composer onSave={handleSave} />

      <section
        aria-label="Seznam nápadů"
        className="mx-auto max-w-xl px-4 pt-2 pb-4"
      >
        {tasks.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-center">
            <p className="text-base font-medium text-ink">
              {t("list.emptyTitle")}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {t("list.emptyBody")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <NapadCard task={task} onDelete={handleDelete} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
