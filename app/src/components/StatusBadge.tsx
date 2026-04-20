import type { TaskStatus } from "@/types";
import { useT } from "@/i18n/useT";

interface Props {
  status: TaskStatus;
  size?: "sm" | "md";
}

/**
 * Small colored pill with dot + label for a task status.
 * Colors pull from semantic status tokens (status.*-fg / bg / border).
 */
export default function StatusBadge({ status, size = "sm" }: Props) {
  const t = useT();
  const safeStatus: TaskStatus = isKnownStatus(status) ? status : "Nápad";
  const { bg, fg, dot } = statusColors(safeStatus);

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-pill font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
      ].join(" ")}
      style={{ backgroundColor: bg, color: fg }}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-pill"
        style={{ backgroundColor: dot }}
      />
      {t(`status.${safeStatus}`)}
    </span>
  );
}

export const ALL_STATUSES: TaskStatus[] = [
  "Nápad",
  "Otázka",
  "Čekám",
  "Rozhodnuto",
  "Ve stavbě",
  "Hotovo",
];

function isKnownStatus(v: unknown): v is TaskStatus {
  return typeof v === "string" && (ALL_STATUSES as string[]).includes(v);
}

/**
 * Returns CSS var() references per status, wired to design tokens.
 * Always returns a valid object — never undefined — so consumers can safely
 * destructure. Unknown input falls back to neutral (Nápad) styling.
 */
export function statusColors(s: TaskStatus): {
  bg: string;
  fg: string;
  dot: string;
  border: string;
} {
  switch (s) {
    case "Otázka":
      return {
        bg: "var(--color-status-info-bg)",
        fg: "var(--color-status-info-fg)",
        dot: "var(--color-status-info-fg)",
        border: "var(--color-status-info-border)",
      };
    case "Čekám":
      return {
        bg: "var(--color-status-warning-bg)",
        fg: "var(--color-status-warning-fg)",
        dot: "var(--color-status-warning-fg)",
        border: "var(--color-status-warning-border)",
      };
    case "Rozhodnuto":
      return {
        bg: "var(--color-status-success-bg)",
        fg: "var(--color-status-success-fg)",
        dot: "var(--color-status-success-fg)",
        border: "var(--color-status-success-border)",
      };
    case "Ve stavbě":
      return {
        bg: "var(--color-warm-subtle)",
        fg: "var(--color-warm-default)",
        dot: "var(--color-warm-default)",
        border: "var(--color-warm-default)",
      };
    case "Hotovo":
      return {
        bg: "var(--color-status-success-bg)",
        fg: "var(--color-status-success-fg)",
        dot: "var(--color-status-success-fg)",
        border: "var(--color-status-success-border)",
      };
    case "Nápad":
    default:
      return {
        bg: "var(--color-bg-muted)",
        fg: "var(--color-text-muted)",
        dot: "var(--color-text-subtle)",
        border: "var(--color-border-default)",
      };
  }
}
