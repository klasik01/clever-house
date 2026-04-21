import { Flame, Minus, MoveDown } from "lucide-react";
import type { TaskPriority } from "@/types";
import { useT } from "@/i18n/useT";

interface Props {
  value: TaskPriority | null;
  onChange: (next: TaskPriority | null) => void;
}

const ORDER: TaskPriority[] = ["P1", "P2", "P3"];

function iconFor(p: TaskPriority) {
  if (p === "P1") return <Flame size={14} aria-hidden />;
  if (p === "P3") return <MoveDown size={14} aria-hidden />;
  return <Minus size={14} aria-hidden />;
}

/**
 * Priority picker styled as a pill with a native <select> behind it —
 * mirrors the other filter chips (Category/Location) for consistency.
 */
export default function PriorityFilterChip({ value, onChange }: Props) {
  const t = useT();
  const label = value ? t(`priority.${value}`) : t("ukoly.filterPriorityAll");

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("ukoly.filterPriority")}</span>
      <span
        aria-hidden
        className={[
          "inline-flex items-center gap-1.5 min-h-tap rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
          value
            ? "bg-accent text-accent-on border-transparent"
            : "bg-transparent text-ink-muted border-line",
        ].join(" ")}
      >
        {value ? iconFor(value) : <Flame size={14} aria-hidden />}
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value as TaskPriority) || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t("ukoly.filterPriority")}
      >
        <option value="">{t("ukoly.filterPriorityAll")}</option>
        {ORDER.map((p) => (
          <option key={p} value={p}>
            {t(`priority.${p}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
