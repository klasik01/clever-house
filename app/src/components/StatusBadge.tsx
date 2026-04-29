import { CheckCheck, CircleSlash, Inbox, XCircle } from "lucide-react";
import type { TaskStatus, TaskType } from "@/types";
import { useT } from "@/i18n/useT";
import { mapLegacyOtazkaStatus, statusLabel } from "@/lib/status";

interface Props {
  status: TaskStatus;
  size?: "sm" | "md";
  /** Type context — required for legacy mapping of otázka statuses. */
  type?: TaskType;
  /** Kept for API compat; V10 status labels are role-agnostic. */
  isPm?: boolean;
}

/**
 * Small colored pill with dot + label for a task status.
 * Colors pull from semantic status tokens (status.*-fg / bg / border).
 */
export default function StatusBadge({ status, size = "sm", type }: Props) {
  const t = useT();
  // V14 — úkol shares the otázka mapper.
  // V23 — napad (téma) now shares the canonical otázka/úkol status set.
  const display: TaskStatus = (type === "otazka" || type === "ukol" || type === "napad") ? mapLegacyOtazkaStatus(status) : status;
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
      {statusLabel(t, display, { type })}
    </span>
  );
}

/** V25 — all task status values (canonical 4). */
export const ALL_STATUSES: TaskStatus[] = ["OPEN", "BLOCKED", "CANCELED", "DONE"];


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
    // --- V10 canonical otazka statuses ---
    case "OPEN":
      // Active úkol — reuses the warmer oak palette (familiar visual).
      return {
        bg: "var(--color-status-otazka-bg)",
        fg: "var(--color-status-otazka-fg)",
        dot: "var(--color-status-otazka-fg)",
        border: "var(--color-status-otazka-border)",
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
    default:
      // V25 — defensive: pokud by Firestore vrátilo neočekávaný legacy
      // string, render ho jako OPEN. Migration script ošetřil všechny
      // historické tasky, ale paranoid bridge.
      return {
        bg: "var(--color-status-otazka-bg)",
        fg: "var(--color-status-otazka-fg)",
        dot: "var(--color-status-otazka-fg)",
        border: "var(--color-status-otazka-border)",
      };
  }
}

/** Contextual icon per status for scannability at glance. */
export function statusIcon(s: TaskStatus): React.ReactNode {
  // V25 — canonical 4. Legacy hodnoty byly migrovány skriptem
  // 2026-04-29-V25-canonical-status.mjs; defensive default kdyby
  // se i přesto objevil jiný string (vrátí OPEN icon).
  switch (s) {
    case "OPEN":
      return <Inbox aria-hidden size={11} />;
    case "BLOCKED":
      return <CircleSlash aria-hidden size={11} />;
    case "CANCELED":
      return <XCircle aria-hidden size={11} />;
    case "DONE":
      return <CheckCheck aria-hidden size={11} />;
    default:
      return <Inbox aria-hidden size={11} />;
  }
}
