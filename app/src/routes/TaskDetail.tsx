import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, Trash2, HelpCircle, Notebook } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useTask } from "@/hooks/useTask";
import { deleteTask, updateTask } from "@/lib/tasks";
import StatusSelect from "@/components/StatusSelect";
import CategoryPicker from "@/components/CategoryPicker";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import type { TaskStatus } from "@/types";

const AUTOSAVE_DEBOUNCE_MS = 500;

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const state = useTask(id);
  const { user } = useAuth();
  const { categories } = useCategories(Boolean(user));

  // Editable local state. Initialized once from Firestore task; not re-synced on subsequent
  // snapshots to avoid fighting the user's keystrokes (last-write-wins is fine for this MVP).
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const initializedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);

  useEffect(() => {
    if (state.status === "ready" && !initializedRef.current) {
      setTitle(state.task.title);
      setBody(state.task.body);
      initializedRef.current = true;
    }
    // Re-initialize only if the route's :id changed
    if (state.status !== "ready") initializedRef.current = false;
  }, [state]);

  // Debounced auto-save
  useEffect(() => {
    if (state.status !== "ready" || !initializedRef.current) return;
    const orig = state.task;
    if (title === orig.title && body === orig.body) return;

    const handle = window.setTimeout(() => {
      persist({ title, body });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  async function persist(patch: { title: string; body: string }) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, patch);
      flashSaved();
    } catch (e) {
      console.error("auto-save failed", e);
    } finally {
      setSaving(false);
    }
  }

  function flushOnBlur() {
    if (state.status !== "ready") return;
    const orig = state.task;
    if (title === orig.title && body === orig.body) return;
    persist({ title, body });
  }

  function flashSaved() {
    setSavedVisible(true);
    window.setTimeout(() => setSavedVisible(false), 1500);
  }

  async function handleCategoryChange(nextId: string | null) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, { categoryId: nextId });
      flashSaved();
    } catch (e) {
      console.error("category update failed", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(next: TaskStatus) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, { status: next });
      flashSaved();
    } catch (e) {
      console.error("status update failed", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (state.status !== "ready") return;
    if (!window.confirm(t("detail.confirmDelete"))) return;
    await deleteTask(state.task.id);
    navigate(-1);
  }

  // ---- Render states ----

  if (state.status === "loading") {
    return <SkeletonDetail />;
  }
  if (state.status === "error") {
    return (
      <NotFound
        title={t("list.loadFailed")}
        body={state.error.message}
        backLabel={t("detail.back")}
        onBack={() => navigate(-1)}
      />
    );
  }
  if (state.status === "missing") {
    return (
      <NotFound
        title={t("detail.notFoundTitle")}
        body={t("detail.notFoundBody")}
        backLabel={t("detail.back")}
        onBack={() => navigate("/")}
      />
    );
  }

  const task = state.task;
  const TypeIcon = task.type === "otazka" ? HelpCircle : Notebook;
  const typeLabel = task.type === "otazka" ? t("detail.typeOtazka") : t("detail.typeNapad");
  const created = new Date(task.createdAt);
  const updated = new Date(task.updatedAt);

  return (
    <article className="mx-auto max-w-xl px-4 py-4" aria-labelledby="detail-title">
      <TopBar
        onBack={() => navigate(-1)}
        typeIcon={<TypeIcon aria-hidden size={18} />}
        typeLabel={typeLabel}
        onDelete={handleDelete}
      />

      <div className="mt-2 flex items-center gap-2 text-xs text-ink-subtle" aria-live="polite">
        {saving ? (
          <span>{t("detail.autoSavingHint")}</span>
        ) : savedVisible ? (
          <span>{t("detail.autoSavedHint")}</span>
        ) : (
          <span aria-hidden>&nbsp;</span>
        )}
      </div>

      <label htmlFor="detail-title" className="sr-only">
        {t("detail.titleLabel")}
      </label>
      <input
        id="detail-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={flushOnBlur}
        placeholder={t("detail.titlePlaceholder")}
        className="mt-1 block w-full rounded-md bg-transparent px-1 py-2 text-xl font-semibold text-ink placeholder:text-ink-subtle focus:outline-none focus:bg-bg-subtle/60"
      />

      <label htmlFor="detail-body" className="sr-only">
        {t("detail.bodyLabel")}
      </label>
      <textarea
        id="detail-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={flushOnBlur}
        placeholder={t("detail.bodyPlaceholder")}
        rows={6}
        className="mt-3 block w-full resize-y rounded-md bg-transparent px-1 py-2 text-base leading-relaxed text-ink placeholder:text-ink-subtle focus:outline-none focus:bg-bg-subtle/60 min-h-[10rem]"
      />

      <section className="mt-6" aria-labelledby="status-heading">
        <h2 id="status-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("status.label")}
        </h2>
        <StatusSelect
          value={task.status}
          onChange={handleStatusChange}
          disabled={saving}
        />
      </section>

      <section className="mt-4" aria-labelledby="cat-heading">
        <h2 id="cat-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.categoryLabel")}
        </h2>
        <CategoryPicker
          value={task.categoryId ?? null}
          categories={categories}
          onChange={handleCategoryChange}
          disabled={saving}
        />
      </section>

      {/* Placeholder region for S07-S11 — location, attachments, PM answer. */}
      <hr className="my-6 border-line" />

      <section aria-label={t("detail.metadata")} className="text-sm text-ink-muted">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.metadata")}
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <dt>{t("detail.typeLabel")}</dt>
          <dd>{typeLabel}</dd>
          <dt>{t("detail.created")}</dt>
          <dd>
            {formatRelative(t, created)}
            <span className="text-ink-subtle"> · {created.toLocaleString("cs-CZ")}</span>
          </dd>
          <dt>{t("detail.updated")}</dt>
          <dd>{formatRelative(t, updated)}</dd>
          <dt>{t("detail.author")}</dt>
          <dd className="truncate">{task.createdBy || "—"}</dd>
        </dl>
      </section>
    </article>
  );
}

