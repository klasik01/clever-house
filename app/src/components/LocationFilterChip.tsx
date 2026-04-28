import { MapPin } from "lucide-react";
import { locationsByGroup } from "@/lib/locations";
import { useLocations } from "@/hooks/useLocations";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
}

export default function LocationFilterChip({ value, onChange }: Props) {
  const t = useT();
  const { user } = useAuth();
  const { locations } = useLocations(Boolean(user));
  const selected = value ? locations.find((l) => l.id === value) : null;
  const label = selected ? selected.label : t("filter.locationAll");
  const groups = locationsByGroup(locations);

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("filter.locationAriaLabel")}</span>
      <span
        aria-hidden
        className={[
          "inline-flex items-center gap-1 rounded-pill border px-2.5 py-1.5 text-xs font-medium transition-colors",
          selected
            ? "bg-accent text-accent-on border-transparent"
            : "bg-transparent text-ink-muted border-line",
        ].join(" ")}
      >
        <MapPin size={12} aria-hidden />
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
          g.items.length > 0 && (
            <optgroup key={g.group} label={t(g.i18nKey)}>
              {g.items.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.label}
                </option>
              ))}
            </optgroup>
          )
        ))}
      </select>
    </label>
  );
}
