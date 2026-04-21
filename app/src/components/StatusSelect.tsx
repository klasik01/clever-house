import { Check } from "lucide-react";
import type { TaskStatus, TaskType } from "@/types";
import { useT } from "@/i18n/useT";
import { ALL_STATUSES, statusColors, statusIcon } from "./StatusBadge";

interface Props {
  value: TaskStatus;
  onChange: (next: TaskStatus) => void;
  disabled?: boolean;
  /**
   * Filters the visible status set to what's sensible for this task type:
   * - napad: no "Otázka" / "Čekám" (those are Projektant-workflow states)
   * - otazka: no "Nápad"
   * Falls back to ALL_STATUSES when omitted.
   */
  type?: TaskType;
}

const NAPAD_HIDDEN: TaskStatus[] = ["Otázka", "Čekám"];
const OTAZKA_HIDDEN: TaskStatus[] = ["Nápad"];

/**
 * Segmented control for status. Responsive:
 * - < 420px viewport: 2-row flex wrap (no horizontal scroll on iPhone SE).
 * - ≥ 420px: single-row scroll snap if overflow (desktop rarely hits this).
 * role="radiogroup" + aria-checked per option.
 */
export default function StatusSelect({ value, onChange, disabled, type }: Props) {
  const t = useT();
  const hidden =
    type === "napad" ? NAPAD_HIDDEN : type === "otazka" ? OTAZKA_HIDDEN : [];
  // Always keep the currently selected status visible even if it's "hidden" for
  // this type — prevents ghost state for legacy records with mismatched status.
  const visible = ALL_STATUSES.filter((s) => !hidden.includes(s) || s === value);

  return (
    <div
      role="radiogroup"
      aria-label={t("status.label")}
      className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:overflow-x-auto sm:-mx-1 sm:px-1 sm:pb-1 sm:snap-x"
      style={{ scrollbarWidth: "none" }}
    >
      {visible.map((s) => {
        const active = s === value;
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
              "sm:snap-start inline-flex items-center gap-1.5 shrink-0 min-h-tap rounded-pill px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
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
            {t(`status.${s}`)}
          </button>
        );
      })}
    </div>
  );
}
