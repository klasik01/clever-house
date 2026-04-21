import { CheckCheck, CheckCircle2, CircleSlash, Hammer, Hourglass, HelpCircle, Inbox, Lightbulb, XCircle } from "lucide-react";
import type { TaskStatus, TaskType } from "@/types";
import { useT } from "@/i18n/useT";
import { mapLegacyOtazkaStatus, statusLabel } from "@/lib/status";

interface Props {
  status: TaskStatus;
  size?: "sm" | "md";
  /** Type context — required for per-role otazka labelling + legacy mapping. */
  type?: TaskType;
  /** Pass the current viewer role so ON_CLIENT_SITE / ON_PM_SITE can use the right translation. */
  isPm?: boolean;
}

/**
 * Small colored pill with dot + label for a task status.
 * Colors pull from semantic status tokens (status.*-fg / bg / border).
 */
export default function StatusBadge({ status, size = "sm", type, isPm = false }: Props) {
  const t = useT();
  // Normalise legacy otazka statuses so old records render with the new palette.
  const display: TaskStatus = type === "otazka" ? mapLegacyOtazkaStatus(status) : (isKnownStatus(status) ? status : "Nápad");
  const { bg, fg, dot } = statusColors(display);

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
        className="inline-flex items-center"
        style={{ color: dot }}
      >
        {statusIcon(display)}
      </span>
      {statusLabel(t, display, { isPm, type })}
    </span>
  );
}

/** All possible status values, including legacy otazka labels (for StatusSelect filter). */
export const ALL_STATUSES: TaskStatus[] = [
  "Nápad",
  "Otázka",
  "Čekám",
  "Rozhodnuto",
  "Ve stavbě",
  "Hotovo",
  "ON_PM_SITE",
  "ON_CLIENT_SITE",
  "BLOCKED",
  "CANCELED",
  "DONE",
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
    // --- V5 canonical otazka statuses ---
    case "ON_PM_SITE":
      // Ball on PM — reuses the warmer oak ("Otázka") palette.
      return {
        bg: "var(--color-status-otazka-bg)",
        fg: "var(--color-status-otazka-fg)",
        dot: "var(--color-status-otazka-fg)",
        border: "var(--color-status-otazka-border)",
      };
    case "ON_CLIENT_SITE":
      // Ball on OWNER — reuses the "Čekám" palette (slightly deeper).
      return {
        bg: "var(--color-status-cekam-bg)",
        fg: "var(--color-status-cekam-fg)",
        dot: "var(--color-status-cekam-fg)",
        border: "var(--color-status-cekam-border)",
      };
    case "BLOCKED":
      // Externally blocked — use danger tokens so it visibly stands out.
      return {
        bg: "var(--color-status-danger-bg)",
        fg: "var(--color-status-danger-fg)",
        dot: "var(--color-status-danger-fg)",
        border: "var(--color-status-danger-border)",
      };
    case "CANCELED":
      // Withdrawn — neutral stone, echoes Nápad so it recedes visually.
      return {
        bg: "var(--color-status-napad-bg)",
        fg: "var(--color-status-napad-fg)",
        dot: "var(--color-status-napad-fg)",
        border: "var(--color-status-napad-border)",
      };
    case "DONE":
      return {
        bg: "var(--color-status-hotovo-bg)",
        fg: "var(--color-status-hotovo-fg)",
        dot: "var(--color-status-hotovo-fg)",
        border: "var(--color-status-hotovo-border)",
      };
    // --- Legacy otazka + all nápad statuses ---
    case "Otázka":
      return {
        bg: "var(--color-status-otazka-bg)",
        fg: "var(--color-status-otazka-fg)",
        dot: "var(--color-status-otazka-fg)",
        border: "var(--color-status-otazka-border)",
      };
    case "Čekám":
      return {
        bg: "var(--color-status-cekam-bg)",
        fg: "var(--color-status-cekam-fg)",
        dot: "var(--color-status-cekam-fg)",
        border: "var(--color-status-cekam-border)",
      };
    case "Rozhodnuto":
      return {
        bg: "var(--color-status-rozhodnuto-bg)",
        fg: "var(--color-status-rozhodnuto-fg)",
        dot: "var(--color-status-rozhodnuto-fg)",
        border: "var(--color-status-rozhodnuto-border)",
      };
    case "Ve stavbě":
      return {
        bg: "var(--color-status-vestavbe-bg)",
        fg: "var(--color-status-vestavbe-fg)",
        dot: "var(--color-status-vestavbe-fg)",
        border: "var(--color-status-vestavbe-border)",
      };
    case "Hotovo":
      return {
        bg: "var(--color-status-hotovo-bg)",
        fg: "var(--color-status-hotovo-fg)",
        dot: "var(--color-status-hotovo-fg)",
        border: "var(--color-status-hotovo-border)",
      };
    case "Nápad":
    default:
      return {
        bg: "var(--color-status-napad-bg)",
        fg: "var(--color-status-napad-fg)",
        dot: "var(--color-status-napad-fg)",
        border: "var(--color-status-napad-border)",
      };
  }
}

/** Contextual icon per status for scannability at glance. */
export function statusIcon(s: TaskStatus): React.ReactNode {
  switch (s) {
    // V5 canonical
    case "ON_PM_SITE":
      return <HelpCircle aria-hidden size={11} />;
    case "ON_CLIENT_SITE":
      return <Inbox aria-hidden size={11} />;
    case "BLOCKED":
      return <CircleSlash aria-hidden size={11} />;
    case "CANCELED":
      return <XCircle aria-hidden size={11} />;
    case "DONE":
      return <CheckCheck aria-hidden size={11} />;
    // Legacy
    case "Otázka":
      return <HelpCircle aria-hidden size={11} />;
    case "Čekám":
      return <Hourglass aria-hidden size={11} />;
    case "Rozhodnuto":
      return <CheckCircle2 aria-hidden size={11} />;
    case "Ve stavbě":
      return <Hammer aria-hidden size={11} />;
    case "Hotovo":
      return <CheckCheck aria-hidden size={11} />;
    case "Nápad":
    default:
      return <Lightbulb aria-hidden size={11} />;
  }
}
