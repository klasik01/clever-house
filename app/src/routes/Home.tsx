import { useCallback, useState } from "react";
import Composer from "@/components/Composer";
import NapadCard from "@/components/NapadCard";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { createTask, deleteTask } from "@/lib/tasks";

export default function Home() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSave = useCallback(
    async (text: string) => {
      if (!user) return;
      setSaveError(null);
      try {
        await createTask(
          {
            type: "napad",
            title: text.slice(0, 80),
            body: text,
            status: "Nápad",
          },
          user.uid
        );
      } catch (e) {
        console.error(e);
        setSaveError(t("composer.saveFailed"));
      }
    },
    [user, t]
  );

  const onDelete = useCallback(async (id: string) => {
    await deleteTask(id);
  }, []);

  // Only show nápady on Home. Otázky will live on /otazky (S03).
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
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <ErrorBlock message={t("list.loadFailed")} retry={() => location.reload()} retryLabel={t("list.retry")} />
        ) : napady.length === 0 ? (
          <EmptyState title={t("list.emptyTitle")} body={t("list.emptyBody")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {napady.map((task) => (
              <li key={task.id}>
                <NapadCard task={task} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="text-base font-medium text-ink">{title}</p>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-20 rounded-md bg-surface ring-1 ring-line animate-pulse"
        />
      ))}
    </ul>
  );
}

function ErrorBlock({
  message,
  retry,
  retryLabel,
}: {
  message: string;
  retry: () => void;
  retryLabel: string;
}) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-lg border border-line bg-surface px-6 py-6 text-center"
    >
      <p className="text-sm text-ink">{message}</p>
      <button
        type="button"
        onClick={retry}
        className="mt-3 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
      >
        {retryLabel}
      </button>
    </div>
  );
}
