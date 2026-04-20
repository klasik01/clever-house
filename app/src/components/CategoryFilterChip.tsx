import { Tag } from "lucide-react";
import type { Category } from "@/types";
import { useT } from "@/i18n/useT";

interface Props {
  value: string | null;
  categories: Category[];
  onChange: (next: string | null) => void;
}

/**
 * Native <select> styled as a pill. Shows current category label or "Všechny".
 * Mobile-first: tapping a native select opens the OS picker — ideal for 1-of-N.
 */
export default function CategoryFilterChip({ value, categories, onChange }: Props) {
  const t = useT();
  const selected = value ? categories.find((c) => c.id === value) : null;
  const label = selected ? selected.label : t("filter.categoryAll");

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("filter.categoryAriaLabel")}</span>
      <span
        aria-hidden
        className={[
          "inline-flex items-center gap-1.5 min-h-tap rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
          selected
            ? "bg-accent text-accent-on border-transparent"
            : "bg-transparent text-ink-muted border-line",
        ].join(" ")}
      >
        <Tag size={14} aria-hidden />
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t("filter.categoryAriaLabel")}
      >
        <option value="">{t("filter.categoryAll")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
