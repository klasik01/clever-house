import TaskList from "@/components/TaskList";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";

export default function Otazky() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));

  const otazky = tasks.filter((tk) => tk.type === "otazka");

  return (
    <section aria-labelledby="otazky-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <h2 id="otazky-heading" className="mb-3 text-xl font-semibold tracking-tight text-ink">
        {t("otazky.pageTitle")}
      </h2>

      <TaskList
        tasks={otazky}
        loading={loading}
        error={error}
        emptyTitle={t("otazky.emptyTitle")}
        emptyBody={t("otazky.emptyBody")}
        ariaLabel="Seznam otázek"
      />
    </section>
  );
}
