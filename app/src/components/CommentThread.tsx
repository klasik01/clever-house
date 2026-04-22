import { useMemo, useState } from "react";
import CommentComposer from "./CommentComposer";
import CommentItem from "./CommentItem";
import Lightbox from "./Lightbox";
import { useAuth } from "@/hooks/useAuth";
import { useComments } from "@/hooks/useComments";
import { useUsers } from "@/hooks/useUsers";
import { useOnline } from "@/hooks/useOnline";
import { createComment, deleteComment, toggleReaction, updateComment } from "@/lib/comments";
import { uploadTaskImage } from "@/lib/attachments";
import { newId } from "@/lib/id";
import { useT } from "@/i18n/useT";
import { mapLegacyOtazkaStatus } from "@/lib/status";
import type { ImageAttachment, Task, TaskStatus } from "@/types";

interface Props {
  task: Task;
}

/**
 * CommentThread — "Diskuse (N)" section under a task.
 * Owns the composer state + image upload pipeline. V10: workflow is
 * assignee-driven. Flipping changes `task.assigneeUid` to whomever the user
 * picks in the composer dropdown; status stays OPEN.
 */
export default function CommentThread({ task }: Props) {
  const t = useT();
  const { user } = useAuth();
  const { comments, loading, error } = useComments(task.id);
  const { users, byUid } = useUsers(Boolean(user));
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const online = useOnline();
  const offline = !online;

  const resolveName = (uid: string) => {
    const u = byUid.get(uid);
    return u?.displayName || u?.email?.split("@")[0] || uid.slice(0, 6);
  };

  // V10 + V14 — workflow active on otázka OR úkol while OPEN. Closed /
  // cancelled / blocked úkoly don’t offer flip; use StatusSelect to re-open.
  const isActionable = task.type === "otazka" || task.type === "ukol";
  const current = isActionable ? mapLegacyOtazkaStatus(task.status) : task.status;
  const workflowEnabled = isActionable && current === "OPEN" && Boolean(user);

  // Peers = every other workspace user. Sorted alphabetically for predictable
  // dropdown ordering.
  const peers = useMemo(() => {
    return users
      .filter((u) => u.uid !== user?.uid)
      .map((u) => ({
        uid: u.uid,
        displayName: u.displayName || u.email?.split("@")[0] || u.uid.slice(0, 6),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "cs"));
  }, [users, user?.uid]);

  // Default target = předchozí předkladatel (person who most recently flipped
  // the ball to me). Fallback to task.createdBy when that isn’t me.
  const defaultPeerUid = useMemo(() => {
    if (!user) return null;
    // comments are returned newest-first by subscribeComments.
    const prior = comments.find(
      (c) =>
        c.workflowAction === "flip" &&
        c.assigneeAfter === user.uid &&
        c.authorUid !== user.uid,
    );
    if (prior) return prior.authorUid;
    if (task.createdBy !== user.uid) return task.createdBy;
    return peers[0]?.uid ?? null;
  }, [comments, user, task.createdBy, peers]);

  async function handleSubmit(
    input: {
      body: string;
      imageFiles: File[];
      linkUrls: string[];
      mentionedUids: string[];
    },
    action?: "flip" | "close" | null,
    targetUid?: string | null,
  ) {
    if (!user) return;
    setSubmitting(true);
    try {
      // 1. Upload images first (sequential, compress via attachments util)
      const uploaded: ImageAttachment[] = [];
      for (const file of input.imageFiles) {
        const { url, path } = await uploadTaskImage({
          file,
          uid: user.uid,
          taskId: task.id,
        });
        uploaded.push({ id: newId(), url, path });
      }

      // 2. Resolve workflow side-effect. Flip changes assignee only (status
      //    stays OPEN). Close moves to DONE.
      const workflow =
        action === "flip" && workflowEnabled && targetUid
          ? { action: "flip" as const, assigneeAfter: targetUid }
          : action === "close"
          ? { action: "close" as const, statusAfter: "DONE" as TaskStatus }
          : undefined;

      // 3. Create comment doc with uploaded refs + workflow patch
      await createComment(task.id, {
        authorUid: user.uid,
        body: input.body,
        attachmentImages: uploaded,
        attachmentLinks: input.linkUrls,
        mentionedUids: input.mentionedUids,
        workflow,
      });
    } catch (e) {
      console.error("create comment failed", e);
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(commentId: string, body: string) {
    await updateComment(task.id, commentId, { body });
  }

  async function handleDelete(commentId: string, images?: ImageAttachment[]) {
    await deleteComment(task.id, commentId, images);
  }

  async function handleToggleReaction(commentId: string, emoji: string) {
    if (!user) return;
    await toggleReaction(task.id, commentId, emoji, user.uid);
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-6">
      <h2 id="comments-heading" className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {t("comments.count", { n: comments.length })}
      </h2>

      <CommentComposer
        submitting={submitting}
        offline={offline}
        onSubmit={handleSubmit}
        workflow={
          workflowEnabled
            ? {
                closeLabel: t("comments.sendAndClose"),
                peers,
                defaultPeerUid,
              }
            : undefined
        }
      />

      {loading && (
        <ul className="mt-3 flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-20 rounded-md bg-surface ring-1 ring-line animate-pulse" />
          ))}
        </ul>
      )}

      {!loading && error && (
        <p role="alert" className="mt-3 text-sm text-[color:var(--color-status-danger-fg)]">
          {t("list.loadFailed")}
        </p>
      )}

      {!loading && !error && comments.length === 0 && (
        <p className="mt-3 text-center text-sm text-ink-subtle">{t("comments.empty")}</p>
      )}

      {!loading && !error && comments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id}>
              <CommentItem
                comment={c}
                author={byUid.get(c.authorUid)}
                isAuthor={Boolean(user && user.uid === c.authorUid)}
                isTaskOwner={c.authorUid === task.createdBy}
                currentUid={user?.uid}
                onEdit={user && user.uid === c.authorUid ? (body) => handleEdit(c.id, body) : undefined}
                onDelete={
                  user && user.uid === c.authorUid
                    ? () => handleDelete(c.id, c.attachmentImages)
                    : undefined
                }
                onToggleReaction={user ? (emoji) => handleToggleReaction(c.id, emoji) : undefined}
                resolveName={resolveName}
                onOpenImage={setLightbox}
                reactionsDisabled={offline}
              />
            </li>
          ))}
        </ul>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}
