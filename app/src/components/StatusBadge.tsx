import { CheckCheck, CheckCircle2, Hammer, Hourglass, HelpCircle, Lightbulb } from "lucide-react";
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
        className="inline-flex items-center"
        style={{ color: dot }}
      >
        {statusIcon(safeStatus)}
      </span>
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
  // V3-polish: all statuses remapped to warm-earth (stone / oak / olive)
  // to stay coherent with the rest of the palette. Primitives vivid-colours
  // (info/warning/danger/success) are kept only for /prehled M2 banner.
  switch (s) {
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

/** V3-polish: contextual icon per status for scannability with toned-down colors. */
export function statusIcon(s: TaskStatus): React.ReactNode {
  switch (s) {
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
