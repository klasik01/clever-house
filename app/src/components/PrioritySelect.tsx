import { Check, Flame, Minus, MoveDown } from "lucide-react";
import { useT } from "@/i18n/useT";
import type { TaskPriority } from "@/types";

interface Props {
  value: TaskPriority | undefined;
  onChange: (next: TaskPriority) => void;
  disabled?: boolean;
}

const OPTIONS: TaskPriority[] = ["P1", "P2", "P3"];

/**
 * PrioritySelect — 3-button segmented control for otázka priority.
 * Uses V3 tokens `--color-priority-p[1-3]-*` for bg / fg / border.
 * Never color-only signal: each pill includes both text label ("P1") and dot.
 */
export default function PrioritySelect({ value, onChange, disabled }: Props) {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t("priority.label")}
      className="flex flex-wrap gap-1.5"
    >
      {OPTIONS.map((p) => {
        const active = p === value;
        const varSuffix = p.toLowerCase(); // p1 / p2 / p3
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(p)}
            className={[
              "inline-flex items-center gap-1.5 min-h-tap rounded-pill px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
              active ? "border-2 shadow-sm" : "border hover:bg-bg-subtle",
              disabled ? "opacity-40 cursor-not-allowed" : "",
            ].join(" ")}
            style={{
              backgroundColor: active ? `var(--color-priority-${varSuffix}-bg)` : "transparent",
              color: active ? `var(--color-priority-${varSuffix}-fg)` : "var(--color-text-muted)",
              borderColor: active ? `var(--color-priority-${varSuffix}-dot)` : "var(--color-border-default)",
            }}
          >
            {active && <Check aria-hidden size={14} className="shrink-0" />}
            <span
              aria-hidden
              className="grid size-4 place-items-center"
              style={{ color: `var(--color-priority-${varSuffix}-dot)` }}
            >
              {p === "P1" ? (
                <Flame aria-hidden size={14} />
              ) : p === "P2" ? (
                <Minus aria-hidden size={14} />
              ) : (
                <MoveDown aria-hidden size={14} />
              )}
            </span>
            <span>{t(`priority.${p}`)}</span>
            <span className="text-xs text-ink-subtle" aria-hidden>
              {t(`priority.${p}Long`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
