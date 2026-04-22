import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, HelpCircle, MapPin, Notebook, Tag, Trash2 } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useTask } from "@/hooks/useTask";
import { useTasks } from "@/hooks/useTasks";
import { convertNapadToOtazka, deleteTask, updateTask } from "@/lib/tasks";
import { newId } from "@/lib/id";
import { useUserRole } from "@/hooks/useUserRole";
import StatusSelect from "@/components/StatusSelect";
import CategoryPicker from "@/components/CategoryPicker";
import LocationPicker from "@/components/LocationPicker";
import AssigneeSelect from "@/components/AssigneeSelect";
import PrioritySelect from "@/components/PrioritySelect";
import DeadlinePicker from "@/components/DeadlinePicker";
import StatusBadge, { statusColors } from "@/components/StatusBadge";
import Lightbox from "@/components/Lightbox";
import { deleteTaskImage, isSupportedImage, uploadTaskImage } from "@/lib/attachments";
import { ArrowRight, ExternalLink, HelpCircle as HelpCircleIcon, Image as ImageIcon, Lightbulb, Link as LinkIconLc, Pencil, Sparkles, X as XIcon } from "lucide-react";
import { normalizeUrl, parseDomain } from "@/lib/links";
import { useCategories } from "@/hooks/useCategories";
import { getLocation } from "@/lib/locations";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import type { TaskStatus } from "@/types";
import { isBallOnMe as isBallOnMeV10, mapLegacyOtazkaStatus, statusLabel } from "@/lib/status";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));
const CommentThread = lazy(() => import("@/components/CommentThread"));

/** V6.2 — autosave timing. We no longer save on every keystroke; we wait
 *  until the user blurs the title or body editor, then pause for a short
 *  grace period so rapid blur→refocus cycles don’t fire a premature save. */
