import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronDown, FileText, HelpCircle, Notebook, Target, Trash2 } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useTask } from "@/hooks/useTask";
import { useTasks } from "@/hooks/useTasks";
import { changeTaskType, convertNapadToOtazka, convertNapadToUkol, createTask, deleteTask, linkTaskToNapad, unlinkTaskFromNapad, updateTask } from "@/lib/tasks";
import { newId } from "@/lib/id";
import { TYPE_COLORS } from "@/lib/typeColors";
import { useUserRole } from "@/hooks/useUserRole";
import { canChangeTaskType, canEditTask, canLinkTasks, canViewTask } from "@/lib/permissions";
import { resolveAuthorRole } from "@/lib/authorRole";
import CategoryPicker from "@/components/CategoryPicker";
import LocationPickerInline from "@/components/LocationPickerInline";
import PhasePickerInline from "@/components/PhasePickerInline";
import StatusPickerInline from "@/components/StatusPickerInline";
import PriorityPickerInline from "@/components/PriorityPickerInline";
import AssigneeSelect from "@/components/AssigneeSelect";
import DeadlinePicker from "@/components/DeadlinePicker";
import { statusColors } from "@/components/StatusBadge";
import Lightbox from "@/components/Lightbox";
import { deleteTaskImage, isSupportedFile, isImageFile, uploadTaskImage, uploadTaskFile } from "@/lib/attachments";
import { ArrowRight, Check, ExternalLink, HelpCircle as HelpCircleIcon, Image as ImageIcon, Lightbulb, Link as LinkIconLc, Pencil, Upload, X as XIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { normalizeUrl, parseDomain } from "@/lib/links";
import { useCategories } from "@/hooks/useCategories";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import type { Task as TaskT, TaskType, TaskStatus, TaskPriority, UserRole, ImageAttachment, DocumentAttachment, AuditEntry } from "@/types";
import { isBallOnMe as isBallOnMeV10, mapLegacyOtazkaStatus, statusLabel } from "@/lib/status";
import { taskDetail } from "@/lib/routes";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));
const CommentThread = lazy(() => import("@/components/CommentThread"));
const DocumentUploadModal = lazy(() => import("@/components/DocumentUploadModal"));
const AuditTimeline = lazy(() => import("@/components/AuditTimeline"));
const DocumentPickerModal = lazy(() => import("@/components/DocumentPickerModal"));
const TaskLinkPickerModal = lazy(() => import("@/components/TaskLinkPickerModal"));
import SwipeReveal from "@/components/SwipeReveal";

// ---------- LinkedList (V14.1) ----------

type LinkedItem = { lid?: string; ot?: TaskT };

