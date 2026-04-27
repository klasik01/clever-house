import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, HelpCircle, MapPin, Notebook, Tag, Target, Trash2 } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useTask } from "@/hooks/useTask";
import { useTasks } from "@/hooks/useTasks";
import { convertNapadToOtazka, convertNapadToUkol, deleteTask, updateTask } from "@/lib/tasks";
import { newId } from "@/lib/id";
import { useUserRole } from "@/hooks/useUserRole";
import { canEditTask } from "@/lib/permissions";
import { resolveAuthorRole } from "@/lib/authorRole";
import CategoryPicker from "@/components/CategoryPicker";
import LocationPickerInline from "@/components/LocationPickerInline";
import PhasePickerInline from "@/components/PhasePickerInline";
import StatusPickerInline from "@/components/StatusPickerInline";
import PriorityPickerInline from "@/components/PriorityPickerInline";
import AssigneeSelect from "@/components/AssigneeSelect";
import DeadlinePicker from "@/components/DeadlinePicker";
import StatusBadge, { statusColors } from "@/components/StatusBadge";
import Lightbox from "@/components/Lightbox";
import { deleteTaskImage, isSupportedFile, isImageFile, uploadTaskImage, uploadTaskFile } from "@/lib/attachments";
import { ArrowRight, ExternalLink, HelpCircle as HelpCircleIcon, Image as ImageIcon, Lightbulb, Link as LinkIconLc, Pencil, X as XIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { normalizeUrl, parseDomain } from "@/lib/links";
import LinkFavicon from "@/components/LinkFavicon";
import { useCategories } from "@/hooks/useCategories";
import { getLocation } from "@/lib/locations";
import { useAuth } from "@/hooks/useAuth";
import { useUsers } from "@/hooks/useUsers";
import type { TaskStatus } from "@/types";
import { isBallOnMe as isBallOnMeV10, mapLegacyOtazkaStatus, statusLabel } from "@/lib/status";
import { taskDetail } from "@/lib/routes";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));
const CommentThread = lazy(() => import("@/components/CommentThread"));
const DocumentUploadModal = lazy(() => import("@/components/DocumentUploadModal"));
const AuditTimeline = lazy(() => import("@/components/AuditTimeline"));
const DocumentPickerModal = lazy(() => import("@/components/DocumentPickerModal"));

// ---------- LinkedList (V14.1) ----------

type LinkedItem = { lid?: string; ot?: import("@/types").Task };

