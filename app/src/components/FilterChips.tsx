import { useT } from "@/i18n/useT";
import type { OpenClosedFilter } from "@/lib/filters";

interface Props {
  value: OpenClosedFilter;
  onChange: (next: OpenClosedFilter) => void;
  counts?: Partial<Record<OpenClosedFilter, number>>;
}

const OPTIONS: OpenClosedFilter[] = ["open", "all", "done"];

/** Chip strip — Vše / Otevřené / Hotové. Active chip uses accent color. */
export default function FilterChips({ value, onChange, counts }: Props) {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t("filter.ariaLabel")}
      className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 snap-x"
      style={{ scrollbarWidth: "none" }}
    >
      {OPTIONS.map((opt) => {
        const active = opt === value;
        const label = t(`filter.${opt}`);
        const count = counts?.[opt];
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={[
              "snap-start shrink-0 min-h-tap rounded-pill px-3 py-1.5 text-sm font-medium transition-colors border",
              active
                ? "bg-accent text-accent-on border-transparent"
                : "bg-transparent text-ink-muted border-line hover:bg-bg-subtle",
            ].join(" ")}
          >
            {label}
            {typeof count === "number" && (
              <span className={active ? "ml-1.5 opacity-80" : "ml-1.5 text-ink-subtle"}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