function LinkedList({
  items,
  headingId,
  heading,
  forceIcon,
  isPm,
  t,
  canUnlink,
  onUnlink,
  unlinkingId,
}: {
  items: LinkedItem[];
  headingId: string;
  heading: string;
  /** Icon rendered for every row — keeps list visually homogeneous. */
  forceIcon: LucideIcon;
  /** Unused fallback retained for API symmetry with forceIcon; kept for
   *  future cases where we need a per-row override. */
  fallbackIcon?: LucideIcon;
  isPm: boolean;
  t: (k: string, vars?: Record<string, string | number>) => string;
  /** V18-S40 — per-row gating pro unlink tlačítko. Když není dodáno,
   *  unlink ikona se nezobrazí (read-only / nedostatečné oprávnění). */
  canUnlink?: (other: TaskT) => boolean;
  onUnlink?: (otherId: string) => void;
  unlinkingId?: string | null;
}) {
  if (items.length === 0) return null;
  const Icon = forceIcon;
  return (
    <section className="mt-4" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
      >
        {heading}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map(({ lid, ot }) => {
          const title =
            ot?.title?.trim() ||
            ot?.body?.split("\n")[0]?.trim().slice(0, 80) ||
            t("detail.noTitle");
          const c = ot
            ? statusColors(
                (ot.type === "otazka" || ot.type === "ukol")
                  ? mapLegacyOtazkaStatus(ot.status)
                  : ot.status,
              )
            : null;
          const showUnlink = !!(ot && onUnlink && canUnlink && canUnlink(ot));
          const id = lid ?? ot?.id ?? "";
          return (
            <li
              key={id}
              className="flex items-stretch rounded-md border border-l-4 bg-surface hover:bg-bg-subtle transition-colors"
              style={{
                borderLeftColor: c ? c.border : "var(--color-border-default)",
                borderTopColor: "var(--color-border-default)",
                borderRightColor: "var(--color-border-default)",
                borderBottomColor: "var(--color-border-default)",
              }}
            >
              <Link
                to={taskDetail(id)}
                className="flex items-center justify-between gap-3 flex-1 min-w-0 px-4 py-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Icon aria-hidden size={18} className="text-accent-visual shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink break-words [overflow-wrap:anywhere] line-clamp-3">{title}</p>
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
                        {statusLabel(t as unknown as (k: string) => string, ot.status, { isPm, type: ot.type })}
                      </span>
                    )}
                  </div>
                </div>
                {!showUnlink && (
                  <ArrowRight aria-hidden size={18} className="text-ink-subtle shrink-0" />
                )}
              </Link>
              {showUnlink && (
                <button
                  type="button"
                  onClick={() => onUnlink?.(id)}
                  disabled={unlinkingId === id}
                  aria-label={t("detail.unlinkAria")}
                  className="grid place-items-center shrink-0 w-12 text-ink-subtle hover:bg-bg-muted hover:text-ink disabled:opacity-40 transition-colors"
                >
                  <XIcon aria-hidden size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** V6.2 — autosave timing. We no longer save on every keystroke; we wait
 *  until the user blurs the title or body editor, then pause for a short
 *  grace period so rapid blur→refocus cycles don’t fire a premature save. */
const BLUR_SAVE_DELAY_MS = 1000;

/** V22 refactor — shared icon + label lookup for TaskType. */
const TYPE_META: Record<TaskType, { icon: typeof FileText; labelKey: string }> = {
  otazka:      { icon: HelpCircle,  labelKey: "detail.typeOtazka" },
  ukol:        { icon: Target,      labelKey: "detail.typeUkol" },
  dokumentace: { icon: FileText,    labelKey: "detail.typeDokumentace" },
  napad:       { icon: Notebook,    labelKey: "detail.typeNapad" },
};

/** V23 — auto-capitalize first letter of title. */
function capitalizeFirst(v: string): string {
  if (!v) return v;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

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
  // V14 — nápad-only "Výstup" markdown (resolution summary).
  const [vystup, setVystup] = useState("");
  const initializedRef = useRef(false);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef<{ id: string; title: string; body: string; vystup: string } | null>(null);
  // V6.2 — schedule id for the blur-driven autosave timer. Any re-focus or
  // fresh blur cancels+reschedules; unmount flushes immediately.
  const blurSaveTimerRef = useRef<number | null>(null);
  // V22 — safety ref for isReadOnly so flush/pending effects can check it.
  const isReadOnlyRef = useRef(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);
  const [convertingUkol, setConvertingUkol] = useState(false);
  // V18-S40 — changeType (otazka↔ukol) + link/unlink k tématu
  const [changingType, setChangingType] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  // V14.1 — Výstup section is collapsed by default. User explicitly opens it
  // via the toggle or via the "Doplň výstup" banner CTA. Reset on route change.
  const [vystupExpanded, setVystupExpanded] = useState(false);
  // V21 — nápady + dokumentace: diskuse defaultně zavřená.
  // Initial value uses task from hook; falls back to open if not yet loaded.
  const [commentsOpen, setCommentsOpen] = useState(true);

  // V20 — Dokumentace document upload state
  const [docModal, setDocModal] = useState<{
    open: boolean;
    prefill?: { docType: string; displayName: string };
    replaceId?: string;
  }>({ open: false });
  const [docUploading, setDocUploading] = useState(false);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docMetaEdit, setDocMetaEdit] = useState<{ docId: string; docType: string; displayName: string } | null>(null);

  // V20 — title-first flow. FAB navigates to /t/new with state.createType.
  // No task exists in Firestore yet — we show only the title input.
  // After user confirms a title, we create the task and redirect to /t/{realId}.
  const routerLocation = useLocation();
  const createType = (routerLocation.state as { createType?: TaskType } | null)?.createType;
  const isCreateMode = id === "new" && !!createType;

  useEffect(() => {
    if (state.status === "ready" && !initializedRef.current) {
      setTitle(state.task.title);
      setBody(state.task.body);
      setVystup(state.task.vystup ?? "");
      // V21 — nápady + dokumentace: diskuse defaultně zavřená
      setCommentsOpen(state.task.type === "otazka" || state.task.type === "ukol");
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
    setConvertingUkol(false);
    setSaving(false);
    setAttachError(null);
    setVystupExpanded(false);
    // V14.3 — clear any carryover form state from the previously-viewed
    // task so the new task's blank values (especially after convert) show
    // correctly while the fresh snapshot loads. Skeleton hides this anyway,
    // but this keeps the transient state consistent.
    setTitle("");
    setBody("");
    setVystup("");
    pendingRef.current = null;
    initializedRef.current = false;
    setHasInitialized(false);
    // Land at the top of the new task — convert buttons sit deep on the page
    // and without this the user keeps their old scroll position on the fresh
    // detail.
    if (typeof window !== "undefined") {
      try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { /* ignore */ }
    }
  }, [id]);

  // Auto-resize title textarea to fit content (grows on wrap).
  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [title]);

  // V6.2 + V14 — track a pending diff for title/body/vystup (nápad resolution
  // summary). Dependency text on úkol has its own blur-save handler and is
  // intentionally NOT carried through this generic path.
  useEffect(() => {
    if (state.status !== "ready" || !initializedRef.current || isReadOnlyRef.current) {
      return;
    }
    const orig = state.task;
    const origVystup = orig.vystup ?? "";
    if (title === orig.title && body === orig.body && vystup === origVystup) {
      pendingRef.current = null;
    } else {
      pendingRef.current = { id: orig.id, title, body, vystup };
    }
  }, [title, body, vystup, state]);

  // Flush any pending edit on unmount (browser back, route change) and on page hide
  // (mobile background / tab switch). Fire-and-forget — component is going away.
  useEffect(() => {
    function flushPending() {
      // Cancel any blur-scheduled save so we don’t double-fire.
      if (blurSaveTimerRef.current !== null) {
        window.clearTimeout(blurSaveTimerRef.current);
        blurSaveTimerRef.current = null;
      }
      // V22 — never save from read-only views.
      if (isReadOnlyRef.current) { pendingRef.current = null; return; }
      const p = pendingRef.current;
      if (!p) return;
      // V22 — guard against saving empty/undefined title (data corruption).
      if (!p.title && !p.body) { pendingRef.current = null; return; }
      pendingRef.current = null;
      updateTask(p.id, { title: p.title, body: p.body, vystup: p.vystup }).catch((e) =>
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

  async function persist(patch: { title: string; body: string; vystup: string }) {
    if (state.status !== "ready" || isReadOnly) return;
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
    if (state.status !== "ready" || isReadOnlyRef.current) return;
    cancelBlurSave();
    blurSaveTimerRef.current = window.setTimeout(() => {
      blurSaveTimerRef.current = null;
      const p = pendingRef.current;
      if (!p) return;
      const finalTitle = capitalizeFirst(p.title);
      if (finalTitle !== p.title) setTitle(finalTitle);
      persist({ title: finalTitle, body: p.body, vystup: p.vystup });
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

  /** V22 refactor — DRY wrapper for single-field updateTask + save indicator. */
  async function saveField(patch: Parameters<typeof updateTask>[1]) {
    if (state.status !== "ready") return;
    setSaving(true);
    try {
      await updateTask(state.task.id, patch);
      flashSaved();
    } catch (e) {
      console.error("field save failed", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert() {
    if (state.status !== "ready" || !user) return;
    if (state.task.type !== "napad") return;
    if (!window.confirm(t("detail.convertConfirm"))) return;
    setConverting(true);
    try {
      const newId = await convertNapadToOtazka(state.task, user.uid, isPm ? "PROJECT_MANAGER" : "OWNER");
      navigate(taskDetail(newId));
    } catch (e) {
      console.error("convert failed", e);
      setConverting(false);
    }
  }

  async function handleConvertToUkol() {
    if (state.status !== "ready" || !user) return;
    if (state.task.type !== "napad") return;
    if (!window.confirm(t("detail.convertConfirmUkol"))) return;
    setConvertingUkol(true);
    try {
      const newId = await convertNapadToUkol(state.task, user.uid, isPm ? "PROJECT_MANAGER" : "OWNER");
      navigate(taskDetail(newId));
    } catch (e) {
      console.error("convert to úkol failed", e);
      setConvertingUkol(false);
    }
  }

  /** V18-S40 — In-place převod typu (otazka ↔ ukol). Zachová ID, autora,
   *  komentáře. Permission check duplicitně před serverside rule (UX). */
  async function handleChangeType(newType: "otazka" | "ukol") {
    if (state.status !== "ready") return;
    if (state.task.type !== "otazka" && state.task.type !== "ukol") return;
    if (newType === state.task.type) return;
    const confirmKey =
      newType === "ukol"
        ? "detail.changeTypeOtazkaToUkolConfirm"
        : "detail.changeTypeUkolToOtazkaConfirm";
    if (!window.confirm(t(confirmKey))) return;
    setChangingType(true);
    try {
      await changeTaskType(state.task.id, newType, state.task.type);
    } catch (e) {
      console.error("changeType failed", e);
    } finally {
      setChangingType(false);
    }
  }

  /** V18-S40 — Připojí stávající otázku/úkol k tématu (když je task=napad)
   *  nebo téma k otázce/úkolu (když task je otazka/ukol). Permission check
   *  ve volajícím (gating tlačítka přes canLinkTasks per kandidát). */
  async function handleLinkTo(otherId: string) {
    if (state.status !== "ready") return;
    const me = state.task;
    setLinkingId(otherId);
    try {
      if (me.type === "napad") {
        await linkTaskToNapad({ taskId: otherId, napadId: me.id });
      } else if (me.type === "otazka" || me.type === "ukol") {
        await linkTaskToNapad({ taskId: me.id, napadId: otherId });
      }
      setLinkPickerOpen(false);
    } catch (e) {
      console.error("link failed", e);
    } finally {
      setLinkingId(null);
    }
  }

  /** V18-S40 — Odebere link mezi tématem a otázkou/úkolem. Symmetric:
   *  funguje stejně z obou stran. Confirmuje. */
  async function handleUnlink(otherId: string) {
    if (state.status !== "ready") return;
    if (!window.confirm(t("detail.unlinkConfirm"))) return;
    const me = state.task;
    setLinkingId(otherId);
    try {
      if (me.type === "napad") {
        await unlinkTaskFromNapad({ taskId: otherId, napadId: me.id });
      } else if (me.type === "otazka" || me.type === "ukol") {
        await unlinkTaskFromNapad({ taskId: me.id, napadId: otherId });
      }
    } catch (e) {
      console.error("unlink failed", e);
    } finally {
      setLinkingId(null);
    }
  }

  async function handleAttachPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || state.status !== "ready" || !user) return;
    for (const f of files) {
      if (!isSupportedFile(f)) {
        setAttachError(t("detail.attachmentUnsupported"));
        return;
      }
    }
    setAttachError(null);
    setUploadingImage(true);
    try {
      const existing = state.task.attachmentImages ?? [];
      const uploaded: ImageAttachment[] = [];
      for (const file of files) {
        try {
          const uploader = isImageFile(file) ? uploadTaskImage : uploadTaskFile;
          const { url, path } = await uploader({
            file,
            uid: user.uid,
            taskId: state.task.id,
          });
          uploaded.push({ id: newId(), url, path });
        } catch (err) {
          console.error("single file upload failed", err);
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

  async function handleRemoveImage(img: ImageAttachment) {
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
    await saveField({ locationId: nextId });
  }

  async function handleCategoryChange(nextIds: string[]) {
    const legacy = nextIds[0] ?? null;
    await saveField({ categoryIds: nextIds, categoryId: legacy });
  }

  async function handleStatusChange(next: TaskStatus) {
    await saveField({ status: next });
  }

  async function handleAssigneeChange(nextUid: string | null) {
    await saveField({ assigneeUid: nextUid });
  }

  async function handlePriorityChange(next: TaskPriority) {
    await saveField({ priority: next });
  }

  async function handleShareRoleToggle(role: UserRole, checked: boolean) {
    if (state.status !== "ready") return;
    const current = state.task.sharedWithRoles ?? [];
    const next = checked
      ? [...new Set([...current, role])]
      : current.filter((r) => r !== role);
    await saveField({ sharedWithRoles: next });
  }
  async function handleDeadlineChange(nextMs: number | null) {
    await saveField({ deadline: nextMs });
  }

  async function handlePhaseChange(nextId: string | null) {
    await saveField({ phaseId: nextId });
  }
  async function handleDelete() {
    if (state.status !== "ready") return;
    if (!window.confirm(t("detail.confirmDelete"))) return;
    await deleteTask(state.task.id);
    navigate(-1);
  }

  // V20 — Dokumentace document handlers
  async function handleDocUploadConfirm(result: import("@/components/DocumentUploadModal").DocumentUploadResult) {
    if (state.status !== "ready" || !user) return;
    setDocModal({ open: false });
    setDocUploading(true);
    try {
      const task = state.task;
      const upload = isImageFile(result.file)
        ? await uploadTaskImage({ file: result.file, uid: user.uid, taskId: task.id })
        : await uploadTaskFile({ file: result.file, uid: user.uid, taskId: task.id });

      const newDoc: DocumentAttachment = {
        id: newId(),
        fileUrl: upload.url,
        filePath: upload.path,
        contentType: result.file.type || "application/octet-stream",
        sizeBytes: result.file.size,
        docType: result.docType,
        displayName: result.displayName,
        uploadedBy: user.uid,
        uploadedAt: new Date().toISOString(),
      };

      const existingDocs = task.documents ?? [];
      const auditEntry: AuditEntry = {
        action: docModal.replaceId ? "replaced" : "uploaded",
        actorUid: user.uid,
        timestamp: new Date().toISOString(),
        details: result.displayName,
      };

      let nextDocs: DocumentAttachment[];
      if (docModal.replaceId) {
        // Replace: remove old, add new
        const oldDoc = existingDocs.find((d) => d.id === docModal.replaceId);
        if (oldDoc) {
          deleteTaskImage(oldDoc.filePath).catch(console.warn);
        }
        nextDocs = existingDocs.filter((d) => d.id !== docModal.replaceId).concat(newDoc);
      } else {
        nextDocs = [...existingDocs, newDoc];
      }

      await updateTask(task.id, {
        documents: nextDocs,
        auditLog: [...(task.auditLog ?? []), auditEntry],
      });
    } catch (e) {
      console.error("doc upload failed", e);
      setAttachError(e instanceof Error ? e.message : String(e));
    } finally {
      setDocUploading(false);
    }
  }

  function handleReplaceDoc(docId: string) {
    if (state.status !== "ready") return;
    const doc = (state.task.documents ?? []).find((d) => d.id === docId);
    if (!doc) return;
    setDocModal({
      open: true,
      prefill: { docType: doc.docType, displayName: doc.displayName },
      replaceId: docId,
    });
  }

  async function handleDeleteDoc(docId: string, filePath: string) {
    if (state.status !== "ready" || !user) return;
    if (!window.confirm(t("dokumentace.deleteDocument"))) return;
    const task = state.task;
    const nextDocs = (task.documents ?? []).filter((d) => d.id !== docId);
    const auditEntry: AuditEntry = {
      action: "deleted",
      actorUid: user.uid,
      timestamp: new Date().toISOString(),
    };
    await updateTask(task.id, {
      documents: nextDocs,
      auditLog: [...(task.auditLog ?? []), auditEntry],
    });
    deleteTaskImage(filePath).catch(console.warn);
  }

  /** V23 — edit docType / displayName of an existing document without re-uploading. */
  async function handleEditDocMeta(docId: string) {
    if (state.status !== "ready" || !user) return;
    const doc = (state.task.documents ?? []).find((d) => d.id === docId);
    if (!doc) return;
    setDocMetaEdit({ docId, docType: doc.docType, displayName: doc.displayName });
  }

  async function commitDocMetaEdit() {
    if (state.status !== "ready" || !user || !docMetaEdit) return;
    const task = state.task;
    const { docId, docType: newType, displayName: newName } = docMetaEdit;
    const doc = (task.documents ?? []).find((d) => d.id === docId);
    if (!doc) return;
    if (newType === doc.docType && newName === doc.displayName) {
      setDocMetaEdit(null);
      return;
    }
    const nextDocs = (task.documents ?? []).map((d) =>
      d.id === docId ? { ...d, docType: newType.trim() || d.docType, displayName: newName.trim() || d.displayName } : d
    );
    const auditEntry: AuditEntry = {
      action: "metadata_changed",
      actorUid: user.uid,
      timestamp: new Date().toISOString(),
      details: newName.trim() || doc.displayName,
    };
    await updateTask(task.id, {
      documents: nextDocs,
      auditLog: [...(task.auditLog ?? []), auditEntry],
    });
    setDocMetaEdit(null);
  }

  // V20 — Link/unlink dokumentace from task
  async function handleLinkDocsConfirm(selectedIds: string[]) {
    if (state.status !== "ready") return;
    setDocPickerOpen(false);
    await updateTask(state.task.id, { linkedDocIds: selectedIds });
  }

  async function handleUnlinkDoc(docId: string) {
    if (state.status !== "ready") return;
    if (!window.confirm(t("dokumentace.linkRemoveConfirm"))) return;
    const current = state.task.linkedDocIds ?? [];
    await updateTask(state.task.id, { linkedDocIds: current.filter((id) => id !== docId) });
  }

  // ---- Render states ----

  // ---------- V20 — Title-first flow (create mode, no task in Firestore yet) ----------
  if (isCreateMode) {
    const { icon: TypeIconCreate, labelKey: createLabelKey } = TYPE_META[createType!];
    const typeLabelCreate = t(createLabelKey);

    async function handleTitleConfirm() {
      if (!title.trim() || !user) return;
      setSaving(true);
      try {
        const currentRole = roleState.status === "ready" ? roleState.profile.role : "OWNER";
        const finalTitle = capitalizeFirst(title.trim());
        setTitle(finalTitle);
        const taskId = await createTask(
          {
            type: createType!,
            title: finalTitle,
            body: "",
            status: createType === "dokumentace" ? "Nápad" : "OPEN",
          },
          user.uid,
          currentRole,
        );
        // Replace /t/new with /t/{realId} so back button won't re-enter create mode.
        navigate(taskDetail(taskId), { replace: true });
      } catch (err) {
        console.error("create task failed", err);
      } finally {
        setSaving(false);
      }
    }

    function handleCancelNew() {
      navigate(-1);
    }

    return (
      <article className="mx-auto max-w-xl px-4 pt-4 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={handleCancelNew}
            aria-label={t("detail.back")}
            className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
          >
            <ArrowLeft aria-hidden size={20} />
          </button>
          <div className="flex items-center gap-2">
            <TypeIconCreate aria-hidden size={20} style={{ color: TYPE_COLORS[createType!] }} />
            <h1 className="text-lg font-semibold text-ink">{typeLabelCreate}</h1>
          </div>
        </div>

        <div className="rounded-lg bg-surface shadow-sm ring-1 ring-line p-4">
          <label htmlFor="title-first-input" className="block text-sm font-medium text-ink-subtle mb-2">
            {t("titleFirst.titleLabel")}
          </label>
          <textarea
            id="title-first-input"
            ref={titleTextareaRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleTitleConfirm();
              }
            }}
            placeholder={t("titleFirst.titlePlaceholder")}
            rows={2}
            autoFocus
            autoCapitalize="sentences"
            spellCheck
            disabled={saving}
            className="block w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-base leading-relaxed placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-line-focus disabled:opacity-60"
          />
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelNew}
              disabled={saving}
              className="min-h-tap rounded-md px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
            >
              {t("titleFirst.cancel")}
            </button>
            <button
              type="button"
              onClick={handleTitleConfirm}
              disabled={!title.trim() || saving}
              className="min-h-tap rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover active:bg-accent-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t("titleFirst.saving") : t("titleFirst.create")}
            </button>
          </div>
        </div>

      </article>
    );
  }

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

  // V23 — visibility gate: block direct URL access for unauthorized users.
  const currentUserRole = roleState.status === "ready" ? roleState.profile.role : null;
  const hasViewAccess = canViewTask({
    task,
    currentUserUid: user?.uid,
    currentUserRole,
  });

  if (roleState.status === "ready" && !hasViewAccess) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-16 text-center">
        <p className="text-base font-medium text-ink">{t("detail.noAccess")}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          {t("detail.back")}
        </button>
      </div>
    );
  }

  // V17.1/V17.2/V17.8 — canEdit je pure helper. Předem resolvujeme
  //   authorRole přes user lookup (self-healing pro legacy tasky před
  //   V17.1 deploy, které nemají field). Rules dělají authoritative check
  //   serverside; tady jen UI gating.
  const taskAuthorRole = resolveAuthorRole({
    task,
    usersByUid: byUid,
  });
  const canEdit = canEditTask({
    task,
    taskAuthorRole,
    currentUserUid: user?.uid,
    currentUserRole,
  });
  const isReadOnly = !canEdit;
  isReadOnlyRef.current = isReadOnly;
  // V23 — delete is author-only, even for cross-OWNER edit.
  const canDelete = user?.uid === task.createdBy;
  const { icon: TypeIcon, labelKey: typeLabelKey } = TYPE_META[task.type];
  const typeLabel = t(typeLabelKey);
  // V14 — both otázka and úkol use the same rich meta layout (deadline,
  // priority, assignee). Nápad gets the simpler layout + Výstup section.
  const isActionable = task.type === "otazka" || task.type === "ukol";
  // Banner on nápad: "Doplň výstup" when nápad is in a closing status yet
  // the vystup field is still empty. Encourage summarising before it drops
  // off the radar. Statuses that count as "closing": Rozhodnuto / Ve stavbě /
  // Hotovo.
  const needsVystup =
    task.type === "napad" &&
    task.createdBy === user?.uid &&
    !(task.vystup ?? "").trim() &&
    (task.status === "Rozhodnuto" ||
      task.status === "Ve stavbě" ||
      task.status === "Hotovo");
  const created = new Date(task.createdAt);
  const updated = new Date(task.updatedAt);

  // V22 refactor — shared JSX blocks used in multiple type branches
  const showShareToggle = task.createdBy === user?.uid && !isReadOnly;
  const categoryIds = task.categoryIds ?? (task.categoryId ? [task.categoryId] : []);

  const shareToggle = showShareToggle && (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {(["PROJECT_MANAGER"] as UserRole[]).map((role) => (
        <label
          key={role}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-pill bg-bg-subtle px-3 py-1.5 text-sm text-ink-muted hover:bg-bg-muted transition-colors"
        >
          <input
            type="checkbox"
            checked={(task.sharedWithRoles ?? []).includes(role)}
            onChange={(e) => handleShareRoleToggle(role, e.target.checked)}
            disabled={saving}
            className="size-3 rounded border-line"
            style={{ accentColor: "var(--color-accent-visual)" }}
          />
          {t(`detail.role.${role}`)}
        </label>
      ))}
    </div>
  );

  const categorySection = (headingId: string) => (
    <section className="mt-4" aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {t("detail.categoryLabel")}
      </h2>
      <CategoryPicker
        value={categoryIds}
        categories={categories}
        onChange={handleCategoryChange}
        disabled={saving || isReadOnly}
      />
    </section>
  );

  return (
    <article className="mx-auto max-w-xl px-4 py-4" aria-labelledby="detail-title">
      <TopBar
        onBack={() => navigate(-1)}
        typeIcon={<TypeIcon aria-hidden size={18} style={{ color: TYPE_COLORS[task.type] }} />}
        typeLabel={typeLabel}
        onDelete={canDelete ? handleDelete : undefined}
      />

      {!isReadOnly && (
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-subtle" aria-live="polite">
          {saving ? (
            <span>{t("detail.autoSavingHint")}</span>
          ) : savedVisible ? (
            <span>{t("detail.autoSavedHint")}</span>
          ) : (
            <span aria-hidden>&nbsp;</span>
          )}
        </div>
      )}

      {needsVystup && (
        <div
          role="status"
          className="mt-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          style={{
            background: "var(--color-priority-p1-bg)",
            color: "var(--color-priority-p1-fg)",
            borderColor: "var(--color-priority-p1-border)",
          }}
        >
          <div className="min-w-0">
            <p className="font-semibold">{t("detail.vystupBannerTitle")}</p>
            <p className="mt-0.5 text-xs opacity-90">{t("detail.vystupBannerBody")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setVystupExpanded(true);
              // Defer so the expanded editor is in the DOM before we scroll.
              setTimeout(() => {
                const el = document.getElementById("vystup-section");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 0);
            }}
            className="shrink-0 min-h-tap rounded-md border border-current px-3 py-1 text-xs font-semibold hover:bg-black/5 transition-colors"
          >
            {t("detail.vystupBannerCta")}
          </button>
        </div>
      )}

      {/* V19 — Ball-on-me indicator, right-aligned, above title */}
      {isActionable && isBallOnMeV10(task, user?.uid) && (
        <div className="mb-2 flex justify-end">
          <div
            role="status"
            className="inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm"
            style={{
              background: "var(--color-priority-p1-bg)",
              color: "var(--color-priority-p1-fg)",
              borderColor: "var(--color-priority-p1-border)",
            }}
          >
            <span aria-hidden className="inline-block size-1.5 rounded-full" style={{ background: "var(--color-priority-p1-dot)" }} />
            {t("detail.ballOnMe")}
          </div>
        </div>
      )}

      <label htmlFor="detail-title" className="sr-only">
        {t("detail.titlePrimary")}
      </label>
      <textarea
        id="detail-title"
        ref={titleTextareaRef}
        value={title}
        readOnly={isReadOnly}
        onChange={(e) => {
          if (isReadOnly) return;
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
        onBlur={isReadOnly ? undefined : flushOnBlur}
        onFocus={isReadOnly ? undefined : handleEditorFocus}
        rows={1}
        placeholder={isReadOnly ? undefined : t("detail.titlePlaceholderV2")}
        autoCapitalize="sentences"
        className="mt-2 block w-full resize-none overflow-hidden border-0 border-b border-transparent bg-transparent px-0 py-1 text-xl sm:text-2xl font-bold leading-tight text-ink placeholder:text-ink-subtle focus:border-b-line-focus focus:outline-none focus:ring-0"
      />

      {task.type !== "dokumentace" && (
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
            onChange={isReadOnly ? () => {} : setBody}
            onBlur={isReadOnly ? undefined : flushOnBlur}
            onFocus={isReadOnly ? undefined : handleEditorFocus}
            placeholder={isReadOnly ? undefined : t("detail.bodyPlaceholder")}
            ariaLabel={t("detail.bodyLabel")}
            disabled={isReadOnly}
          />
        </Suspense>
      </div>
      )}

      {isActionable ? (
        <>
          {/* V19 — Single row: Status, Priority, Phase, Location */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPickerInline
              value={task.status}
              onChange={handleStatusChange}
              disabled={saving || isReadOnly}
              type={task.type}
              isPm={isPm}
            />
            {(task.createdBy === user?.uid || isReadOnly) && (
              <PriorityPickerInline
                value={task.priority}
                onChange={handlePriorityChange}
                disabled={saving || isReadOnly}
              />
            )}
            <PhasePickerInline
              value={task.phaseId ?? null}
              onChange={handlePhaseChange}
              disabled={saving || isReadOnly}
            />
            <LocationPickerInline
              value={task.locationId ?? null}
              onChange={handleLocationChange}
              disabled={saving || isReadOnly}
            />
          </div>

          {/* Categories under location/phase */}
          {categorySection("cat-heading-act")}

          {/* V19 — Deadline + Assignee row */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            {(task.createdBy === user?.uid || isReadOnly) && (
              <section aria-labelledby="deadline-heading">
                <h2 id="deadline-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  {t("deadline.label")}
                </h2>
                <DeadlinePicker
                  value={task.deadline ?? null}
                  onChange={handleDeadlineChange}
                  disabled={saving || isReadOnly}
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
                disabled={saving || isReadOnly}
                readOnly={isReadOnly || !(task.createdBy === user?.uid)}
              />
            </section>
          </div>
        </>
      ) : task.type === "dokumentace" ? (
        <>
          {/* V20 — Dokumentace: sharedWithRoles + location + categories + empty documents */}
          {shareToggle}

          {/* Categories */}
          {categorySection("cat-heading-dok")}

          {/* Documents — upload + cards */}
          <section className="mt-6" aria-labelledby="docs-heading">
            <h2 id="docs-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("dokumentace.sectionTitle")}
            </h2>
            {(task.documents?.length ?? 0) > 0 && (
              <ul className="mb-3 flex flex-col gap-2">
                {task.documents!.map((docItem) => {
                  const isEditing = docMetaEdit?.docId === docItem.id;
                  return (
                  <li
                    key={docItem.id}
                    className="group rounded-md border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-bg-subtle"
                  >
                    {isEditing ? (
                      <DocMetaEditRow
                        docType={docMetaEdit!.docType}
                        displayName={docMetaEdit!.displayName}
                        onDocTypeChange={(v) => setDocMetaEdit((prev) => prev ? { ...prev, docType: v } : prev)}
                        onDisplayNameChange={(v) => setDocMetaEdit((prev) => prev ? { ...prev, displayName: v } : prev)}
                        onSave={commitDocMetaEdit}
                        onCancel={() => setDocMetaEdit(null)}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => window.open(docItem.fileUrl, "_blank")}
                          className="flex flex-1 items-center gap-3 min-w-0 text-left"
                          aria-label={docItem.displayName}
                        >
                          <FileText aria-hidden size={20} className="shrink-0 text-accent-visual" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink truncate">{docItem.displayName}</p>
                            <p className="text-xs text-ink-muted">{docItem.docType}</p>
                          </div>
                        </button>
                        {!isReadOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditDocMeta(docItem.id)}
                              disabled={docUploading}
                              aria-label={t("common.edit")}
                              className="grid size-8 place-items-center rounded text-ink-subtle opacity-0 group-hover:opacity-100 hover:text-ink transition-opacity"
                            >
                              <Pencil aria-hidden size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReplaceDoc(docItem.id)}
                              disabled={docUploading}
                              aria-label={t("dokumentace.replaceDocument")}
                              className="grid size-8 place-items-center rounded text-ink-subtle opacity-0 group-hover:opacity-100 hover:text-ink transition-opacity"
                            >
                              <Upload aria-hidden size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc(docItem.id, docItem.filePath)}
                              disabled={docUploading}
                              aria-label={t("dokumentace.deleteDocument")}
                              className="grid size-8 place-items-center rounded text-ink-subtle opacity-0 group-hover:opacity-100 hover:text-[color:var(--color-status-danger-fg)] transition-opacity"
                            >
                              <Trash2 aria-hidden size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setDocModal({ open: true })}
                disabled={docUploading}
                className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-2 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
              >
                <FileText aria-hidden size={18} />
                {docUploading ? t("dokumentace.uploadingDocument") : t("dokumentace.addDocument")}
              </button>
            )}
            {docModal.open && (
              <Suspense fallback={null}>
                <DocumentUploadModal
                  prefill={docModal.prefill}
                  onConfirm={handleDocUploadConfirm}
                  onClose={() => setDocModal({ open: false })}
                />
              </Suspense>
            )}
          </section>

          {/* Audit trail */}
          {(task.auditLog?.length ?? 0) > 0 && (
            <Suspense fallback={null}>
              <AuditTimeline entries={task.auditLog!} />
            </Suspense>
          )}
        </>
      ) : (
        <>
          {/* V19 — Visible for roles */}
          {shareToggle}

          {/* V19 — Single row: Status, Phase, Location */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPickerInline
              value={task.status}
              onChange={handleStatusChange}
              disabled={saving || isReadOnly}
              type={task.type}
              isPm={isPm}
            />
            <PhasePickerInline
              value={task.phaseId ?? null}
              onChange={handlePhaseChange}
              disabled={saving || isReadOnly}
            />
            <LocationPickerInline
              value={task.locationId ?? null}
              onChange={handleLocationChange}
              disabled={saving || isReadOnly}
            />
          </div>

          {/* Categories */}
          {categorySection("cat-heading-napad")}
        </>
      )}

      {task.type !== "dokumentace" && (
      <section className="mt-4" aria-labelledby="att-heading">
        <h2 id="att-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("detail.attachmentLabel")}
        </h2>
        {(task.attachmentImages?.length ?? 0) > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {task.attachmentImages!.map((img, idx) => {
              const pdf = /\.pdf[?#]|%2F[^?]*\.pdf/i.test(img.url) || img.path?.endsWith(".pdf");
              return (
              <li key={img.id ?? idx} className="relative">
                {pdf ? (
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-20 flex-col items-center justify-center gap-1 rounded-md bg-bg-subtle ring-1 ring-line hover:ring-line-strong"
                    aria-label="PDF"
                  >
                    <FileText aria-hidden size={24} className="text-ink-muted" />
                    <span className="text-[10px] font-medium text-ink-muted">PDF</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLightbox(img.url)}
                    className="block size-20 overflow-hidden rounded-md ring-1 ring-line hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-line-focus"
                    aria-label={t("aria.openImagePreview")}
                  >
                    <img
                      src={img.url}
                      alt=""
                      width={80}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  </button>
                )}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img)}
                    disabled={uploadingImage}
                    aria-label={t("detail.removePhoto")}
                    className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-black/75 text-white shadow hover:bg-black disabled:opacity-40"
                  >
                    <XIcon aria-hidden size={10} />
                  </button>
                )}
              </li>
              );
            })}
          </ul>
        )}
        {!isReadOnly && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-2 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
            >
              <ImageIcon aria-hidden size={18} />
              {uploadingImage ? t("detail.uploading") : t("detail.addFile")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={handleAttachPick}
            />
            {attachError && (
              <p role="alert" className="mt-2 text-xs text-[color:var(--color-status-danger-fg)]">
                {attachError}
              </p>
            )}
          </>
        )}
      </section>
      )}

      {lightbox && (
        <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}

      {task.type !== "dokumentace" && (
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
                {!isReadOnly && (
                  <>
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
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => handleLinkEdit(-1)}
            disabled={saving}
            className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-2 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
          >
            <LinkIconLc aria-hidden size={18} />
            {t("detail.linkAdd")}
          </button>
        )}
      </section>
      )}

      {/* V20 — Linked dokumentace (for napad/otazka/ukol) */}
      {task.type !== "dokumentace" && (
        <section className="mt-4" aria-labelledby="linked-docs-heading">
          <h2 id="linked-docs-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t("dokumentace.linkSectionTitle")}
          </h2>
          {(task.linkedDocIds?.length ?? 0) > 0 && (
            <ul className="mb-2 flex flex-col gap-2">
              {task.linkedDocIds!.map((docId) => {
                const linkedDoc = allTasks.find((x) => x.id === docId);
                if (!linkedDoc) return null;
                if (!canViewTask({ task: linkedDoc, currentUserUid: user?.uid, currentUserRole })) return null;
                return (
                  <li key={docId}>
                    <SwipeReveal
                      disabled={!canEdit}
                      action={
                        <button
                          type="button"
                          onClick={() => handleUnlinkDoc(docId)}
                          disabled={saving}
                          aria-label={t("dokumentace.unlinkDoc")}
                          className="flex h-full w-full items-center justify-center bg-[color:var(--color-status-danger-fg)] text-white text-xs font-semibold disabled:opacity-40"
                        >
                          {t("dokumentace.unlinkDoc")}
                        </button>
                      }
                    >
                      <Link
                        to={taskDetail(docId)}
                        className="flex items-center gap-3 min-w-0 rounded-md border border-line bg-surface px-3 py-2.5 hover:bg-bg-subtle transition-colors"
                      >
                        <FileText aria-hidden size={18} className="shrink-0 text-accent-visual" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">
                            {linkedDoc.title?.trim() || t("detail.noTitle")}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {(linkedDoc.documents?.length ?? 0)} {t("dokumentace.linkDocCount")}
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUnlinkDoc(docId); }}
                            disabled={saving}
                            aria-label={t("dokumentace.unlinkDoc")}
                            className="shrink-0 grid size-8 place-items-center rounded-md text-ink-subtle hover:text-[color:var(--color-status-danger-fg)] disabled:opacity-40 transition-colors"
                          >
                            <XIcon aria-hidden size={16} />
                          </button>
                        )}
                      </Link>
                    </SwipeReveal>
                  </li>
                );
              }).filter(Boolean)}
            </ul>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setDocPickerOpen(true)}
              disabled={saving}
              className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-2 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
            >
              <FileText aria-hidden size={18} />
              {t("dokumentace.linkAdd")}
            </button>
          )}
          {docPickerOpen && (
            <Suspense fallback={null}>
              <DocumentPickerModal
                documents={allTasks.filter((x) => x.type === "dokumentace" && canViewTask({ task: x, currentUserUid: user?.uid, currentUserRole }))}
                alreadyLinked={task.linkedDocIds ?? []}
                onConfirm={handleLinkDocsConfirm}
                onClose={() => setDocPickerOpen(false)}
              />
            </Suspense>
          )}
        </section>
      )}

      {task.type === "napad" && (task.linkedTaskIds?.length ?? 0) > 0 && (() => {
        // V14.1 — split linked children into Otázky / Úkoly lists so the
        // user sees both flows at a glance. An unknown-typed link (orphan)
        // falls into the otázka bucket to stay visible.
        const resolved = (task.linkedTaskIds ?? [])
          .map((lid) => ({ lid, ot: allTasks.find((x) => x.id === lid) }))
          .filter((x) => x.ot)
          .filter((x) => canViewTask({ task: x.ot!, currentUserUid: user?.uid, currentUserRole }));
        const otazkaLinks = resolved.filter(({ ot }) => ot?.type !== "ukol");
        const ukolLinks = resolved.filter(({ ot }) => ot?.type === "ukol");
        const canUnlinkRow = (other: TaskT) => {
          const otherAuthorRole = resolveAuthorRole({ task: other, usersByUid: byUid });
          return canLinkTasks({
            task,
            taskAuthorRole,
            other,
            otherAuthorRole,
            currentUserUid: user?.uid,
            currentUserRole,
          });
        };
        return (
          <>
            <LinkedList
              items={otazkaLinks}
              headingId="linked-otazky-heading"
              heading={t("detail.linkedOtazkyTitle")}
              fallbackIcon={HelpCircleIcon}
              forceIcon={HelpCircleIcon}
              isPm={isPm}
              t={t}
              canUnlink={canUnlinkRow}
              onUnlink={handleUnlink}
              unlinkingId={linkingId}
            />
            <LinkedList
              items={ukolLinks}
              headingId="linked-ukoly-heading"
              heading={t("detail.linkedUkolyTitle")}
              fallbackIcon={Target}
              forceIcon={Target}
              isPm={isPm}
              t={t}
              canUnlink={canUnlinkRow}
              onUnlink={handleUnlink}
              unlinkingId={linkingId}
            />
          </>
        );
      })()}

      {(task.type === "otazka" || task.type === "ukol") && (() => {
        // V18-S40 — many-to-many: zobrazujeme všechna napojená témata (nápady).
        // linkedTaskIds zahrnuje i bridgnutý legacy linkedTaskId (viz fromDocSnap).
        const parentIds = task.linkedTaskIds ?? [];
        const parents = parentIds
          .map((pid) => allTasks.find((x) => x.id === pid))
          .filter((p): p is TaskT => !!p && p.type === "napad")
          .filter((p) => canViewTask({ task: p, currentUserUid: user?.uid, currentUserRole }));
        if (parents.length === 0 && isReadOnly) return null;
        return (
          <section className="mt-4" aria-labelledby="linked-temata-heading">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2
                id="linked-temata-heading"
                className="text-xs font-semibold uppercase tracking-wide text-ink-subtle"
              >
                {t("detail.linkedTemataTitle")}
              </h2>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setLinkPickerOpen(true)}
                  disabled={!!linkingId}
                  className="inline-flex items-center gap-1 min-h-tap rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
                >
                  <LinkIconLc aria-hidden size={14} className="text-accent-visual" />
                  {t("detail.addLinkToTema")}
                </button>
              )}
            </div>
            {parents.length === 0 ? (
              <p className="text-sm text-ink-subtle">{t("detail.linkedTemataEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {parents.map((parent) => {
                  const ptitle =
                    parent.title?.trim() ||
                    parent.body?.split("\n")[0]?.trim().slice(0, 80) ||
                    t("detail.noTitle");
                  const parentAuthorRole = resolveAuthorRole({ task: parent, usersByUid: byUid });
                  const canUnlink = canLinkTasks({
                    task,
                    taskAuthorRole,
                    other: parent,
                    otherAuthorRole: parentAuthorRole,
                    currentUserUid: user?.uid,
                    currentUserRole,
                  });
                  return (
                    <li
                      key={parent.id}
                      className="flex items-stretch gap-1 rounded-md border border-line bg-surface hover:bg-bg-subtle transition-colors"
                    >
                      <Link
                        to={taskDetail(parent.id)}
                        className="flex flex-1 items-start gap-3 min-w-0 px-2 py-1.5"
                      >
                        <Lightbulb aria-hidden size={18} className="text-ink-subtle shrink-0 mt-0.5" />
                        <p className="text-sm text-ink break-words [overflow-wrap:anywhere] line-clamp-3">{ptitle}</p>
                      </Link>
                      {canUnlink && (
                        <button
                          type="button"
                          onClick={() => handleUnlink(parent.id)}
                          disabled={linkingId === parent.id}
                          aria-label={t("detail.unlinkAria")}
                          className="grid place-items-center shrink-0 w-12 text-ink-subtle hover:bg-bg-muted hover:text-ink disabled:opacity-40 transition-colors"
                        >
                          <XIcon aria-hidden size={16} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })()}

      {task.type === "napad" && !isReadOnly && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLinkPickerOpen(true)}
            disabled={converting || convertingUkol || saving || !!linkingId}
            className="inline-flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
          >
            <LinkIconLc aria-hidden size={16} className="text-accent-visual" />
            {t("detail.linkExistingToTema")}
          </button>
          <button
            type="button"
            onClick={handleConvert}
            disabled={converting || convertingUkol || saving}
            className="inline-flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
          >
            <HelpCircle aria-hidden size={16} className="text-accent-visual" />
            {converting
              ? t("detail.converting")
              : (task.linkedTaskIds ?? []).some(
                  (lid) => allTasks.find((x) => x.id === lid)?.type === "otazka",
                )
              ? t("detail.convertToOtazkaAgain")
              : t("detail.convertToOtazka")}
          </button>
          <button
            type="button"
            onClick={handleConvertToUkol}
            disabled={converting || convertingUkol || saving}
            className="inline-flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
          >
            <Target aria-hidden size={16} className="text-accent-visual" />
            {convertingUkol
              ? t("detail.convertingUkol")
              : (task.linkedTaskIds ?? []).some(
                  (lid) => allTasks.find((x) => x.id === lid)?.type === "ukol",
                )
              ? t("detail.convertToUkolAgain")
              : t("detail.convertToUkol")}
          </button>
        </div>
      )}

      {(task.type === "otazka" || task.type === "ukol") && canChangeTaskType({
        task,
        taskAuthorRole,
        currentUserUid: user?.uid,
        currentUserRole,
      }) && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              handleChangeType(task.type === "otazka" ? "ukol" : "otazka")
            }
            disabled={changingType || saving}
            className="inline-flex items-center gap-2 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
          >
            {task.type === "otazka" ? (
              <Target aria-hidden size={16} className="text-accent-visual" />
            ) : (
              <HelpCircle aria-hidden size={16} className="text-accent-visual" />
            )}
            {changingType
              ? t("detail.changingType")
              : task.type === "otazka"
                ? t("detail.changeTypeToUkol")
                : t("detail.changeTypeToOtazka")}
          </button>
        </div>
      )}

      {task.type === "napad" && (task.createdBy === user?.uid || isReadOnly) && (
        <section id="vystup-section" className="mt-6" aria-labelledby="vystup-heading">
          <button
            type="button"
            onClick={() => setVystupExpanded((v) => !v)}
            aria-expanded={vystupExpanded}
            aria-controls="vystup-content"
            className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left hover:bg-bg-subtle transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                id="vystup-heading"
                className="text-xs font-semibold uppercase tracking-wide text-ink-subtle"
              >
                {t("detail.vystupLabel")}
              </span>
              <span className="text-xs text-ink-subtle">
                {(task.vystup ?? "").trim()
                  ? t("detail.vystupFilledHint")
                  : t("detail.vystupEmptyHint")}
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-ink-subtle">
              <ChevronDown
                size={14}
                className={`transition-transform duration-fast ${vystupExpanded ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          <div
            id="vystup-content"
            className={`overflow-hidden transition-[grid-template-rows] duration-300 ease-out grid ${vystupExpanded ? "grid-rows-[1fr] mt-2" : "grid-rows-[0fr]"}`}
          >
            <div className="min-h-0">
              <Suspense
                fallback={
                  <div
                    className="min-h-[8rem] rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-subtle"
                    aria-busy="true"
                    role="status"
                  >
                    {t("detail.editorLoading")}
                  </div>
                }
              >
                <RichTextEditor
                  value={vystup}
                  onChange={isReadOnly ? () => {} : setVystup}
                  onBlur={isReadOnly ? undefined : flushOnBlur}
                  onFocus={isReadOnly ? undefined : handleEditorFocus}
                  placeholder={isReadOnly ? undefined : t("detail.vystupPlaceholder")}
                  ariaLabel={t("detail.vystupLabel")}
                  disabled={isReadOnly}
                />
              </Suspense>
            </div>
          </div>
        </section>
      )}

      {/* Diskuse — u nápadů + dokumentace defaultně zavřená */}
      <section className="mt-6" aria-labelledby="comments-heading">
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          aria-controls="comments-content"
          className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left hover:bg-bg-subtle transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span
              id="comments-heading"
              className="text-xs font-semibold uppercase tracking-wide text-ink-subtle"
            >
              {t("comments.count", { n: task.commentCount ?? 0 })}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-ink-subtle">
            <ChevronDown
              size={14}
              className={`transition-transform duration-fast ${commentsOpen ? "rotate-180" : ""}`}
            />
          </span>
        </button>
        {/* Always mounted so data loads in the background; CSS hides when collapsed */}
        <div
          id="comments-content"
          className={`overflow-hidden transition-[grid-template-rows] duration-300 ease-out grid ${commentsOpen ? "grid-rows-[1fr] mt-2" : "grid-rows-[0fr]"}`}
        >
          <div className="min-h-0">
            <Suspense fallback={<div className="min-h-[10rem] rounded-md bg-surface ring-1 ring-line animate-pulse" aria-busy="true" />}>
              <CommentThread task={task} />
            </Suspense>
          </div>
        </div>
      </section>

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

      {linkPickerOpen && (
        <Suspense fallback={null}>
          <TaskLinkPickerModal
            me={task}
            meAuthorRole={taskAuthorRole}
            allTasks={allTasks}
            usersByUid={byUid}
            currentUserUid={user?.uid}
            currentUserRole={currentUserRole}
            onPick={handleLinkTo}
            onClose={() => setLinkPickerOpen(false)}
            busyId={linkingId}
          />
        </Suspense>
      )}
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
  onDelete?: () => void;
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

      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("detail.delete")}
          className="-mr-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:text-[color:var(--color-status-danger-fg)] hover:bg-bg-subtle"
        >
          <Trash2 aria-hidden size={20} />
        </button>
      ) : (
        <span className="w-10" aria-hidden />
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

/** Inline row for editing docType + displayName of an existing document. */
function DocMetaEditRow({
  docType,
  displayName,
  onDocTypeChange,
  onDisplayNameChange,
  onSave,
  onCancel,
}: {
  docType: string;
  displayName: string;
  onDocTypeChange: (v: string) => void;
  onDisplayNameChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const { documentTypes } = useDocumentTypes(true);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          value={docType}
          onChange={(e) => onDocTypeChange(e.target.value)}
          className="min-h-tap flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-line-focus focus:outline-none"
        >
          {documentTypes.map((dt) => (
            <option key={dt.id} value={dt.label}>{dt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            placeholder={t("dokumentace.uploadDisplayNamePlaceholder")}
            className="min-h-tap w-full rounded-md border border-line bg-surface px-2 py-1.5 pr-8 text-sm text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none"
            autoFocus
          />
          {displayName && (
            <button
              type="button"
              onClick={() => onDisplayNameChange("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded text-ink-muted hover:text-ink"
              aria-label={t("common.delete")}
            >
              <XIcon aria-hidden size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          aria-label={t("common.save")}
          className="grid min-h-tap min-w-tap place-items-center rounded-md text-accent hover:bg-bg-subtle"
        >
          <Check aria-hidden size={18} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("common.cancel")}
          className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
        >
          <XIcon aria-hidden size={18} />
        </button>
      </div>
    </div>
  );
}
