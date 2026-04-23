import { useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ChevronDown,
  Flag,
  HelpCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Notebook,
  Paperclip,
  Tag,
  Target,
} from "lucide-react";
import type { Category, Task } from "@/types";
import { useT, formatRelative } from "@/i18n/useT";
import StatusBadge from "./StatusBadge";
import AvatarCircle from "./AvatarCircle";
import PriorityBadge from "./PriorityBadge";
import DeadlineChip from "./DeadlineChip";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { getLocation } from "@/lib/locations";
import { isBallOnMe as isBallOnMeV10 } from "@/lib/status";
import { deadlineState } from "@/lib/deadline";

// Shared lazy loader for the Tiptap-based RichTextEditor. One in-flight
// promise regardless of how many cards mount — browsers cache the module
// after the first fetch, so subsequent toggles are synchronous. Preloaded
// on chevron hover / focus so the click feels instant for most users.
type RTEProps = {
  value: string;
  onChange: (markdown: string) => void;
  disabled?: boolean;
  frameless?: boolean;
  ariaLabel?: string;
};
type RTEComponent = ComponentType<RTEProps>;
let rtePromise: Promise<RTEComponent> | null = null;
function loadRichTextEditor(): Promise<RTEComponent> {
  if (!rtePromise) {
    rtePromise = import("./RichTextEditor").then((mod) => mod.default as unknown as RTEComponent);
  }
  return rtePromise;
}

interface Props {
  task: Task;
  categories?: Category[];
}

