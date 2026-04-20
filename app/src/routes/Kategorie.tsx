import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  seedCategoriesIfEmpty,
} from "@/lib/categories";
import { useT } from "@/i18n/useT";
import type { Category } from "@/types";

export default function Kategorie() {
  const t = useT();
  const { user } = useAuth();
  const { categories, loading, error } = useCategories(Boolean(user));
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  // Seed defaults on first visit (idempotent guard inside).
  useEffect(() => {
    if (!user) return;
    seedCategoriesIfEmpty(user.uid).catch((e) => console.error("seed failed", e));
  }, [user]);

  async function handleAdd() {
    if (!user || !newLabel.trim() || busy) return;
    setBusy(true);
    try {
      await createCategory(newLabel, user.uid);
      setNewLabel("");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(c: Category) {
    const ok = window.confirm(t("kategorie.confirmDelete", { name: c.label }));
    if (!ok) return;
    await deleteCategory(c.id);
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-4" aria-labelledby="cat-heading">
      <h2 id="cat-heading" className="mb-2 text-xl font-semibold tracking-tight text-ink">
        {t("kategorie.pageTitle")}
      </h2>
      <p className="mb-4 text-sm text-ink-muted">{t("kategorie.hint")}</p>

      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t("kategorie.addPlaceholder")}
          className="min-h-tap flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newLabel.trim() || busy}
          className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
          aria-label={t("kategorie.addButton")}
        >
          <Plus aria-hidden size={18} />
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <p role="alert" className="text-sm text-[color:var(--color-status-danger-fg)]">
            {t("kategorie.loadFailed")}
          </p>
        ) : categories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
            {t("kategorie.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-md bg-surface ring-1 ring-line">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} onDelete={() => handleDelete(c)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CategoryRow({ category, onDelete }: { category: Category; onDelete: () => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.label);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(category.label);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, category.label]);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === category.label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await renameCategory(category.id, trimmed);
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(category.label);
    setEditing(false);
  }

  return (
    <li className="flex items-center gap-2 px-4 py-2">
      {editing ? (
        <>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            disabled={saving}
            className="min-h-tap flex-1 rounded-sm bg-transparent px-1 py-1 text-base text-ink focus:outline-none focus:bg-bg-subtle/60"
          />
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            aria-label="Uložit"
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-accent hover:bg-bg-subtle"
          >
            <Check aria-hidden size={18} />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label="Zrušit"
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
          >
            <X aria-hidden size={18} />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left min-h-tap text-base text-ink hover:text-accent"
            aria-label={`${t("kategorie.rename")}: ${category.label}`}
          >
            {category.label}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("kategorie.rename")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink"
          >
            <Pencil aria-hidden size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("kategorie.delete")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-[color:var(--color-status-danger-fg)]"
          >
            <Trash2 aria-hidden size={16} />
          </button>
        </>
      )}
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="h-12 rounded-md bg-surface ring-1 ring-line animate-pulse" />
      ))}
    </ul>
  );
}
