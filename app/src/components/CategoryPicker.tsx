import type { Category } from "@/types";
import { useT } from "@/i18n/useT";

interface Props {
  value: string | null | undefined;
  categories: Category[];
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

/**
 * Native <select> — best-in-class mobile UX (iOS picker wheel, Android wheel),
 * and zero custom UI surface for this MVP.
 */
export default function CategoryPicker({ value, categories, onChange, disabled }: Props) {
  const t = useT();
  const current = value ?? "";

  return (
    <select
      value={current}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={t("detail.categoryLabel")}
      className="min-h-tap w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-line-focus focus:outline-none disabled:opacity-60"
    >
      <option value="">{t("detail.categoryNone")}</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
