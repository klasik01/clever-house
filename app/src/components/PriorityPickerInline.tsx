import { ChevronDown, Flame, Minus, MoveDown } from "lucide-react";
import { useT } from "@/i18n/useT";
import type { TaskPriority } from "@/types";

interface Props {
  value: TaskPriority | undefined;
  onChange: (next: TaskPriority) => void;
  disabled?: boolean;
}

const OPTIONS: TaskPriority[] = ["P1", "P2", "P3"];

const ICON: Record<TaskPriority, React.ReactNode> = {
  P1: <Flame aria-hidden size={13} />,
  P2: <Minus aria-hidden size={13} />,
  P3: <MoveDown aria-hidden size={13} />,
};

/**
 * V19 — compact inline priority picker styled as a badge with native <select>.
 * Uses priority color tokens for the active value.
 */
export default function PriorityPickerInline({ value, onChange, disabled }: Props) {
  const t = useT();
  const current = value ?? "P2";
  const varSuffix = current.toLowerCase();

  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm border"
      style={{
        backgroundColor: `var(--color-priority-${varSuffix}-bg)`,
        color: `var(--color-priority-${varSuffix}-fg)`,
        borderColor: `var(--color-priority-${varSuffix}-dot)`,
      }}
    >
      <span style={{ color: `var(--color-priority-${varSuffix}-dot)` }}>
        {ICON[current]}
      </span>
      <span className="pointer-events-none">{t(`priority.${current}`)} {t(`priority.${current}Long`)}</span>
      <ChevronDown aria-hidden size={11} className="shrink-0" />
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TaskPriority)}
        aria-label={t("priority.label")}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        {OPTIONS.map((p) => (
          <option key={p} value={p}>
            {t(`priority.${p}`)} — {t(`priority.${p}Long`)}
          </option>
        ))}
      </select>
    </span>
  );
}
