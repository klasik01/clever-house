import type { Task } from "@/types";
import NapadCard from "./NapadCard";
import { useT } from "@/i18n/useT";

interface Props {
  tasks: Task[];
  /** @deprecated No longer rendered in card, kept for API compat. */
  categories?: unknown;
  /** Full unfiltered task pool — used by NapadCard to resolve linkedTaskIds across types. */
  allTasks?: Task[];
  loading: boolean;
  error: Error | null;
  emptyTitle: string;
  emptyBody: string;
  emptyIcon?: React.ReactNode;
  ariaLabel: string;
}

export default function TaskList({
  tasks,
  allTasks,
  loading,
  error,
  emptyTitle,
  emptyBody,
  emptyIcon,
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
  if (tasks.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} icon={emptyIcon} />;

  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <NapadCard task={task} allTasks={allTasks ?? tasks} />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      {icon && (
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-pill bg-bg-subtle text-ink-subtle">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-ink">{title}</p>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-20 rounded-md bg-surface ring-1 ring-line animate-pulse" />
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
    <div role="alert" className="mt-6 rounded-lg border border-line bg-surface px-6 py-6 text-center">
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