function LinkedList({
  items,
  headingId,
  heading,
  forceIcon,
  isPm,
  t,
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
          return (
            <li key={lid ?? ot?.id}>
              <Link
                to={taskDetail(lid ?? ot?.id ?? "")}
                className="flex items-center justify-between gap-3 rounded-md border border-l-4 bg-surface px-4 py-3 hover:bg-bg-subtle transition-colors"
                style={{
                  borderLeftColor: c ? c.border : "var(--color-border-default)",
                  borderTopColor: "var(--color-border-default)",
                  borderRightColor: "var(--color-border-default)",
                  borderBottomColor: "var(--color-border-default)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Icon aria-hidden size={18} className="text-accent-visual shrink-0" />
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
                        {statusLabel(t as unknown as (k: string) => string, ot.status, { isPm, type: ot.type })}
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
}

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
  // V14 — nápad-only "Výstup" markdown (resolution summary).
  const [vystup, setVystup] = useState("");
  // V14 — úkol-only free-text dependency ("Hotové před …").
  // V19 — dependencyText state removed (UI removed)
  const initializedRef = useRef(false);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef<{ id: string; title: string; body: string; vystup: string } | null>(null);
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
  const [convertingUkol, setConvertingUkol] = useState(false);
  // V14.1 — Výstup section is collapsed by default. User explicitly opens it
  // via the toggle or via the "Doplň výstup" banner CTA. Reset on route change.
  const [vystupExpanded, setVystupExpanded] = useState(false);

  // V20 — Dokumentace document upload state
  const [docModal, setDocModal] = useState<{
    open: boolean;
    prefill?: { docType: string; displayName: string };
    replaceId?: string;
  }>({ open: false });
  const [docUploading, setDocUploading] = useState(false);
  const [docPickerOpen, setDocPickerOpen] = useState(false);

  useEffect(() => {
    if (state.status === "ready" && !initializedRef.current) {
      setTitle(state.task.title);
      setBody(state.task.body);
      setVystup(state.task.vystup ?? "");
      // V19 — dependencyText sync removed
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
    // V19 — setDependencyText removed
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
    if (state.status !== "ready" || !initializedRef.current) {
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
      const p = pendingRef.current;
      if (!p) return;
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
      persist({ title: p.title, body: p.body, vystup: p.vystup });
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

  // V19 — handleDependencyBlur removed (dependencyText UI removed)

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
      const uploaded: import("@/types").ImageAttachment[] = [];
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



  async function handleShareRoleToggle(role: import("@/types").UserRole, checked: boolean) {
    if (state.status !== "ready") return;
    const current = state.task.sharedWithRoles ?? [];
    const next = checked
      ? [...new Set([...current, role])]
      : current.filter((r) => r !== role);
    setSaving(true);
    try {
      await updateTask(state.task.id, { sharedWithRoles: next });
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

      const newDoc: import("@/types").DocumentAttachment = {
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
      const auditEntry: import("@/types").AuditEntry = {
        action: docModal.replaceId ? "replaced" : "uploaded",
        actorUid: user.uid,
        timestamp: new Date().toISOString(),
        details: result.displayName,
      };

      let nextDocs: import("@/types").DocumentAttachment[];
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
    const auditEntry: import("@/types").AuditEntry = {
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
    currentUserRole: roleState.status === "ready" ? roleState.profile.role : null,
  });
  const isReadOnly = !canEdit;
  const TypeIcon =
    task.type === "otazka"
      ? HelpCircle
      : task.type === "ukol"
      ? Target
      : task.type === "dokumentace"
      ? FileText
      : Notebook;

  // ---------- Read-only view (V17.2) ----------
  // Aktivuje se když current user nemá edit práva na tento task:
  //   - PM na OWNER-vytvořeném napadu/otazce/ukolu (klasický scénář)
  //   - OWNER na PM-vytvořeném tasku (novinka V17.1)
  // Napad v praxi vždy OWNER-created → OWNER jej má edit, sem spadne jen PM.
  if (isReadOnly) {
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
                    <LinkFavicon url={url} size={14} />
                    <span className="truncate max-w-[22rem]">{parseDomain(url) ?? url}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Linked otázky + úkoly — PM sees only ones assigned to themselves. */}
          {(() => {
            const pmLinkedAll = (task.linkedTaskIds ?? [])
              .map((lid) => ({ lid, ot: allTasks.find((x) => x.id === lid) }))
              .filter(({ ot }) => ot && ot.assigneeUid === user?.uid);
            if (pmLinkedAll.length === 0) return null;
            const pmOtazky = pmLinkedAll.filter(({ ot }) => ot?.type !== "ukol");
            const pmUkoly = pmLinkedAll.filter(({ ot }) => ot?.type === "ukol");
            return (
              <>
                <LinkedList
                  items={pmOtazky}
                  headingId="pm-linked-otazky-heading"
                  heading={t("detail.linkedOtazkyTitle")}
                  fallbackIcon={HelpCircleIcon}
                  forceIcon={HelpCircleIcon}
                  isPm={true}
                  t={t}
                />
                <LinkedList
                  items={pmUkoly}
                  headingId="pm-linked-ukoly-heading"
                  heading={t("detail.linkedUkolyTitle")}
                  fallbackIcon={Target}
                  forceIcon={Target}
                  isPm={true}
                  t={t}
                />
              </>
            );
          })()}

          {/* V14 — PM can convert an owner nápad into either a new otázka
              (clarification) or a new úkol (actionable). They become the
              assignee on whichever they create. */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
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

          {/* V14.2 — PM sees Výstup read-only. Same collapsible UX as OWNER so
              the detail layout stays consistent between roles. */}
          <section id="vystup-section" className="mt-6" aria-labelledby="vystup-heading-pm">
            <button
              type="button"
              onClick={() => setVystupExpanded((v) => !v)}
              aria-expanded={vystupExpanded}
              aria-controls="vystup-content-pm"
              className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left hover:bg-bg-subtle transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  id="vystup-heading-pm"
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
              <span aria-hidden className="shrink-0 text-xs text-ink-subtle">
                {vystupExpanded ? "▾" : "▸"}
              </span>
              <span className="sr-only">
                {vystupExpanded ? t("detail.vystupHide") : t("detail.vystupShow")}
              </span>
            </button>
            {vystupExpanded && (
              <div id="vystup-content-pm" className="mt-2">
                {(task.vystup ?? "").trim() ? (
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
                      value={task.vystup ?? ""}
                      onChange={() => {}}
                      disabled
                      ariaLabel={t("detail.vystupLabel")}
                    />
                  </Suspense>
                ) : (
                  <p className="text-sm text-ink-subtle">{t("detail.bodyEmpty")}</p>
                )}
              </div>
            )}
          </section>

          <Suspense fallback={<div className="mt-6 min-h-[17rem] rounded-md bg-surface ring-1 ring-line animate-pulse" aria-busy="true" />}>
            <CommentThread task={task} />
          </Suspense>

          {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
        </article>
      );
    }

    // V20 — Dokumentace read-only view. Minimal: title + description + location/categories + documents list.
    if (task.type === "dokumentace") {
      const categoryIdsDok = task.categoryIds?.length
        ? task.categoryIds
        : task.categoryId ? [task.categoryId] : [];
      const taskCategoriesDok = categoryIdsDok
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      return (
        <article className="mx-auto max-w-xl px-4 py-4" aria-labelledby="ro-dok-heading">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={t("detail.back")}
              className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
            >
              <ArrowLeft aria-hidden size={20} />
            </button>
            <div
              className="flex items-center gap-1.5 rounded-pill bg-bg-subtle px-3 py-1 text-xs font-medium text-ink-muted"
              aria-label={t("detail.typeDokumentace")}
            >
              <FileText aria-hidden size={14} />
              <span>{t("detail.typeDokumentace")}</span>
            </div>
            <span className="w-10" aria-hidden />
          </div>

          <h1 id="ro-dok-heading" className="mt-3 text-xl font-bold leading-tight text-ink">
            {task.title || t("detail.noTitle")}
          </h1>

          {taskCategoriesDok.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {taskCategoriesDok.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                  <Tag aria-hidden size={11} />
                  {c.label}
                </span>
              ))}
            </div>
          )}

          {/* Documents list — read-only */}
          <section className="mt-6" aria-labelledby="ro-docs-heading">
            <h2 id="ro-docs-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("dokumentace.sectionTitle")}
            </h2>
            {(task.documents?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-muted">{t("dokumentace.emptyDocuments")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {task.documents!.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2"
                  >
                    <FileText aria-hidden size={18} className="shrink-0 text-ink-subtle" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{doc.displayName}</p>
                      <p className="text-xs text-ink-muted">{doc.docType}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Audit trail — read-only */}
          {(task.auditLog?.length ?? 0) > 0 && (
            <Suspense fallback={null}>
              <AuditTimeline entries={task.auditLog!} />
            </Suspense>
          )}
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
                  <LinkFavicon url={url} size={14} />
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

  const typeLabel =
    task.type === "otazka"
      ? t("detail.typeOtazka")
      : task.type === "ukol"
      ? t("detail.typeUkol")
      : task.type === "dokumentace"
      ? t("detail.typeDokumentace")
      : t("detail.typeNapad");
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
            onChange={setBody}
            onBlur={flushOnBlur}
            onFocus={handleEditorFocus}
            placeholder={t("detail.bodyPlaceholder")}
            ariaLabel={t("detail.bodyLabel")}
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
              disabled={saving}
              type={task.type}
              isPm={isPm}
            />
            {task.createdBy === user?.uid && (
              <PriorityPickerInline
                value={task.priority}
                onChange={handlePriorityChange}
                disabled={saving}
              />
            )}
            <PhasePickerInline
              value={null}
              onChange={() => {}}
              disabled={saving}
            />
            <LocationPickerInline
              value={task.locationId ?? null}
              onChange={handleLocationChange}
              disabled={saving}
            />
          </div>



          {/* Categories under location/phase */}
          <section className="mt-4" aria-labelledby="cat-heading-act">
            <h2 id="cat-heading-act" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("detail.categoryLabel")}
            </h2>
            <CategoryPicker
              value={task.categoryIds ?? (task.categoryId ? [task.categoryId] : [])}
              categories={categories}
              onChange={handleCategoryChange}
              disabled={saving}
            />
          </section>

          {/* V19 — Deadline + Assignee row */}
          <div className="mt-4 grid grid-cols-2 gap-4">
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
      ) : task.type === "dokumentace" ? (
        <>
          {/* V20 — Dokumentace: sharedWithRoles + location + categories + empty documents */}
          {task.createdBy === user?.uid && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(["PROJECT_MANAGER"] as import("@/types").UserRole[]).map((role) => (
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
          )}

          {/* Categories */}
          <section className="mt-4" aria-labelledby="cat-heading-dok">
            <h2 id="cat-heading-dok" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("detail.categoryLabel")}
            </h2>
            <CategoryPicker
              value={task.categoryIds ?? (task.categoryId ? [task.categoryId] : [])}
              categories={categories}
              onChange={handleCategoryChange}
              disabled={saving}
            />
          </section>

          {/* Documents — upload + cards */}
          <section className="mt-6" aria-labelledby="docs-heading">
            <h2 id="docs-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("dokumentace.sectionTitle")}
            </h2>
            {(task.documents?.length ?? 0) > 0 && (
              <ul className="mb-3 flex flex-col gap-2">
                {task.documents!.map((docItem) => (
                  <li
                    key={docItem.id}
                    className="group flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-bg-subtle"
                  >
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
                    <button
                      type="button"
                      onClick={() => handleReplaceDoc(docItem.id)}
                      disabled={docUploading}
                      aria-label={t("dokumentace.replaceDocument")}
                      className="grid size-8 place-items-center rounded text-ink-subtle opacity-0 group-hover:opacity-100 hover:text-ink transition-opacity"
                    >
                      <Pencil aria-hidden size={14} />
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
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setDocModal({ open: true })}
              disabled={docUploading}
              className="min-h-tap rounded-md border border-dashed border-line bg-transparent px-4 py-2 text-sm text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors inline-flex items-center gap-2"
            >
              <FileText aria-hidden size={18} />
              {docUploading ? t("dokumentace.uploadingDocument") : t("dokumentace.addDocument")}
            </button>
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
          {task.createdBy === user?.uid && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(["PROJECT_MANAGER"] as import("@/types").UserRole[]).map((role) => (
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
          )}

          {/* V19 — Single row: Status, Phase, Location */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPickerInline
              value={task.status}
              onChange={handleStatusChange}
              disabled={saving}
              type={task.type}
              isPm={isPm}
            />
            <PhasePickerInline
              value={null}
              onChange={() => {}}
              disabled={saving}
            />
            <LocationPickerInline
              value={task.locationId ?? null}
              onChange={handleLocationChange}
              disabled={saving}
            />
          </div>

          {/* Categories */}
          <section className="mt-4" aria-labelledby="cat-heading-napad">
            <h2 id="cat-heading-napad" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("detail.categoryLabel")}
            </h2>
            <CategoryPicker
              value={task.categoryIds ?? (task.categoryId ? [task.categoryId] : [])}
              categories={categories}
              onChange={handleCategoryChange}
              disabled={saving}
            />
          </section>
        </>
      )}

      {task.type !== "dokumentace" && (
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
      )}

      {task.type === "napad" && (task.linkedTaskIds?.length ?? 0) > 0 && (() => {
        // V14.1 — split linked children into Otázky / Úkoly lists so the
        // user sees both flows at a glance. An unknown-typed link (orphan)
        // falls into the otázka bucket to stay visible.
        const resolved = (task.linkedTaskIds ?? [])
          .map((lid) => ({ lid, ot: allTasks.find((x) => x.id === lid) }))
          .filter((x) => x.ot);
        const otazkaLinks = resolved.filter(({ ot }) => ot?.type !== "ukol");
        const ukolLinks = resolved.filter(({ ot }) => ot?.type === "ukol");
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
            />
            <LinkedList
              items={ukolLinks}
              headingId="linked-ukoly-heading"
              heading={t("detail.linkedUkolyTitle")}
              fallbackIcon={Target}
              forceIcon={Target}
              isPm={isPm}
              t={t}
            />
          </>
        );
      })()}

      {(task.type === "otazka" || task.type === "ukol") && task.linkedTaskId && (() => {
        const parent = allTasks.find((x) => x.id === task.linkedTaskId);
        const parentTitle =
          parent?.title?.trim() ||
          parent?.body?.split("\n")[0]?.trim().slice(0, 80) ||
          t("detail.noTitle");
        return (
          <Link
            to={taskDetail(task.linkedTaskId)}
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
                return (
                  <li key={docId} className="flex items-center gap-2">
                    <Link
                      to={taskDetail(docId)}
                      className="flex flex-1 items-center gap-3 min-w-0 rounded-md border border-line bg-surface px-3 py-2.5 hover:bg-bg-subtle transition-colors"
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
                    </Link>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleUnlinkDoc(docId)}
                        disabled={saving}
                        aria-label={t("common.delete")}
                        className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-[color:var(--color-status-danger-fg)] disabled:opacity-40"
                      >
                        <XIcon aria-hidden size={16} />
                      </button>
                    )}
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
                documents={allTasks.filter((x) => x.type === "dokumentace")}
                alreadyLinked={task.linkedDocIds ?? []}
                onConfirm={handleLinkDocsConfirm}
                onClose={() => setDocPickerOpen(false)}
              />
            </Suspense>
          )}
        </section>
      )}

      {task.type === "napad" && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
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

      {task.type === "napad" && task.createdBy === user?.uid && (
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
            <span aria-hidden className="shrink-0 text-xs text-ink-subtle">
              {vystupExpanded ? "▾" : "▸"}
            </span>
            <span className="sr-only">
              {vystupExpanded ? t("detail.vystupHide") : t("detail.vystupShow")}
            </span>
          </button>
          {vystupExpanded && (
            <div id="vystup-content" className="mt-2">
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
                  onChange={setVystup}
                  onBlur={flushOnBlur}
                  onFocus={handleEditorFocus}
                  placeholder={t("detail.vystupPlaceholder")}
                  ariaLabel={t("detail.vystupLabel")}
                />
              </Suspense>
            </div>
          )}
        </section>
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
