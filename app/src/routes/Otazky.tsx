import { useState } from "react";
import TaskList from "@/components/TaskList";
import FilterChips from "@/components/FilterChips";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import {
  applyCategory,
  applyOpenClosed,
  loadCategoryFilter,
  loadFilter,
  saveCategoryFilter,
  saveFilter,
  type OpenClosedFilter,
} from "@/lib/filters";

const KEY = "otazky";

export default function Otazky() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    loadCategoryFilter(KEY)
  );

  const otazky = tasks.filter((tk) => tk.type === "otazka");
  const counts = {
    all: otazky.length,
    open: otazky.filter((x) => x.status !== "Hotovo").length,
    done: otazky.filter((x) => x.status === "Hotovo").length,
  };
  const visible = applyCategory(applyOpenClosed(otazky, filter), categoryId);

  return (
    <section aria-labelledby="otazky-heading" className="mx-auto max-w-xl px-4 pt-4 pb-4">
      <h2 id="otazky-heading" className="mb-3 text-xl font-semibold tracking-tight text-ink">
        {t("otazky.pageTitle")}
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          value={filter}
          onChange={(v) => {
            setFilter(v);
            saveFilter(KEY, v);
          }}
          counts={counts}
        />
        <CategoryFilterChip
          value={categoryId}
          categories={categories}
          onChange={(v) => {
            setCategoryId(v);
            saveCategoryFilter(KEY, v);
          }}
        />
      </div>

      <div className="mt-3">
        <TaskList
          tasks={visible}
          categories={categories}
          loading={loading}
          error={error}
          emptyTitle={t("otazky.emptyTitle")}
          emptyBody={t("otazky.emptyBody")}
          ariaLabel="Seznam otázek"
        />
      </div>
    </section>
  );
}
