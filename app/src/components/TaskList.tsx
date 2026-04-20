import type { Task } from "@/types";
import NapadCard from "./NapadCard";
import { useT } from "@/i18n/useT";

interface Props {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  onDelete: (id: string) => Promise<void> | void;
  emptyTitle: string;
  emptyBody: string;
  ariaLabel: string;
}

/** Shared list shell: handles loading/error/empty/rendered states. */
export default function TaskList({
  tasks,
  loading,
  error,
  onDelete,
  emptyTitle,
  emptyBody,
  ariaLabel,
}: Props) {
  const t = useT();

  if (loading) return <Skeleton />;
  if (error)
    return (
      <ErrorBlock
        message={t("list.loadFailed")}
        retryLabel={t("list.retry")}
        retry={() => location.reload()}
      />
    );
  if (tasks.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} />;

  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <NapadCard task={task} onDelete={onDelete} />
        </li>
      ))}
    </ul>
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

function Skeleton() {
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
