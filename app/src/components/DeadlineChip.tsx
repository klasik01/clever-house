import { Clock } from "lucide-react";
import { useT } from "@/i18n/useT";
import { deadlineState, formatCountdownKey } from "@/lib/deadline";

interface Props {
  deadline: number | null | undefined;
  className?: string;
}

/** Read-only chip with countdown text + state-based color. Returns null if no deadline. */
export default function DeadlineChip({ deadline, className }: Props) {
  const t = useT();
  if (deadline === null || deadline === undefined) return null;
  const state = deadlineState(deadline)!;
  const { key, vars } = formatCountdownKey(deadline);

  const styles: Record<string, { bg: string; fg: string; border?: string }> = {
    ok: {
      bg: "var(--color-deadline-ok-bg)",
      fg: "var(--color-deadline-ok-fg)",
    },
    soon: {
      bg: "var(--color-deadline-soon-bg)",
      fg: "var(--color-deadline-soon-fg)",
    },
    overdue: {
      bg: "var(--color-deadline-overdue-bg)",
      fg: "var(--color-deadline-overdue-fg)",
      border: "var(--color-deadline-overdue-border)",
    },
  };
  const s = styles[state];

  return (
    <span
      aria-label={`${t("deadline.label")}: ${t(key, vars)}`}
      className={[
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium",
        state === "overdue" ? "border" : "",
        className ?? "",
      ].join(" ")}
      style={{
        background: s.bg,
        color: s.fg,
        borderColor: s.border,
      }}
    >
      <Clock aria-hidden size={11} />
      {t(key, vars)}
    </span>
  );
}
