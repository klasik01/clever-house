import { Trash2 } from "lucide-react";
import type { Task } from "@/types";
import { useT, formatRelative } from "@/i18n/useT";

interface Props {
  task: Task;
  onDelete: (id: string) => void;
}

export default function NapadCard({ task, onDelete }: Props) {
  const t = useT();
  const created = new Date(task.createdAt);

  return (
    <article className="group rounded-md bg-surface px-4 py-3 shadow-sm ring-1 ring-line transition-colors hover:ring-line-strong">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug text-ink whitespace-pre-wrap break-words">
            {task.body}
          </p>
          <p className="mt-2 text-xs text-ink-subtle">
            {formatRelative(t, created)}
          </p>
        </div>

        <button
          type="button"
          aria-label={t("card.delete")}
          onClick={() => {
            if (window.confirm(t("card.confirmDelete"))) onDelete(task.id);
          }}
          className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-accent-hover transition-opacity"
        >
          <Trash2 aria-hidden size={18} />
        </button>
      </div>
    </article>
  );
}
