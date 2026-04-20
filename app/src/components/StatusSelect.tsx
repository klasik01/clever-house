import type { TaskStatus } from "@/types";
import { useT } from "@/i18n/useT";
import { ALL_STATUSES, statusColors } from "./StatusBadge";

interface Props {
  value: TaskStatus;
  onChange: (next: TaskStatus) => void;
  disabled?: boolean;
}

/**
 * Segmented control for status. Horizontally scrollable on narrow viewports.
 * `role="radiogroup"` + `aria-checked` per option for screen readers.
 */
export default function StatusSelect({ value, onChange, disabled }: Props) {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t("status.label")}
      className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 scroll-smooth snap-x"
      style={{ scrollbarWidth: "none" }}
    >
      {ALL_STATUSES.map((s) => {
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
              "snap-start shrink-0 min-h-tap rounded-pill px-3 py-1.5 text-sm font-medium transition-colors",
              "border",
              active ? "" : "hover:bg-bg-subtle",
              disabled ? "opacity-40 cursor-not-allowed" : "",
            ].join(" ")}
            style={{
              backgroundColor: active ? c.bg : "transparent",
              color: active ? c.fg : "var(--color-text-muted)",
              borderColor: active ? c.border : "var(--color-border-default)",
            }}
          >
            {t(`status.${s}`)}
          </button>
        );
      })}
    </div>
  );
}
