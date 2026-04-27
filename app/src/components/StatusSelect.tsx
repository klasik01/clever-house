import { Check } from "lucide-react";
import type { TaskStatus, TaskType } from "@/types";
import { useT } from "@/i18n/useT";
import { statusColors, statusIcon } from "./StatusBadge";
import {
  OTAZKA_STATUSES,
  mapLegacyOtazkaStatus,
  statusLabel,
} from "@/lib/status";

interface Props {
  value: TaskStatus;
  onChange: (next: TaskStatus) => void;
  disabled?: boolean;
  /**
   * Task type drives which status options are offered:
   * - napad  → V23 canonical set (OPEN, BLOCKED, CANCELED, DONE) — same as otázka/úkol
   * - otazka → V10 canonical set (OPEN, BLOCKED, CANCELED, DONE)
   */
  type?: TaskType;
  /** Viewer role — affects labels on ON_CLIENT_SITE / ON_PM_SITE chips. */
  isPm?: boolean;
}

/**
 * Segmented control for status. Responsive:
 * - < 420px viewport: 2-row flex wrap (no horizontal scroll on iPhone SE).
 * - ≥ 420px: single-row scroll snap if overflow (desktop rarely hits this).
 * role="radiogroup" + aria-checked per option.
 */
export default function StatusSelect({ value, onChange, disabled, type, isPm = false }: Props) {
  const t = useT();

  // Normalise legacy otazka values to canonical before comparing / rendering.
  // V14 — úkol shares the same canonical status mapper as otázka.
  // V23 — napad (téma) now shares the canonical otázka/úkol status set.
  const current: TaskStatus = (type === "otazka" || type === "ukol" || type === "napad") ? mapLegacyOtazkaStatus(value) : value;

  const options: TaskStatus[] =
    (type === "napad" || type === "otazka" || type === "ukol")
      ? (OTAZKA_STATUSES as TaskStatus[])
      : // No type context — fall back to canonical otazka/úkol set.
        (OTAZKA_STATUSES as TaskStatus[]);

  return (
    <div
      role="radiogroup"
      aria-label={t("status.label")}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((s) => {
        const active = s === current;
        const c = statusColors(s);
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={[
              "inline-flex items-center gap-1.5 shrink-0 min-h-tap rounded-pill px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
              active ? "border-2 shadow-sm" : "border hover:bg-bg-subtle",
              disabled ? "opacity-40 cursor-not-allowed" : "",
            ].join(" ")}
            style={{
              backgroundColor: active ? c.bg : "transparent",
              color: active ? c.fg : "var(--color-text-muted)",
              borderColor: active ? c.dot : "var(--color-border-default)",
            }}
          >
            {active && <Check aria-hidden size={14} className="shrink-0" />}
            <span aria-hidden className="inline-flex items-center" style={{ color: active ? c.dot : "var(--color-text-subtle)" }}>
              {statusIcon(s)}
            </span>
            {statusLabel(t, s, { isPm, type })}
          </button>
        );
      })}
    </div>
  );
}
