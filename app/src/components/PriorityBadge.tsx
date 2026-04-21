import { Flame, Minus, MoveDown } from "lucide-react";
import { useT } from "@/i18n/useT";
import type { TaskPriority } from "@/types";

interface Props {
  priority: TaskPriority;
  className?: string;
}

/** Read-only priority pill for list cards and detail meta-row. */
export default function PriorityBadge({ priority, className }: Props) {
  const t = useT();
  const varSuffix = priority.toLowerCase();
  return (
    <span
      aria-label={`${t("priority.label")}: ${t(`priority.${priority}Long`)}`}
      className={[
        "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-medium",
        className ?? "",
      ].join(" ")}
      style={{
        backgroundColor: `var(--color-priority-${varSuffix}-bg)`,
        color: `var(--color-priority-${varSuffix}-fg)`,
        borderColor: `var(--color-priority-${varSuffix}-border)`,
      }}
    >
      <span
        aria-hidden
        className="grid size-3 place-items-center"
        style={{ color: `var(--color-priority-${varSuffix}-dot)` }}
      >
        {priority === "P1" ? (
          <Flame aria-hidden size={11} />
        ) : priority === "P2" ? (
          <Minus aria-hidden size={11} />
        ) : (
          <MoveDown aria-hidden size={11} />
        )}
      </span>
      {t(`priority.${priority}`)}
    </span>
  );
}
