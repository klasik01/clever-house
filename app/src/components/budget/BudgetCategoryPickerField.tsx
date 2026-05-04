import { Tag, X as XIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { ROUTES } from "@/lib/routes";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export default function BudgetCategoryPickerField({
  value,
  onChange,
  disabled,
}: Props) {
  const t = useT();
  const state = useBudgetCategories();

  if (state.status !== "ready") {
    return (
      <div className="space-y-1">
        <span className="block text-sm font-medium text-ink">
          {t("budget.category.pickerLabel")}
        </span>
        <p className="text-xs text-ink-subtle" aria-busy>
          {t("budget.category.loading")}
        </p>
      </div>
    );
  }

  if (state.categories.length === 0) {
    return (
      <div className="space-y-1">
        <span className="block text-sm font-medium text-ink">
          {t("budget.category.pickerLabel")}
        </span>
        <p className="text-xs text-ink-subtle">
          {t("budget.category.pickerEmpty")}{" "}
          <Link
            to={ROUTES.nastaveniRozpocetKategorie}
            className="text-ink-link hover:text-ink-link-hover underline"
          >
            {t("budget.category.manageTitle")}
          </Link>
        </p>
      </div>
    );
  }

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-ink">
        {t("budget.category.pickerLabel")}
      </span>
      <div className="flex flex-wrap gap-2">
        {state.categories.map((c) => {
          const selected = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              disabled={disabled}
              aria-pressed={selected}
              className={[
                "inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors",
                selected
                  ? "border-accent bg-accent text-accent-on"
                  : "border-line bg-surface text-ink-muted hover:bg-bg-subtle",
              ].join(" ")}
            >
              {selected ? (
                <XIcon aria-hidden size={11} />
              ) : (
                <Tag aria-hidden size={11} />
              )}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
