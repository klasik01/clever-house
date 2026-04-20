import { useCallback, useState } from "react";
import { Lightbulb } from "lucide-react";
import Composer from "@/components/Composer";
import TaskList from "@/components/TaskList";
import FilterChips from "@/components/FilterChips";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import { useT } from "@/i18n/useT";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import { createTaskFromComposerInput } from "@/lib/createTaskFromComposerInput";
import type { TaskType } from "@/types";
import {
  applyCategory,
  applyLocation,
  applyOpenClosed,
  loadCategoryFilter,
  loadFilter,
  loadLocationFilter,
  saveCategoryFilter,
  saveFilter,
  saveLocationFilter,
  type OpenClosedFilter,
} from "@/lib/filters";

const KEY = "napady";

export default function Home() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const { show: showToast } = useToast();
  const [filter, setFilter] = useState<OpenClosedFilter>(() => loadFilter(KEY));
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    loadCategoryFilter(KEY)
  );
  const [locationId, setLocationId] = useState<string | null>(() =>
    loadLocationFilter(KEY)
  );

  function changeFilter(next: OpenClosedFilter) {
    setFilter(next);
    saveFilter(KEY, next);
  }
  function changeCategory(next: string | null) {
    setCategoryId(next);
    saveCategoryFilter(KEY, next);
  }
  function changeLocation(next: string | null) {
    setLocationId(next);
    saveLocationFilter(KEY, next);
  }

  const onSave = useCallback(
    async (text: string, type: TaskType, imageFiles: File[], linkUrls: string[]) => {
      if (!user) return;
      try {
        await createTaskFromComposerInput({
          text,
          type,
          imageFiles,
          linkUrls,
          uid: user.uid,
          onImageUploadError: () => showToast(t("composer.uploadFailed"), "error"),
        });
      } catch (e) {
        console.error(e);
        showToast(t("composer.saveFailed"), "error");
        throw e;
      }
    },
    [user, t, showToast]
  );

  const napady = tasks.filter((tk) => tk.type === "napad");
  const counts = {
    all: napady.length,
    open: napady.filter((x) => x.status !== "Hotovo").length,
    done: napady.filter((x) => x.status === "Hotovo").length,
  };
  const visible = applyLocation(
    applyCategory(applyOpenClosed(napady, filter), categoryId),
    locationId
  );

  return (
    <>
      <h2 id="capture-heading" className="sr-only">{t("tabs.capture")}</h2>
      <Composer onSave={onSave} />

      <section aria-label={t("aria.napadyList")} className="mx-auto max-w-xl px-4 pt-2 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips value={filter} onChange={changeFilter} counts={counts} />
          <CategoryFilterChip
            value={categoryId}
            categories={categories}
            onChange={changeCategory}
          />
          <LocationFilterChip value={locationId} onChange={changeLocation} />
        </div>

        <div className="mt-3">
          <TaskList
            tasks={visible}
            categories={categories}
            loading={loading}
            error={error}
            emptyTitle={t("list.emptyTitle")}
            emptyBody={t("list.emptyBody")}
            emptyIcon={<Lightbulb size={22} aria-hidden />}
            ariaLabel={t("aria.napadyList")}
          />
        </div>
      </section>
    </>
  );
}
