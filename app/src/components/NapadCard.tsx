import { Link } from "react-router-dom";
import { HelpCircle, Notebook } from "lucide-react";
import type { Task } from "@/types";
import { useT, formatRelative } from "@/i18n/useT";

interface Props {
  task: Task;
}

/** Card is a full-width tap target linking to /t/:id. No inline delete (moved to detail overflow menu). */
export default function NapadCard({ task }: Props) {
  const t = useT();
  const created = new Date(task.createdAt);
  const TypeIcon = task.type === "otazka" ? HelpCircle : Notebook;

  return (
    <Link
      to={`/t/${task.id}`}
      className="block rounded-md bg-surface px-4 py-3 shadow-sm ring-1 ring-line transition-colors hover:ring-line-strong"
    >
      <article>
        <div className="flex items-start gap-3">
          <TypeIcon
            aria-hidden
            size={18}
            className={task.type === "otazka" ? "text-accent-visual mt-0.5 shrink-0" : "text-ink-subtle mt-0.5 shrink-0"}
          />
          <div className="min-w-0 flex-1">
            <p className="text-base leading-snug text-ink whitespace-pre-wrap break-words">
              {task.body || task.title || t("detail.titlePlaceholder")}
            </p>
            <p className="mt-2 text-xs text-ink-subtle">
              {formatRelative(t, created)}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}
