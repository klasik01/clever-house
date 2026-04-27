import { ChevronDown, Milestone } from "lucide-react";
import { useT } from "@/i18n/useT";

interface Props {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

/**
 * V19 — placeholder phase picker. Same visual style as LocationPickerInline.
 * Phases are hardcoded for now; will be replaced with dynamic data later.
 */

const PHASES = [
  { id: "projekt", label: "Projekt" },
  { id: "zaklady", label: "Základy" },
  { id: "hruba-stavba", label: "Hrubá stavba" },
  { id: "strecha", label: "Střecha" },
  { id: "okna-dvere", label: "Okna a dveře" },
  { id: "instalace", label: "Instalace" },
  { id: "omitky", label: "Omítky" },
  { id: "podlahy", label: "Podlahy" },
  { id: "dokonceni", label: "Dokončení" },
  { id: "zahrada", label: "Zahrada" },
];

export default function PhasePickerInline({ value, onChange, disabled }: Props) {
  const t = useT();
  const current = value ?? "";
  const selectedLabel = current
    ? PHASES.find((p) => p.id === current)?.label ?? t("detail.phaseNone")
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
        {PHASES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </span>
  );
}
