import type { TaskStatus } from "@/types";
import { OTAZKA_STATUSES, statusLabel } from "@/lib/status";
import { statusIcon } from "./StatusBadge";
import { useT } from "@/i18n/useT";

interface Props {
  value: TaskStatus | null;
  onChange: (next: TaskStatus | null) => void;
  /** Viewer role — determines which ON_CLIENT_SITE/ON_PM_SITE label is shown. */
  isPm?: boolean;
}

/**
 * Status filter for the Úkoly page. Only offers V5 canonical otázka statuses
 * (ON_PM_SITE, ON_CLIENT_SITE, BLOCKED, CANCELED, DONE). Styled like the other
 * filter chips — pill + native select.
 */
export default function StatusFilterChip({ value, onChange, isPm }: Props) {
  const t = useT();
  const selectedLabel = value
    ? statusLabel(t, value, { isPm, type: "otazka" })
    : t("ukoly.filterStatusAll");

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("ukoly.filterStatus")}</span>
      <span
        aria-hidden
        className={[
          "inline-flex items-center gap-1.5 min-h-tap rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
          value
            ? "bg-accent text-accent-on border-transparent"
            : "bg-transparent text-ink-muted border-line",
        ].join(" ")}
      >
        {value ? statusIcon(value) : null}
        {selectedLabel}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value as TaskStatus) || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t("ukoly.filterStatus")}
      >
        <option value="">{t("ukoly.filterStatusAll")}</option>
        {OTAZKA_STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel(t, s, { isPm, type: "otazka" })}
          </option>
        ))}
      </select>
    </label>
  );
}