// ---------- Sub-components ----------

function TopBar({
  onBack,
  typeIcon,
  typeLabel,
  onDelete,
}: {
  onBack: () => void;
  typeIcon: React.ReactNode;
  typeLabel: string;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label={t("detail.back")}
        className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
      >
        <ArrowLeft aria-hidden size={20} />
      </button>

      <div
        className="flex items-center gap-1.5 rounded-pill bg-bg-subtle px-3 py-1 text-xs font-medium text-ink-muted"
        aria-label={typeLabel}
      >
        {typeIcon}
        <span>{typeLabel}</span>
      </div>

      <OverflowMenu onDelete={onDelete} />
    </div>
  );
}

function OverflowMenu({ onDelete }: { onDelete: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("detail.overflowMenu")}
        className="-mr-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
      >
        <MoreHorizontal aria-hidden size={20} />
      </button>

      {open && (
        <ul
          role="menu"
          aria-label={t("detail.overflowMenu")}
          className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-44 overflow-hidden rounded-md bg-surface shadow-lg ring-1 ring-line"
        >
          <li role="none">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[color:var(--color-status-danger-fg)] hover:bg-bg-subtle"
            >
              <Trash2 aria-hidden size={16} />
              {t("detail.delete")}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function SkeletonDetail() {
  return (
    <section className="mx-auto max-w-xl px-4 py-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-md bg-surface ring-1 ring-line animate-pulse" />
        <div className="h-6 w-20 rounded-pill bg-surface ring-1 ring-line animate-pulse" />
        <div className="h-10 w-10 rounded-md bg-surface ring-1 ring-line animate-pulse" />
      </div>
      <div className="mt-6 h-8 rounded-md bg-surface ring-1 ring-line animate-pulse" />
      <div className="mt-4 h-40 rounded-md bg-surface ring-1 ring-line animate-pulse" />
    </section>
  );
}

function NotFound({
  title,
  body,
  backLabel,
  onBack,
}: {
  title: string;
  body: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl px-4 py-12 text-center" role="alert">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
      >
        {backLabel}
      </button>
    </section>
  );
}
