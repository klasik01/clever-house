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
 * Native <select> with <optgroup> — renders as OS picker wheel on mobile
 * with clear visual group separation. Zero custom UI surface.
 *
 * V7: picks up user-managed locations via useLocations (with DEFAULTS fallback
 * while the first snapshot is pending).
 */
export default function LocationPicker({ value, onChange, disabled }: Props) {
  const t = useT();
  const { user } = useAuth();
  const { locations } = useLocations(Boolean(user));
  const groups = locationsByGroup(locations);
  const current = value ?? "";

  return (
    <select
      value={current}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={t("detail.locationLabel")}
      className="min-h-tap w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-line-focus focus:outline-none disabled:opacity-60"
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
  );
}