const BLUR_SAVE_DELAY_MS = 1000;

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const state = useTask(id);
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const isPm = roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER";
  const { categories } = useCategories(Boolean(user));
  const { tasks: allTasks } = useTasks(Boolean(user));
  const { byUid } = useUsers(Boolean(user));

  // Editable local state. Initialized once from Firestore task; not re-synced on subsequent
  // snapshots to avoid fighting the user's keystrokes (last-write-wins is fine for this MVP).
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const initializedRef = useRef(false);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef<{ id: string; title: string; body: string } | null>(null);
  // V6.2 — schedule id for the blur-driven autosave timer. Any re-focus or
  // fresh blur cancels+reschedules; unmount flushes immediately.
  const blurSaveTimerRef = useRef<number | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (state.status === "ready" && !initializedRef.current) {
      setTitle(state.task.title);
      setBody(state.task.body);
      initializedRef.current = true;
      setHasInitialized(true);
    }
    // Re-initialize only if the route's :id changed (or the task disappears).
    if (state.status !== "ready") {
      initializedRef.current = false;
      setHasInitialized(false);
    }
  }, [state]);

  // Reset transient UI flags when the route's :id changes. TaskDetail is reused
  // across /t/:id navigations (React Router keeps component mounted), so any
  // in-flight flag like `converting` would otherwise leak into the next task.
  useEffect(() => {
    setConverting(false);
    setSaving(false);
    setAttachError(null);
  }, [id]);

  // Auto-resize title textarea to fit content (grows on wrap).
  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [title]);

  // V6.2 — track a pending diff (nothing more). Actual persistence is
  // triggered on blur (or unmount / page hide) — typing alone never writes.
  useEffect(() => {
    if (state.status !== "ready" || !initializedRef.current) {
      return;
    }
    const orig = state.task;
    if (title === orig.title && body === orig.body) {
      pendingRef.current = null;
    } else {
      pendingRef.current = { id: orig.id, title, body };
    }
  }, [title, body, state]);

  // Flush any pending edit on unmount (browser back, route change) and on page hide
  // (mobile background / tab switch). Fire-and-forget — component is going away.
  useEffect(() => {
    function flushPending() {
      // Cancel any blur-scheduled save so we don’t double-fire.
      if (blurSaveTimerRef.current !== null) {
        window.clearTimeout(blurSaveTimerRef.current);
        blurSaveTimerRef.current = null;
      }
      const p = pendingRef.current;
      if (!p) return;
      pendingRef.current = null;
      updateTask(p.id, { title: p.title, body: p.body }).catch((e) =>
        console.error("flush on hide/unmount failed", e)
      );
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushPending);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushPending);
      flushPending();
    };
  }, []);

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

  function cancelBlurSave() {
    if (blurSaveTimerRef.current !== null) {
      window.clearTimeout(blurSaveTimerRef.current);
      blurSaveTimerRef.current = null;
    }
  }

  /** Called when the title textarea or the body editor loses focus. Schedules
   *  a persist after BLUR_SAVE_DELAY_MS — the short grace period lets a quick
   *  re-focus cancel the save before it fires (see handleEditorFocus). */
  function flushOnBlur() {
    if (state.status !== "ready") return;
    cancelBlurSave();
    blurSaveTimerRef.current = window.setTimeout(() => {
      blurSaveTimerRef.current = null;
      const p = pendingRef.current;
      if (!p) return;
      persist({ title: p.title, body: p.body });
      pendingRef.current = null;
    }, BLUR_SAVE_DELAY_MS);
  }

  /** Cancel any in-flight blur-save if the user jumps back into the editor. */
  function handleEditorFocus() {
    cancelBlurSave();
  }

  function flashSaved() {
    setSavedVisible(true);
    window.setTimeout(() => setSavedVisible(false), 1500);
  }

  async function handleConvert() {
    if (state.status !== "ready" || !user) return;
    if (state.task.type !== "napad") return;
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

  async function handleAttachPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || state.status !== "ready" || !user) return;
    for (const f of files) {
      if (!isSupportedImage(f)) {
        setAttachError(t("detail.attachmentUnsupported"));
        return;
      }
    }
    setAttachError(null);
    setUploadingImage(true);
    try {
      const existing = state.task.attachmentImages ?? [];
      const uploaded: import("@/types").ImageAttachment[] = [];
      for (const file of files) {
        try {
          const { url, path } = await uploadTaskImage({
            file,
            uid: user.uid,
            taskId: state.task.id,
          });
          uploaded.push({ id: newId(), url, path });
        } catch (err) {
          console.error("single image upload failed", err);
        }
      }
      if (uploaded.length > 0) {
        await updateTask(state.task.id, {
          attachmentImages: [...existing, ...uploaded],
        });
        flashSaved();
      } else {
        setAttachError(t("composer.uploadFailed"));
      }
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleRemoveImage(img: import("@/types").ImageAttachment) {
    if (state.status !== "ready") return;
    if (!window.confirm(t("detail.confirmRemovePhoto"))) return;
    setUploadingImage(true);
    try {
      if (img.path) await deleteTaskImage(img.path);
      const existing = state.task.attachmentImages ?? [];
      const filtered = existing.filter((x) => x.id !== img.id);
      await updateTask(state.task.id, { attachmentImages: filtered });
      flashSaved();
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleLinkEdit(index: number) {
    if (state.status !== "ready") return;
    const current = index >= 0 ? (state.task.attachmentLinks?.[index] ?? "") : "https://";
    const input = window.prompt(t("composer.linkPromptTitle"), current || "");
    if (input === null) return;
    const normalized = input.trim() ? normalizeUrl(input) : null;
    if (input.trim() && !normalized) {
      setAttachError(t("composer.linkInvalid"));
      return;
    }
    setAttachError(null);
    setSaving(true);
    try {
      const existing = state.task.attachmentLinks ?? [];
      let next: string[];
      if (index >= 0) {
        // Edit existing
        if (!normalized) {
          // Empty input → remove
          next = existing.filter((_, i) => i !== index);
        } else {
          next = existing.map((u, i) => (i === index ? normalized : u));
        }
      } else {
        // Add new
        if (!normalized) return;
        next = [...existing, normalized];
      }
      await updateTask(state.task.id, { attachmentLinks: next });
      flashSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkRemove(index: number) {
    if (state.status !== "ready") return;
    if (!window.confirm(t("detail.linkConfirmRemove"))) return;
    setSaving(true);
    try {
      const existing = state.task.attachmentLinks ?? [];
      const next = existing.filter((_, i) => i !== index);
      await updateTask(state.task.id, { attachmentLinks: next });
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

  async function handleCategoryChange(nextIds: string[]) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      const legacy = nextIds[0] ?? null;
      await updateTask(state.task.id, { categoryIds: nextIds, categoryId: legacy });
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

  async function handleAssigneeChange(nextUid: string | null) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, { assigneeUid: nextUid });
      flashSaved();
    } catch (e) {
      console.error("assignee update failed", e);
    } finally {
      setSaving(false);
    }
  }

  async function handlePriorityChange(next: import("@/types").TaskPriority) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, { priority: next });
      flashSaved();
    } catch (e) {
      console.error("priority update failed", e);
    } finally {
      setSaving(false);
    }
  }



  async function handleShareToggle(next: boolean) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, { sharedWithPm: next });
      flashSaved();
    } catch (e) {
      console.error("share toggle failed", e);
    } finally {
      setSaving(false);
    }
  }
  async function handleDeadlineChange(nextMs: number | null) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, { deadline: nextMs });
      flashSaved();
    } catch (e) {
      console.error("deadline update failed", e);
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

  // V6.2 — also skeleton while we're waiting for the init useEffect to sync
  // local title/body from the freshly-arrived task. Rendering the editor with
  // empty local state caused lost keystrokes when the user started typing
  // before the sync finished.
  if (state.status === "loading" || (state.status === "ready" && !hasInitialized)) {
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
    // Non-shared nápad is not visible to PM — client safety net (Firestore rules enforce).
    if (task.type === "napad" && !task.sharedWithPm) {
      return (
        <NotFound
          title={t("detail.notFoundTitle")}
          body={t("detail.notFoundBody")}
          backLabel={t("detail.back")}
          onBack={() => navigate("/zaznamy?type=otazka")}
        />
      );
    }
    // Shared nápad — read-only view for PM (no answer form, but can comment).
    if (task.type === "napad") {
      const categoryIds = task.categoryIds?.length
        ? task.categoryIds
        : task.categoryId ? [task.categoryId] : [];
      const taskCategories = categoryIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      const location = task.locationId ? getLocation(task.locationId) : null;

      return (
        <article className="mx-auto max-w-xl px-4 py-4" aria-labelledby="pm-napad-heading">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={t("detail.back")}
              className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
            >
              <ArrowLeft aria-hidden size={20} />
            </button>
            <StatusBadge status={task.status} size="md" type={task.type} isPm={isPm} />
            <span className="w-10" aria-hidden />
          </div>

          <h1 id="pm-napad-heading" className="mt-3 text-xl font-bold leading-tight text-ink">
            {task.title || t("detail.noTitle")}
          </h1>

          {/* Meta chips row — Location + Categories (read-only). */}
          {(location || taskCategories.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {location && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                  <MapPin aria-hidden size={11} />
                  {location.label}
                </span>
              )}
              {taskCategories.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                  <Tag aria-hidden size={11} />
                  {c.label}
                </span>
              ))}
            </div>
          )}

          {/* Body — no wrapper card, sits directly on page bg. */}
          <div className="mt-4">
            {task.body ? (
              <Suspense fallback={<p className="whitespace-pre-wrap break-words text-ink">{task.body}</p>}>
                <RichTextEditor value={task.body} onChange={() => {}} disabled ariaLabel={t("detail.bodyLabel")} />
              </Suspense>
            ) : (
              <p className="text-sm text-ink-subtle">{t("detail.bodyEmpty")}</p>
            )}
          </div>

          {/* Attachments — images + links. */}
          {(task.attachmentImages?.length ?? 0) > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {task.attachmentImages!.map((img, idx) => (
                <li key={img.id ?? idx}>
                  <button
                    type="button"
                    onClick={() => setLightbox(img.url)}
                    className="block w-full overflow-hidden rounded-md ring-1 ring-line hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-line-focus"
                  >
                    <img src={img.url} alt="" width={200} height={200} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(task.attachmentLinks?.length ?? 0) > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {task.attachmentLinks!.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-line bg-bg-subtle px-3 py-1.5 text-sm text-ink hover:bg-bg-muted"
                  >
                    <LinkIconLc size={14} />
                    <span className="truncate max-w-[22rem]">{parseDomain(url) ?? url}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Linked otázky — PM sees only ones assigned to themselves. */}
          {(() => {
            const pmLinked = (task.linkedTaskIds ?? [])
              .map((otazkaId) => {
                const ot = allTasks.find((x) => x.id === otazkaId);
                return { otazkaId, ot };
              })
              .filter(({ ot }) => ot && ot.assigneeUid === user?.uid);
            if (pmLinked.length === 0) return null;
            return (
              <section className="mt-6" aria-labelledby="pm-linked-otazky-heading">
                <h2
                  id="pm-linked-otazky-heading"
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
                >
                  {t("detail.linkedOtazkyTitle")}
                </h2>
                <ul className="flex flex-col gap-2">
                  {pmLinked.map(({ otazkaId, ot }) => {
                    const title =
                      ot?.title?.trim() ||
                      ot?.body?.split("\n")[0]?.trim().slice(0, 80) ||
                      t("detail.noTitle");
                    const c = ot ? statusColors(ot.type === "otazka" ? mapLegacyOtazkaStatus(ot.status) : ot.status) : null;
                    return (
                      <li key={otazkaId}>
                        <Link
                          to={`/t/${otazkaId}`}
                          className="flex items-center justify-between gap-3 rounded-md border border-l-4 bg-surface px-4 py-3 hover:bg-bg-subtle transition-colors"
                          style={{
                            borderLeftColor: c ? c.border : "var(--color-border-default)",
                            borderTopColor: "var(--color-border-default)",
                            borderRightColor: "var(--color-border-default)",
                            borderBottomColor: "var(--color-border-default)",
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <HelpCircleIcon aria-hidden size={18} className="text-accent-visual shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-ink truncate">{title}</p>
                              {ot && c && (
                                <span className="mt-1 inline-flex items-center gap-1.5 text-xs" style={{ color: c.fg }}>
                                  <span aria-hidden className="inline-block size-1.5 rounded-full" style={{ background: c.dot }} />
                                  {statusLabel(t, ot.status, { isPm, type: ot.type })}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight aria-hidden size={18} className="text-ink-subtle shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })()}

          {/* V10 — PM can convert an owner nápad into a new úkol (becomes assignee). */}
          <div className="mt-6">
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting || saving}
              className="inline-flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
            >
              <Sparkles aria-hidden size={16} className="text-accent-visual" />
              {converting
                ? t("detail.converting")
                : (task.linkedTaskIds?.length ?? 0) > 0
                ? t("detail.convertToOtazkaAgain")
                : t("detail.convertToOtazka")}
            </button>
          </div>

          <Suspense fallback={<div className="mt-6 min-h-[17rem] rounded-md bg-surface ring-1 ring-line animate-pulse" aria-busy="true" />}>
            <CommentThread task={task} />
          </Suspense>

          {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
        </article>
      );
    }
    // V5 — PM otazka view: title + meta chips + body + attachments + comments.
    // Parallels the PM napad view so PM always lands on a consistent layout.
    const categoryIdsPm = task.categoryIds?.length
      ? task.categoryIds
      : task.categoryId ? [task.categoryId] : [];
    const taskCategoriesPm = categoryIdsPm
      .map((id) => categories.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const locationPm = task.locationId ? getLocation(task.locationId) : null;

    return (
      <article className="mx-auto max-w-xl px-4 py-4" aria-labelledby="pm-otazka-heading">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t("detail.back")}
            className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
          >
            <ArrowLeft aria-hidden size={20} />
          </button>
          <StatusBadge status={task.status} size="md" type={task.type} isPm={isPm} />
          <span className="w-10" aria-hidden />
        </div>

        {/* V5 — show the task title for PM (previously hidden). */}
        <h1 id="pm-otazka-heading" className="mt-3 text-xl font-bold leading-tight text-ink">
          {task.title || t("detail.noTitle")}
        </h1>

        {/* Ball-on-me banner — V10 assignee-driven, same rule for OWNER + PM. */}
        {isBallOnMeV10(task, user?.uid) && (
          <div
            role="status"
            className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              background: "var(--color-priority-p1-bg)",
              color: "var(--color-priority-p1-fg)",
              borderColor: "var(--color-priority-p1-border)",
            }}
          >
            <span aria-hidden className="inline-block size-1.5 rounded-full" style={{ background: "var(--color-priority-p1-dot)" }} />
            {t("detail.ballOnMe")}
          </div>
        )}

        {/* V5 — meta chips (Lokace + Kategorie), read-only. */}
        {(locationPm || taskCategoriesPm.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {locationPm && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                <MapPin aria-hidden size={11} />
                {locationPm.label}
              </span>
            )}
            {taskCategoriesPm.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                <Tag aria-hidden size={11} />
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* Body — no wrapper card, matches PM napad view. */}
        <div className="mt-4">
          {task.body ? (
            <Suspense fallback={<p className="whitespace-pre-wrap break-words text-ink">{task.body}</p>}>
              <RichTextEditor value={task.body} onChange={() => {}} disabled ariaLabel={t("detail.bodyLabel")} />
            </Suspense>
          ) : (
            <p className="text-sm text-ink-subtle">{t("detail.bodyEmpty")}</p>
          )}
        </div>

        {/* V5 — images. */}
        {(task.attachmentImages?.length ?? 0) > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {task.attachmentImages!.map((img, idx) => (
              <li key={img.id ?? idx}>
                <button
                  type="button"
                  onClick={() => setLightbox(img.url)}
                  className="block w-full overflow-hidden rounded-md ring-1 ring-line hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-line-focus"
                >
                  <img src={img.url} alt="" width={200} height={200} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* V5 — links. */}
        {(task.attachmentLinks?.length ?? 0) > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {task.attachmentLinks!.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-line bg-bg-subtle px-3 py-1.5 text-sm text-ink hover:bg-bg-muted"
                >
                  <LinkIconLc size={14} />
                  <span className="truncate max-w-[22rem]">{parseDomain(url) ?? url}</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <Suspense fallback={<div className="mt-6 min-h-[17rem] rounded-md bg-surface ring-1 ring-line animate-pulse" aria-busy="true" />}>
          <CommentThread task={task} />
        </Suspense>

        {lightbox && (
          <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
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
        {t("detail.titlePrimary")}
      </label>
      <textarea
        id="detail-title"
        ref={titleTextareaRef}
        value={title}
        onChange={(e) => {
          // Strip newlines — title is single logical line, but wraps visually.
          const v = e.target.value.replace(/\n/g, "");
          setTitle(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={flushOnBlur}
        onFocus={handleEditorFocus}
        rows={1}
        placeholder={t("detail.titlePlaceholderV2")}
        autoCapitalize="sentences"
        className="mt-2 block w-full resize-none overflow-hidden border-0 border-b border-transparent bg-transparent px-0 py-1 text-xl sm:text-2xl font-bold leading-tight text-ink placeholder:text-ink-subtle focus:border-b-line-focus focus:outline-none focus:ring-0"
      />

      <div className="mt-3">
        <span id="detail-body-label" className="sr-only">
          {t("detail.bodyLabel")}
        </span>
        <Suspense
          fallback={
            <div
              className="min-h-[17rem] rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-subtle"
              aria-busy="true"
              role="status"
            >
              {t("detail.editorLoading")}
            </div>
          }
        >
          <RichTextEditor
            value={body}
            onChange={setBody}
            onBlur={flushOnBlur}
            onFocus={handleEditorFocus}
            placeholder={t("detail.bodyPlaceholder")}
            ariaLabel={t("detail.bodyLabel")}
          />
        </Suspense>
      </div>

      {isBallOnMeV10(task, user?.uid) && (
        <div
          role="status"
          className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
          style={{
            background: "var(--color-priority-p1-bg)",
            color: "var(--color-priority-p1-fg)",
            borderColor: "var(--color-priority-p1-border)",
          }}
        >
          <span aria-hidden className="inline-block size-1.5 rounded-full" style={{ background: "var(--color-priority-p1-dot)" }} />
          {t("detail.ballOnMe")}
        </div>
      )}

      {/* Categories — directly under body (full width). */}
      <section className="mt-4" aria-labelledby="cat-heading">
        <h2 id="cat-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.categoryLabel")}
        </h2>
        <CategoryPicker
          value={task.categoryIds ?? (task.categoryId ? [task.categoryId] : [])}
          categories={categories}
          onChange={handleCategoryChange}
          disabled={saving}
        />
      </section>

      {task.type === "otazka" ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section aria-labelledby="loc-heading">
              <h2 id="loc-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {t("detail.locationLabel")}
              </h2>
              <LocationPicker
                value={task.locationId ?? null}
                onChange={handleLocationChange}
                disabled={saving}
              />
            </section>
            {task.createdBy === user?.uid && (
              <section aria-labelledby="deadline-heading">
                <h2 id="deadline-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  {t("deadline.label")}
                </h2>
                <DeadlinePicker
                  value={task.deadline ?? null}
                  onChange={handleDeadlineChange}
                  disabled={saving}
                />
              </section>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {task.createdBy === user?.uid && (
              <section aria-labelledby="priority-heading">
                <h2 id="priority-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  {t("priority.label")}
                </h2>
                <PrioritySelect
                  value={task.priority}
                  onChange={handlePriorityChange}
                  disabled={saving}
                />
              </section>
            )}
            <section aria-labelledby="assignee-heading">
              <h2 id="assignee-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {t("detail.assignee")}
              </h2>
              <AssigneeSelect
                value={task.assigneeUid ?? null}
                onChange={handleAssigneeChange}
                disabled={saving}
                readOnly={!(task.createdBy === user?.uid)}
              />
            </section>
          </div>
        </>
      ) : (
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
      )}

      {task.type === "napad" && task.createdBy === user?.uid && (
        <section className="mt-4" aria-labelledby="share-heading">
          <h2 id="share-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t("detail.shareWithPm")}
          </h2>
          <label className="flex w-full cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle">
            <input
              type="checkbox"
              checked={Boolean(task.sharedWithPm)}
              onChange={(e) => handleShareToggle(e.target.checked)}
              disabled={saving}
              className="size-4 rounded border-line focus:ring-2 focus:ring-line-focus"
              style={{ accentColor: "var(--color-accent-visual)" }}
            />
            <span className="flex-1">{t("detail.shareWithPmLabel")}</span>
            <span className="text-xs text-ink-subtle">
              {task.sharedWithPm ? t("detail.shareOn") : t("detail.shareOff")}
            </span>
          </label>
        </section>
      )}

      <section className="mt-6" aria-labelledby="status-heading">
        <h2 id="status-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("status.label")}
        </h2>
        <StatusSelect
          value={task.status}
          onChange={handleStatusChange}
          disabled={saving}
          type={task.type}
          isPm={isPm}
        />
      </section>

      <section className="mt-4" aria-labelledby="att-heading">
        <h2 id="att-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.attachmentLabel")}
        </h2>
        {(task.attachmentImages?.length ?? 0) > 0 && (
          <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {task.attachmentImages!.map((img, idx) => (
              <li key={img.id ?? idx} className="relative">
                <button
                  type="button"
                  onClick={() => setLightbox(img.url)}
                  className="block w-full overflow-hidden rounded-md ring-1 ring-line hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-line-focus"
                  aria-label={t("aria.openImagePreview")}
                >
                  <img
                    src={img.url}
                    alt=""
                    width={200}
                    height={200}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img)}
                  disabled={uploadingImage}
                  aria-label={t("detail.removePhoto")}
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-pill bg-black/75 text-white shadow hover:bg-black disabled:opacity-40"
                >
                  <XIcon aria-hidden size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-2 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
        >
          <ImageIcon aria-hidden size={18} />
          {uploadingImage ? t("detail.uploading") : t("detail.addPhoto")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleAttachPick}
        />
        {attachError && (
          <p role="alert" className="mt-2 text-xs text-[color:var(--color-status-danger-fg)]">
            {attachError}
          </p>
        )}
      </section>

      {lightbox && (
        <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}

      <section className="mt-4" aria-labelledby="link-heading">
        <h2 id="link-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.linkLabel")}
        </h2>
        {(task.attachmentLinks?.length ?? 0) > 0 && (
          <ul className="mb-2 flex flex-col gap-2">
            {task.attachmentLinks!.map((url, i) => (
              <li key={i} className="flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("detail.linkOpen")}
                  className="inline-flex items-center gap-2 flex-1 min-h-tap rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle transition-colors truncate"
                >
                  <LinkIconLc aria-hidden size={16} className="text-accent-visual shrink-0" />
                  <span className="truncate">{parseDomain(url) ?? url}</span>
                  <ExternalLink aria-hidden size={14} className="text-ink-subtle shrink-0" />
                </a>
                <button
                  type="button"
                  onClick={() => handleLinkEdit(i)}
                  disabled={saving}
                  aria-label={t("detail.linkEdit")}
                  className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink disabled:opacity-40"
                >
                  <Pencil aria-hidden size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleLinkRemove(i)}
                  disabled={saving}
                  aria-label={t("detail.linkRemove")}
                  className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-[color:var(--color-status-danger-fg)] disabled:opacity-40"
                >
                  <XIcon aria-hidden size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => handleLinkEdit(-1)}
          disabled={saving}
          className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-2 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
        >
          <LinkIconLc aria-hidden size={18} />
          {t("detail.linkAdd")}
        </button>
      </section>


      {task.type === "napad" && (task.linkedTaskIds?.length ?? 0) > 0 && (
        <section className="mt-4" aria-labelledby="linked-otazky-heading">
          <h2
            id="linked-otazky-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
          >
            {t("detail.linkedOtazkyTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {task.linkedTaskIds!.map((otazkaId) => {
              const ot = allTasks.find((x) => x.id === otazkaId);
              const title =
                ot?.title?.trim() ||
                ot?.body?.split("\n")[0]?.trim().slice(0, 80) ||
                t("detail.noTitle");
              const c = ot ? statusColors(ot.type === "otazka" ? mapLegacyOtazkaStatus(ot.status) : ot.status) : null;
              return (
                <li key={otazkaId}>
                  <Link
                    to={`/t/${otazkaId}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-l-4 bg-surface px-4 py-3 hover:bg-bg-subtle transition-colors"
                    style={{
                      borderLeftColor: c ? c.border : "var(--color-border-default)",
                      borderTopColor: "var(--color-border-default)",
                      borderRightColor: "var(--color-border-default)",
                      borderBottomColor: "var(--color-border-default)",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <HelpCircleIcon aria-hidden size={18} className="text-accent-visual shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{title}</p>
                        {ot && c && (
                          <span
                            className="mt-1 inline-flex items-center gap-1.5 text-xs"
                            style={{ color: c.fg }}
                          >
                            <span
                              aria-hidden
                              className="inline-block size-1.5 rounded-full"
                              style={{ background: c.dot }}
                            />
                            {statusLabel(t, ot.status, { isPm, type: ot.type })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight aria-hidden size={18} className="text-ink-subtle shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {task.type === "otazka" && task.linkedTaskId && (() => {
        const parent = allTasks.find((x) => x.id === task.linkedTaskId);
        const parentTitle =
          parent?.title?.trim() ||
          parent?.body?.split("\n")[0]?.trim().slice(0, 80) ||
          t("detail.noTitle");
        return (
          <Link
            to={`/t/${task.linkedTaskId}`}
            className="mt-4 flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 hover:bg-bg-subtle transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Lightbulb aria-hidden size={18} className="text-ink-subtle shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  {t("detail.linkedNapadTitle")}
                </p>
                <p className="text-sm text-ink truncate">{parentTitle}</p>
              </div>
            </div>
            <ArrowRight aria-hidden size={18} className="text-ink-subtle shrink-0" />
          </Link>
        );
      })()}

      {task.type === "napad" && (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleConvert}
            disabled={converting || saving}
            className="inline-flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
          >
            <Sparkles aria-hidden size={16} className="text-accent-visual" />
            {converting
              ? t("detail.converting")
              : (task.linkedTaskIds?.length ?? 0) > 0
              ? t("detail.convertToOtazkaAgain")
              : t("detail.convertToOtazka")}
          </button>
        </div>
      )}
      <Suspense fallback={<div className="mt-6 h-40 rounded-md bg-surface ring-1 ring-line animate-pulse" aria-busy="true" />}>
        <CommentThread task={task} />
      </Suspense>

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
          <dd className="truncate">{byUid.get(task.createdBy)?.email || task.createdBy || "—"}</dd>
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
