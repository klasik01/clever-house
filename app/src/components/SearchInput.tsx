import { Search, X } from "lucide-react";
import { useT } from "@/i18n/useT";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** aria-label + visible šroubek — defaults to generic "Hledat". */
  ariaLabel?: string;
}

/**
 * Small search pill: leading magnifier + textbox + trailing X clear button
 * (only when value is non-empty). Live-filters as the user types.
 */
export default function SearchInput({ value, onChange, placeholder, ariaLabel }: Props) {
  const t = useT();
  const label = ariaLabel ?? t("search.ariaLabel");
  return (
    <label className="flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-3 py-1.5 focus-within:border-line-focus transition-colors">
      <span aria-hidden className="shrink-0 text-ink-subtle">
        <Search size={16} aria-hidden />
      </span>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("search.placeholder")}
        className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-subtle focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("search.clear")}
          className="grid size-6 place-items-center rounded-full text-ink-subtle hover:text-ink hover:bg-bg-subtle"
        >
          <X aria-hidden size={14} />
        </button>
      )}
    </label>
  );
}
