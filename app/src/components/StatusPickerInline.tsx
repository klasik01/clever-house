import { ChevronDown } from "lucide-react";
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
  type?: TaskType;
  isPm?: boolean;
}

/**
 * V19 — compact inline status picker styled as a badge with native <select>.
 * Shows status icon + colored badge, same language as other inline pickers.
 */
export default function StatusPickerInline({ value, onChange, disabled, type, isPm = false }: Props) {
  const t = useT();

  // V23 — napad (téma) now shares the canonical otázka/úkol status set.
  const current: TaskStatus = (type === "otazka" || type === "ukol" || type === "napad")
    ? mapLegacyOtazkaStatus(value)
    : value;

  const options: TaskStatus[] = (OTAZKA_STATUSES as TaskStatus[]);

  const c = statusColors(current);
  const label = statusLabel(t, current, { isPm, type });

  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm border"
      style={{
        backgroundColor: c.bg,
        color: c.fg,
        borderColor: c.dot,
      }}
    >
      <span aria-hidden className="inline-flex items-center" style={{ color: c.dot }}>
        {statusIcon(current)}
      </span>
      <span className="pointer-events-none">{label}</span>
      <ChevronDown aria-hidden size={11} className="shrink-0" />
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TaskStatus)}
        aria-label={t("status.label")}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {statusLabel(t, s, { isPm, type })}
          </option>
        ))}
      </select>
    </span>
  );
}
