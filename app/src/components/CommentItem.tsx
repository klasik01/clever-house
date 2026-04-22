import { useState } from "react";
import { Check, CornerDownLeft, ExternalLink, Link as LinkIcon, Pencil, Trash2, X } from "lucide-react";
import AvatarCircle from "./AvatarCircle";
import { statusColors } from "./StatusBadge";
import { mapLegacyOtazkaStatus } from "@/lib/status";
import ReactionBar from "./ReactionBar";
import { useT, formatRelative } from "@/i18n/useT";
import { parseDomain } from "@/lib/links";
import { splitBodyByMentions } from "@/lib/mentions";
import type { Comment, UserProfile } from "@/types";

interface Props {
  comment: Comment;
  author?: UserProfile;             // resolved from useUsers byUid map
  isAuthor: boolean;                 // comment.authorUid === current user uid
  isTaskOwner: boolean;              // comment author == task creator (highlights)
  currentUid?: string;               // for reaction active state
  /** V4 — resolve a uid to a display name (for "Přehozeno na …" badge). */
  resolveName?: (uid: string) => string;
  onEdit?: (body: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onToggleReaction?: (emoji: string) => Promise<void>;
  onOpenImage?: (url: string) => void;
  reactionsDisabled?: boolean;       // e.g. offline
}

/**
 * CommentItem — one row in the thread. Plain markdown body (rendered as pre-wrap text for V3.0).
 *
 * - Author rendering: own comments get bolder accent, others neutral.
 * - Own comment: Edit + Delete visible.
 * - Highlighted bg (olive-50) if author was the task creator — easier to spot.
 */
export default function CommentItem({
  comment,
  author,
  isAuthor,
  isTaskOwner,
  currentUid,
  resolveName,
  onEdit,
  onDelete,
  onToggleReaction,
  onOpenImage,
  reactionsDisabled,
}: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  const displayName = author?.displayName || author?.email?.split("@")[0] || t("avatar.ariaLabel");
  const created = new Date(comment.createdAt);
  const edited = comment.editedAt ? new Date(comment.editedAt) : null;

  async function handleSaveEdit() {
    if (!onEdit) return;
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    try {
      await onEdit(body);
      setEditing(false);
    } catch (e) {
      console.error("edit comment failed", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm(t("comments.confirmDelete"))) return;
    await onDelete();
  }

  const wfStatus = comment.statusAfter ? mapLegacyOtazkaStatus(comment.statusAfter) : null;
  const wfColor = comment.workflowAction && wfStatus ? statusColors(wfStatus) : null;
  // V10 — flip badge resolves the target name from assigneeAfter (new: set on
  // every flip). Legacy V5 records without assigneeAfter fall back to a generic
  // "Přehozeno" label.
  const flipTargetName =
    comment.workflowAction === "flip" && comment.assigneeAfter && resolveName
      ? resolveName(comment.assigneeAfter)
      : null;
  const flipBadgeText =
    comment.workflowAction === "flip"
      ? flipTargetName
        ? t("comments.workflowFlipBadge", { name: flipTargetName })
        : t("comments.workflowFlipBadge", { name: "?" })
      : null;

  return (
    <article
      aria-label={`${displayName} — ${formatRelative(t, created)}`}
      className={`flex gap-2.5 rounded-md p-2.5 ${
        wfColor ? "border border-l-4" : isTaskOwner ? "" : "ring-1 ring-line"
      }`}
      style={
        wfColor
          ? {
              background: "var(--color-comment-other-bg)",
              borderLeftColor: wfColor.border,
              borderTopColor: "var(--color-border-default)",
              borderRightColor: "var(--color-border-default)",
              borderBottomColor: "var(--color-border-default)",
            }
          : isTaskOwner
          ? { background: "var(--color-comment-author-bg)" }
          : { background: "var(--color-comment-other-bg)" }
      }
    >
      <AvatarCircle
        uid={comment.authorUid}
        displayName={author?.displayName}
        email={author?.email}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-2 text-xs">
          <strong className="font-semibold text-ink truncate">{displayName}</strong>
          <span className="text-ink-subtle">{formatRelative(t, created)}</span>
          {edited && (
            <span className="text-ink-subtle">{t("comments.editedLabel")}</span>
          )}
        </header>

        {comment.workflowAction && (
          <span
            className="mt-1.5 inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-medium"
            style={{
              background: wfColor?.bg,
              color: wfColor?.fg,
              borderColor: wfColor?.border,
            }}
          >
            {comment.workflowAction === "flip" ? (
              <>
                <CornerDownLeft aria-hidden size={11} />
                {flipBadgeText}
              </>
            ) : (
              <>
                <Check aria-hidden size={11} />
                {t("comments.workflowCloseBadge")}
              </>
            )}
          </span>
        )}

        {editing ? (
          <div className="mt-2.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.max(2, draft.split("\n").length)}
              className="block w-full resize-y rounded-md border border-line bg-surface px-2 py-1 text-xs leading-relaxed text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving || !draft.trim()}
                className="inline-flex items-center gap-1 h-8 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40"
              >
                <Check aria-hidden size={12} />
                {saving ? t("composer.saving") : t("comments.saveEdit")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(false);
                }}
                className="inline-flex items-center gap-1 h-8 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted hover:text-ink"
              >
                <X aria-hidden size={12} />
                {t("comments.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2.5 pb-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink">
            {splitBodyByMentions(comment.body).map((part, i) =>
              part.kind === "text" ? (
                <span key={i}>{part.text}</span>
              ) : (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium align-baseline"
                  style={{
                    background: "var(--color-comment-mention-bg)",
                    color: "var(--color-comment-mention-fg)",
                  }}
                >
                  @{part.displayName}
                </span>
              )
            )}
          </p>
        )}

        {/* Attachments — images grid */}
        {!editing && (comment.attachmentImages?.length ?? 0) > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2">
            {comment.attachmentImages!.map((img, i) => (
              <li key={img.id ?? i}>
                <button
                  type="button"
                  onClick={() => onOpenImage?.(img.url)}
                  className="block w-full overflow-hidden rounded-md ring-1 ring-line hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-line-focus"
                >
                  <img
                    src={img.url}
                    alt=""
                    width={120}
                    height={120}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Attachments — links list */}
        {!editing && (comment.attachmentLinks?.length ?? 0) > 0 && (
          <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
            {comment.attachmentLinks!.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-ink hover:underline"
                >
                  <LinkIcon aria-hidden size={12} className="text-accent-visual shrink-0" />
                  <span className="truncate">{parseDomain(url) ?? url}</span>
                  <ExternalLink aria-hidden size={10} className="text-ink-subtle shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {!editing && onToggleReaction && (
          <ReactionBar
            reactions={comment.reactions}
            currentUid={currentUid}
            onToggle={onToggleReaction}
            disabled={reactionsDisabled}
          />
        )}

        {/* Actions — only for author */}
        {isAuthor && !editing && (
          <footer className="mt-2 flex items-center gap-1 border-t border-line pt-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t("comments.edit")}
              className="inline-flex items-center gap-1 h-7 rounded-md px-1.5 text-[11px] text-ink-subtle hover:text-ink hover:bg-bg-subtle"
            >
              <Pencil aria-hidden size={12} />
              {t("comments.edit")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label={t("comments.delete")}
              className="inline-flex items-center gap-1 h-7 rounded-md px-1.5 text-[11px] text-ink-subtle hover:text-[color:var(--color-status-danger-fg)] hover:bg-bg-subtle"
            >
              <Trash2 aria-hidden size={12} />
              {t("comments.delete")}
            </button>
          </footer>
        )}
      </div>
    </article>
  );
}
