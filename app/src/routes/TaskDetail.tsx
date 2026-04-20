import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, HelpCircle, Notebook } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useTask } from "@/hooks/useTask";
import { answerAsProjektant, convertNapadToOtazka, deleteTask, needMoreInfoAsProjektant, updateTask } from "@/lib/tasks";
import { useUserRole } from "@/hooks/useUserRole";
import StatusSelect from "@/components/StatusSelect";
import CategoryPicker from "@/components/CategoryPicker";
import LocationPicker from "@/components/LocationPicker";
import StatusBadge from "@/components/StatusBadge";
import Lightbox from "@/components/Lightbox";
import { deleteTaskImage, isSupportedImage, uploadTaskImage } from "@/lib/attachments";
import { ArrowRight, ExternalLink, HelpCircle as HelpCircleIcon, Image as ImageIcon, Lightbulb, Link as LinkIconLc, Sparkles, X as XIcon } from "lucide-react";
import { normalizeUrl, parseDomain } from "@/lib/links";
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
  const roleState = useUserRole(user?.uid);
  const isPm = roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER";
  const { categories } = useCategories(Boolean(user) && !isPm);

  // Editable local state. Initialized once from Firestore task; not re-synced on subsequent
  // snapshots to avoid fighting the user's keystrokes (last-write-wins is fine for this MVP).
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const initializedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [answering, setAnswering] = useState(false);
  const [converting, setConverting] = useState(false);

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

  async function handleConvert() {
    if (state.status !== "ready" || !user) return;
    if (state.task.type !== "napad" || state.task.linkedTaskId) return;
    if (!window.confirm(t("detail.convertConfirm"))) return;
    setConverting(true);
    try {
      const newId = await convertNapadToOtazka(state.task, user.uid);
      navigate(`/t/${newId}`);
    } catch (e) {
      console.error("convert failed", e);
      setConverting(false);
    }
  }

  async function handleAnswerAndClose() {
    if (state.status !== "ready") return;
    const answer = answerDraft.trim();
    if (!answer) return;
    setAnswering(true);
    try {
      await answerAsProjektant(state.task.id, answer);
      flashSaved();
    } catch (e) {
      console.error("answer failed", e);
    } finally {
      setAnswering(false);
    }
  }

  async function handleNeedMoreInfo() {
    if (state.status !== "ready") return;
    const answer = answerDraft.trim();
    if (!answer) return;
    setAnswering(true);
    try {
      await needMoreInfoAsProjektant(state.task.id, answer);
      flashSaved();
    } catch (e) {
      console.error("need-more-info failed", e);
    } finally {
      setAnswering(false);
    }
  }

  async function handleAttachPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || state.status !== "ready" || !user) return;
    if (!isSupportedImage(file)) {
      setAttachError(t("detail.attachmentUnsupported"));
      return;
    }
    setAttachError(null);
    setUploadingImage(true);
    try {
      // If replacing, delete old object first (best-effort)
      if (state.task.attachmentImagePath) {
        await deleteTaskImage(state.task.attachmentImagePath);
      }
      const { url, path } = await uploadTaskImage({
        file,
        uid: user.uid,
        taskId: state.task.id,
      });
      await updateTask(state.task.id, {
        attachmentImageUrl: url,
        attachmentImagePath: path,
      });
      flashSaved();
    } catch (e) {
      console.error("attachment upload failed", e);
      setAttachError(t("composer.uploadFailed"));
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleRemoveAttachment() {
    if (state.status !== "ready") return;
    if (!window.confirm(t("detail.confirmRemovePhoto"))) return;
    const path = state.task.attachmentImagePath;
    setUploadingImage(true);
    try {
      if (path) await deleteTaskImage(path);
      await updateTask(state.task.id, {
        attachmentImageUrl: null,
        attachmentImagePath: null,
      });
      flashSaved();
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleLinkEdit() {
    if (state.status !== "ready") return;
    const current = state.task.attachmentLinkUrl ?? "https://";
    const input = window.prompt(t("composer.linkPromptTitle"), current);
    if (input === null) return;
    if (!input.trim()) {
      await updateTask(state.task.id, { attachmentLinkUrl: null });
      flashSaved();
      return;
    }
    const normalized = normalizeUrl(input);
    if (!normalized) {
      setAttachError(t("composer.linkInvalid"));
      return;
    }
    setAttachError(null);
    setSaving(true);
    try {
      await updateTask(state.task.id, { attachmentLinkUrl: normalized });
      flashSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkRemove() {
    if (state.status !== "ready") return;
    if (!window.confirm(t("detail.linkConfirmRemove"))) return;
    setSaving(true);
    try {
      await updateTask(state.task.id, { attachmentLinkUrl: null });
      flashSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleLocationChange(nextId: string | null) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, { locationId: nextId });
      flashSaved();
    } catch (e) {
      console.error("location update failed", e);
    } finally {
      setSaving(false);
    }
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

  // ---------- PM view: read-only question + answer form ----------
  if (isPm) {
    if (task.type !== "otazka") {
      // PM should never see nápady — Firestore rules also enforce; this is client safety net.
      return (
        <NotFound
          title={t("detail.notFoundTitle")}
          body={t("detail.notFoundBody")}
          backLabel={t("detail.back")}
          onBack={() => navigate("/otazky")}
        />
      );
    }
    return (
      <article className="mx-auto max-w-xl px-4 py-4" aria-labelledby="pm-heading">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t("detail.back")}
            className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
          >
            <ArrowLeft aria-hidden size={20} />
          </button>
          <StatusBadge status={task.status} size="md" />
          <span className="w-10" aria-hidden />
        </div>

        <h1 id="pm-heading" className="sr-only">{t("detail.typeOtazka")}</h1>

        <div className="mt-4 rounded-md bg-surface ring-1 ring-line p-4">
          <p className="whitespace-pre-wrap break-words text-ink">{task.body || task.title}</p>
          {task.attachmentImageUrl && (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="mt-3 block overflow-hidden rounded-md ring-1 ring-line"
            >
              <img
                src={task.attachmentImageUrl}
                alt=""
                width={640}
                height={256}
                loading="lazy"
                decoding="async"
                className="max-h-64 w-auto object-cover"
              />
            </button>
          )}
          {task.attachmentLinkUrl && (
            <a
              href={task.attachmentLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-line bg-bg-subtle px-3 py-1.5 text-sm text-ink hover:bg-bg-muted"
            >
              <LinkIconLc size={14} />
              {task.attachmentLinkUrl}
            </a>
          )}
        </div>

        <section className="mt-6" aria-labelledby="answer-heading">
          <h2 id="answer-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t("detail.projektantAnswer")}
          </h2>
          <textarea
            value={answerDraft}
            onChange={(e) => setAnswerDraft(e.target.value)}
            placeholder={t("detail.projektantAnswerPlaceholder")}
            rows={6}
            disabled={answering}
            className="block w-full min-h-[10rem] resize-y rounded-md border border-line bg-surface px-3 py-2 text-base leading-relaxed text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none disabled:opacity-60"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleNeedMoreInfo}
              disabled={!answerDraft.trim() || answering}
              className="min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
            >
              {t("detail.needMoreInfo")}
            </button>
            <button
              type="button"
              onClick={handleAnswerAndClose}
              disabled={!answerDraft.trim() || answering}
              className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
            >
              {t("detail.answerAndClose")}
            </button>
          </div>
          <p aria-live="polite" className={`mt-2 text-center text-xs text-ink-subtle transition-opacity ${savedVisible ? "opacity-100" : "opacity-0"}`}>
            {savedVisible ? t("detail.autoSavedHint") : ""}
          </p>
        </section>

        {lightbox && task.attachmentImageUrl && (
          <Lightbox src={task.attachmentImageUrl} onClose={() => setLightbox(false)} />
        )}
      </article>
    );
  }

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

      <section className="mt-4" aria-labelledby="loc-heading">
        <h2 id="loc-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.locationLabel")}
        </h2>
        <LocationPicker
          value={task.locationId ?? null}
          onChange={handleLocationChange}
          disabled={saving}
        />
      </section>

      <section className="mt-4" aria-labelledby="att-heading">
        <h2 id="att-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.attachmentLabel")}
        </h2>
        {task.attachmentImageUrl ? (
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="block overflow-hidden rounded-md ring-1 ring-line hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-line-focus"
              aria-label={t("aria.openImagePreview")}
            >
              <img
                src={task.attachmentImageUrl}
                alt=""
                width={128}
                height={128}
                loading="lazy"
                decoding="async"
                className="h-32 w-32 object-cover"
              />
            </button>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="min-h-tap rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
              >
                {uploadingImage ? t("detail.uploading") : t("detail.replacePhoto")}
              </button>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                disabled={uploadingImage}
                className="min-h-tap rounded-md border border-line bg-surface px-3 py-2 text-sm text-[color:var(--color-status-danger-fg)] hover:bg-bg-subtle disabled:opacity-40 transition-colors inline-flex items-center gap-2"
              >
                <XIcon aria-hidden size={16} />
                {t("detail.removePhoto")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-3 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
          >
            <ImageIcon aria-hidden size={18} />
            {uploadingImage ? t("detail.uploading") : t("detail.addPhoto")}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleAttachPick}
        />
        {attachError && (
          <p role="alert" className="mt-2 text-xs text-[color:var(--color-status-danger-fg)]">
            {attachError}
          </p>
        )}
      </section>

      {lightbox && task.attachmentImageUrl && (
        <Lightbox src={task.attachmentImageUrl} onClose={() => setLightbox(false)} />
      )}

      <section className="mt-4" aria-labelledby="link-heading">
        <h2 id="link-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.linkLabel")}
        </h2>
        {task.attachmentLinkUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={task.attachmentLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("detail.linkOpen")}
              className="inline-flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle transition-colors"
            >
              <LinkIconLc aria-hidden size={16} className="text-accent-visual" />
              <span className="truncate max-w-[16rem]">
                {parseDomain(task.attachmentLinkUrl) ?? task.attachmentLinkUrl}
              </span>
              <ExternalLink aria-hidden size={14} className="text-ink-subtle" />
            </a>
            <button
              type="button"
              onClick={handleLinkEdit}
              disabled={saving}
              className="min-h-tap rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
            >
              {t("detail.linkEdit")}
            </button>
            <button
              type="button"
              onClick={handleLinkRemove}
              disabled={saving}
              className="min-h-tap rounded-md border border-line bg-surface px-3 py-2 text-sm text-[color:var(--color-status-danger-fg)] hover:bg-bg-subtle disabled:opacity-40 transition-colors inline-flex items-center gap-1"
            >
              <XIcon aria-hidden size={14} />
              {t("detail.linkRemove")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLinkEdit}
            disabled={saving}
            className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-3 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
          >
            <LinkIconLc aria-hidden size={18} />
            {t("detail.linkAdd")}
          </button>
        )}
      </section>

      {task.type === "otazka" && (task.projektantAnswer || task.status === "Čekám") && (
        <section className="mt-4" aria-labelledby="pm-answer-heading">
          <h2 id="pm-answer-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t("detail.projektantAnswer")}
          </h2>
          {task.projektantAnswer ? (
            <div className="rounded-md bg-surface ring-1 ring-line p-3">
              <p className="whitespace-pre-wrap break-words text-ink">{task.projektantAnswer}</p>
              {task.projektantAnswerAt && (
                <p className="mt-2 text-xs text-ink-subtle">
                  {t("detail.projektantAnswerAt", { when: formatRelative(t, new Date(task.projektantAnswerAt)) })}
                </p>
              )}
              {task.status === "Čekám" && (
                <p className="mt-3 rounded-md bg-[color:var(--color-status-warning-bg)] px-3 py-2 text-xs text-[color:var(--color-status-warning-fg)]">
                  {t("detail.needMoreInfoBanner")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-subtle">{t("detail.projektantAnswerNone")}</p>
          )}
        </section>
      )}

      {task.linkedTaskId && (
        <Link
          to={`/t/${task.linkedTaskId}`}
          className="mt-4 flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 hover:bg-bg-subtle transition-colors"
        >
          <div className="flex items-center gap-3">
            {task.type === "napad" ? (
              <HelpCircleIcon aria-hidden size={18} className="text-accent-visual" />
            ) : (
              <Lightbulb aria-hidden size={18} className="text-ink-subtle" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {task.type === "napad" ? t("detail.linkedOtazkaTitle") : t("detail.linkedNapadTitle")}
              </p>
              <p className="text-sm text-ink truncate">{t("detail.linkedOpen")}</p>
            </div>
          </div>
          <ArrowRight aria-hidden size={18} className="text-ink-subtle shrink-0" />
        </Link>
      )}

      {task.type === "napad" && !task.linkedTaskId && (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleConvert}
            disabled={converting || saving}
            className="inline-flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
          >
            <Sparkles aria-hidden size={16} className="text-accent-visual" />
            {converting ? t("detail.converting") : t("detail.convertToOtazka")}
          </button>
        </div>
      )}
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

      <button
        type="button"
        onClick={onDelete}
        aria-label={t("detail.delete")}
        className="-mr-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:text-[color:var(--color-status-danger-fg)] hover:bg-bg-subtle"
      >
        <Trash2 aria-hidden size={20} />
      </button>
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
