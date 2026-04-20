import { MapPin } from "lucide-react";
import { LOCATIONS, locationsByGroup } from "@/lib/locations";
import { useT } from "@/i18n/useT";

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
}

export default function LocationFilterChip({ value, onChange }: Props) {
  const t = useT();
  const selected = value ? LOCATIONS.find((l) => l.id === value) : null;
  const label = selected ? selected.label : t("filter.locationAll");
  const groups = locationsByGroup();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("filter.locationAriaLabel")}</span>
      <span
        aria-hidden
        className={[
          "inline-flex items-center gap-1.5 min-h-tap rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
          selected
            ? "bg-accent text-accent-on border-transparent"
            : "bg-transparent text-ink-muted border-line",
        ].join(" ")}
      >
        <MapPin size={14} aria-hidden />
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t("filter.locationAriaLabel")}
      >
        <option value="">{t("filter.locationAll")}</option>
        {groups.map((g) => (
          <optgroup key={g.group} label={t(g.i18nKey)}>
            {g.items.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
