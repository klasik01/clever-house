import { ChevronDown, MapPin } from "lucide-react";
import { locationsByGroup } from "@/lib/locations";
import { useLocations } from "@/hooks/useLocations";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";

interface Props {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

/**
 * V19 — compact inline location selector styled as a category-like badge.
 * Same visual language as CategoryPicker chips: rounded-pill, bg-bg-subtle,
 * text-xs, MapPin icon. Contains a native <select> for the dropdown.
 */
export default function LocationPickerInline({ value, onChange, disabled }: Props) {
  const t = useT();
  const { user } = useAuth();
  const { locations } = useLocations(Boolean(user));
  const groups = locationsByGroup(locations);
  const current = value ?? "";
  const selectedLabel = current
    ? locations.find((l) => l.id === current)?.label ?? t("detail.locationNone")
    : t("detail.locationNone");

  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-pill bg-bg-subtle px-3 py-1.5 text-sm text-ink-muted">
      <MapPin aria-hidden size={11} className="shrink-0" />
      <span className="pointer-events-none">{selectedLabel}</span>
      <ChevronDown aria-hidden size={11} className="shrink-0 text-ink-subtle" />
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={t("detail.locationLabel")}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        <option value="">{t("detail.locationNone")}</option>
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
    </span>
  );
}
