import { Milestone } from "lucide-react";
import { usePhases } from "@/hooks/usePhases";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
}

export default function PhaseFilterChip({ value, onChange }: Props) {
  const t = useT();
  const { user } = useAuth();
  const { phases } = usePhases(Boolean(user));
  const selected = value ? phases.find((p) => p.id === value) : null;
  const label = selected ? selected.label : t("filter.phaseAll");

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("filter.phaseAriaLabel")}</span>
      <span
        aria-hidden
        className={[
          "inline-flex items-center gap-1 rounded-pill border px-2.5 py-1.5 text-xs font-medium transition-colors",
          selected
            ? "bg-accent text-accent-on border-transparent"
            : "bg-transparent text-ink-muted border-line",
        ].join(" ")}
      >
        <Milestone size={12} aria-hidden />
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t("filter.phaseAriaLabel")}
      >
        <option value="">{t("filter.phaseAll")}</option>
        {phases.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