export default function NapadCard({ task, categories }: Props) {
  const t = useT();
  const { user } = useAuth();
  // V10 — ball-on-me is assignee-driven. Only the current resolver sees the
  //       accent border, regardless of role. Fallback to createdBy for legacy
  //       records without assigneeUid.
  const isBallOnMe = isBallOnMeV10(task, user?.uid);
  // V14 — deadline renders on otázka + úkol. Nápady never carry a deadline.
  const deadlineStateNow = (task.type === "otazka" || task.type === "ukol")
    ? deadlineState(task.deadline)
    : null;
  const isOverdue = deadlineStateNow === "overdue";
  const { byUid } = useUsers(Boolean(user));
  const assignee = task.assigneeUid ? byUid.get(task.assigneeUid) : undefined;
  const created = new Date(task.createdAt);
  const TypeIcon =
    task.type === "otazka"
      ? HelpCircle
      : task.type === "ukol"
      ? Target
      : Notebook;
  const categoryIds = task.categoryIds?.length
    ? task.categoryIds
    : task.categoryId ? [task.categoryId] : [];
  const taskCategories = categoryIds
    .map((id) => categories?.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const MAX_CATEGORY_BADGES = 3;
  const visibleCategories = taskCategories.slice(0, MAX_CATEGORY_BADGES);
  const hiddenCategoryCount = taskCategories.length - visibleCategories.length;
  const location = getLocation(task.locationId);

  // Title prominent; fallback to body first line, then placeholder
  const titleDisplay =
    task.title?.trim() ||
    task.body?.split("\n")[0]?.trim().slice(0, 80) ||
    t("detail.noTitle");

  const hasImage = (task.attachmentImages?.length ?? 0) > 0 || Boolean(task.attachmentImageUrl);
  const hasLink = (task.attachmentLinks?.length ?? 0) > 0 || Boolean(task.attachmentLinkUrl);

  // V14.10 — in-list Výstup peek. Only nápady with a non-empty vystup get
  // the chevron; everyone else keeps the flat card look. State is local to
  // the card instance; not persisted — ephemeral "glance" UX.
  const canExpand = task.type === "napad" && Boolean(task.vystup?.trim());
  const [expanded, setExpanded] = useState(false);
  // V14.15 — lazy-load RichTextEditor on first expand. Button shows a
  // spinner while the chunk downloads so the user knows something's
  // happening and doesn't think the click was dropped. Once loaded, the
  // component stays in state across collapses — subsequent toggles are
  // instant.
  const [EditorComp, setEditorComp] = useState<RTEComponent | null>(null);
  const [loading, setLoading] = useState(false);
  const panelId = `vystup-preview-${task.id}`;

  async function handleToggleVystup(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (EditorComp) {
      setExpanded(true);
      return;
    }
    // First open — fetch the editor chunk, then animate into view.
    setLoading(true);
    try {
      const Comp = await loadRichTextEditor();
      setEditorComp(() => Comp);
      // Wait one frame so the panel mounts at grid-rows-[0fr] first, then
      // transitions to [1fr]. Without this the browser would skip the
      // animation because height changes in the same frame.
      requestAnimationFrame(() => setExpanded(true));
    } catch (err) {
      console.error("failed to load editor for peek", err);
    } finally {
      setLoading(false);
    }
  }

  // Preload the editor chunk on first hint of interaction — pointer enter
  // or keyboard focus. No-op after the first call (promise cached).
  function preloadEditor() {
    if (!EditorComp && !loading) {
      void loadRichTextEditor();
    }
  }

  return (
    // Outer div owns the card chrome (border, shadow, ring) so the expand
    // panel can live outside the <Link> and not steal clicks. Hover / focus
    // rings still work because they bubble up from the Link child.
    <div
      className={`rounded-md bg-surface shadow-sm ring-1 ring-line transition-colors hover:ring-line-strong focus-within:ring-2 focus-within:ring-line-focus ${isOverdue ? "border-l-4" : isBallOnMe ? "border-l-4 border-accent" : ""}`}
      style={isOverdue ? { borderLeftColor: "var(--color-status-danger-fg)" } : undefined}
    >
      <Link
        to={`/t/${task.id}`}
        aria-label={`${
          task.type === "otazka"
            ? t("aria.typeOtazka")
            : task.type === "ukol"
            ? t("aria.typeUkol")
            : t("aria.typeNapad")
        } · ${titleDisplay}`}
        className="block px-4 py-3 focus:outline-none"
      >
        <article>
          <div className="flex items-start gap-3">
            <span className="shrink-0 mt-1">
              <span className="sr-only">
                {task.type === "otazka"
                  ? t("aria.typeOtazka")
                  : task.type === "ukol"
                  ? t("aria.typeUkol")
                  : t("aria.typeNapad")}
              </span>
              <TypeIcon
                aria-hidden
                size={18}
                className={
                  (task.type === "otazka" || task.type === "ukol")
                    ? "text-accent-visual"
                    : "text-ink-subtle"
                }
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium leading-snug text-ink truncate">
                {isOverdue && (
                  <span
                    aria-hidden
                    className="mr-1 inline-flex items-center align-text-bottom"
                    style={{ color: "var(--color-status-danger-fg)" }}
                  >
                    <AlertTriangle size={15} aria-hidden />
                  </span>
                )}
                {titleDisplay}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(task.type === "otazka" || task.type === "ukol") && task.priority && (
                  <PriorityBadge priority={task.priority} />
                )}
                {(task.type === "otazka" || task.type === "ukol") && task.deadline && (
                  <DeadlineChip deadline={task.deadline} />
                )}
                {task.type === "ukol" && task.dependencyText && task.dependencyText.trim() && (
                  <span
                    className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted"
                    title={task.dependencyText}
                  >
                    <Flag aria-hidden size={11} />
                    <span className="truncate max-w-[9rem]">{task.dependencyText}</span>
                  </span>
                )}
                <StatusBadge status={task.status} />
                {visibleCategories.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted"
                  >
                    <Tag aria-hidden size={11} />
                    {c.label}
                  </span>
                ))}
                {hiddenCategoryCount > 0 && (
                  <span
                    className="inline-flex items-center rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted"
                    aria-label={t("categories.hiddenMore", { n: hiddenCategoryCount })}
                    title={t("categories.hiddenMore", { n: hiddenCategoryCount })}
                  >
                    +{hiddenCategoryCount}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                    <MapPin aria-hidden size={11} />
                    {location.label}
                  </span>
                )}
                {/* Binary attachment indicators — presence only, no count */}
                {hasImage && (
                  <span
                    className="inline-flex items-center rounded-pill bg-bg-subtle px-1.5 py-0.5 text-ink-subtle"
                    aria-label={t("aria.hasImage")}
                    title={t("aria.hasImage")}
                  >
                    <ImageIcon aria-hidden size={12} />
                  </span>
                )}
                {hasLink && (
                  <span
                    className="inline-flex items-center rounded-pill bg-bg-subtle px-1.5 py-0.5 text-ink-subtle"
                    aria-label={t("aria.hasLink")}
                    title={t("aria.hasLink")}
                  >
                    <LinkIcon aria-hidden size={12} />
                  </span>
                )}
                <span className="text-xs text-ink-subtle">
                  {formatRelative(t, created)}
                </span>
              </div>
            </div>
            {/* Attachments hint via paperclip when one or both present */}
            {(hasImage || hasLink) && (
              <Paperclip aria-hidden size={14} className="mt-1 shrink-0 text-ink-subtle" />
            )}
            {assignee && (
              <AvatarCircle
                uid={assignee.uid}
                displayName={assignee.displayName}
                email={assignee.email}
                size="sm"
                className="mt-0.5"
              />
            )}
            {canExpand && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-busy={loading}
                disabled={loading}
                aria-label={expanded ? t("card.collapseVystup") : t("card.expandVystup")}
                title={expanded ? t("card.collapseVystup") : t("card.expandVystup")}
                onClick={handleToggleVystup}
                onPointerEnter={preloadEditor}
                onFocus={preloadEditor}
                className="shrink-0 -mr-1 grid size-8 place-items-center rounded-md text-ink-subtle hover:text-ink hover:bg-bg-subtle disabled:cursor-wait transition-colors"
              >
                {loading ? (
                  <Loader2
                    aria-hidden
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <ChevronDown
                    aria-hidden
                    size={18}
                    className={`transition-transform duration-fast ${expanded ? "rotate-180" : ""}`}
                  />
                )}
              </button>
            )}
          </div>
        </article>
      </Link>

      {canExpand && EditorComp && (
        // V14.13/15 — grid-rows animation for smooth reveal. Panel mounts
        // only once the editor chunk has loaded, so there's no loading
        // fallback inside the sliding area. On first open we mount with
        // grid-rows-[0fr] then flip to [1fr] on the next frame so the
        // transition kicks in.
        <div
          id={panelId}
          aria-hidden={!expanded}
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            <div
              className={`border-t border-line px-4 py-3 transition-opacity duration-300 ease-out ${expanded ? "opacity-100" : "opacity-0"}`}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {t("detail.vystupLabel")}
              </p>
              <EditorComp
                value={task.vystup ?? ""}
                onChange={() => {}}
                disabled
                frameless
                ariaLabel={t("detail.vystupLabel")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
