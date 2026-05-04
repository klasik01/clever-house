import { useState } from "react";
import { ArrowLeft, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { deleteBudgetCategory } from "@/lib/budget/categories";
import BudgetCategoryModal from "@/components/budget/BudgetCategoryModal";
import ConfirmDialog from "@/components/budget/ConfirmDialog";
import { ROUTES } from "@/lib/routes";
import type { BudgetCategory } from "@/types";

export default function CategoriesManage() {
  const t = useT();
  const navigate = useNavigate();
  const state = useBudgetCategories();

  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; category: BudgetCategory }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetCategory | null>(null);

  async function handleDelete(c: BudgetCategory) {
    try {
      await deleteBudgetCategory(c.id);
    } catch (err) {
      console.error("delete category failed", err);
      alert(t("budget.category.errorDelete"));
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <section
      aria-labelledby="rozpocet-categories-heading"
      className="mx-auto max-w-xl space-y-4 px-4 py-6"
    >
      <button
        type="button"
        onClick={() => navigate(ROUTES.nastaveni)}
        className="inline-flex items-center gap-1 -ml-2 px-2 py-1 text-sm text-ink-link hover:text-ink-link-hover"
      >
        <ArrowLeft aria-hidden size={16} />
        {t("settings.title")}
      </button>

      <header className="flex items-center justify-between gap-3">
        <h2
          id="rozpocet-categories-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("budget.category.manageTitle")}
        </h2>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          <Plus aria-hidden size={16} />
          {t("budget.category.addCta")}
        </button>
      </header>

      <p className="text-sm text-ink-muted leading-relaxed">
        {t("budget.category.intro")}
      </p>

      {state.status === "loading" ? (
        <p aria-busy className="text-sm text-ink-muted">
          {t("budget.category.loading")}
        </p>
      ) : state.status === "error" ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {t("budget.category.errorLoad")}
        </p>
      ) : state.categories.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center space-y-3">
          <p className="text-2xl" aria-hidden>🏷️</p>
          <p className="text-base font-semibold text-ink">
            {t("budget.category.emptyTitle")}
          </p>
          <p className="mx-auto max-w-md text-sm text-ink-muted leading-relaxed">
            {t("budget.category.emptyDesc")}
          </p>
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
          >
            <Plus aria-hidden size={16} />
            {t("budget.category.addCta")}
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {state.categories.map((c) => (
            <li key={c.id}>
              <div className="flex items-stretch rounded-md border border-line bg-surface">
                <div className="flex flex-1 items-center gap-3 px-4 py-3">
                  <Tag aria-hidden size={14} className="text-ink-muted shrink-0" />
                  <span className="text-sm text-ink truncate flex-1">{c.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "edit", category: c })}
                  aria-label={t("budget.category.editAria", { label: c.label })}
                  className="grid size-tap place-items-center border-l border-line text-ink-muted hover:bg-bg-subtle"
                >
                  <Pencil aria-hidden size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(c)}
                  aria-label={t("budget.category.deleteAria", { label: c.label })}
                  className="grid size-tap place-items-center border-l border-line text-ink-muted hover:bg-bg-subtle"
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <BudgetCategoryModal
          open
          mode={modal.mode}
          category={modal.mode === "edit" ? modal.category : null}
          onClose={() => setModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("budget.category.deleteConfirmTitle")}
        message={
          deleteTarget
            ? t("budget.category.deleteConfirmBody", { label: deleteTarget.label })
            : ""
        }
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </section>
  );
}
