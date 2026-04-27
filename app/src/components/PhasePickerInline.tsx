import { ChevronDown, Milestone } from "lucide-react";
import { useT } from "@/i18n/useT";
import { usePhases } from "@/hooks/usePhases";

interface Props {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

/**
 * V23 — dynamic phase picker. Reads phases from Firestore via usePhases hook.
 * Same visual style as LocationPickerInline.
 */
export default function PhasePickerInline({ value, onChange, disabled }: Props) {
  const t = useT();
  const { phases } = usePhases(true);
  const current = value ?? "";
  const selectedLabel = current
    ? phases.find((p) => p.id === current)?.label ?? t("detail.phaseNone")
    : t("detail.phaseNone");

  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-pill bg-bg-subtle px-3 py-1.5 text-sm text-ink-muted">
      <Milestone aria-hidden size={13} className="shrink-0" />
      <span className="pointer-events-none">{selectedLabel}</span>
      <ChevronDown aria-hidden size={11} className="shrink-0 text-ink-subtle" />
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={t("detail.phaseLabel")}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        <option value="">{t("detail.phaseNone")}</option>
        {phases.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </span>
  );
}
