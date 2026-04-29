import { useMemo, useState } from "react";
import CommentComposer from "./CommentComposer";
import CommentItem from "./CommentItem";
import Lightbox from "./Lightbox";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useComments } from "@/hooks/useComments";
import { useUsers } from "@/hooks/useUsers";
import { canFlipAssignee } from "@/lib/permissions";
import { resolveAuthorRole } from "@/lib/authorRole";
import { useOnline } from "@/hooks/useOnline";
import { createComment, deleteComment, toggleReaction, updateComment } from "@/lib/comments";
import { isRealFlip, pickDefaultPeer } from "@/lib/commentTargeting";
import { uploadTaskImage, uploadTaskFile, isImageFile } from "@/lib/attachments";
import { newId } from "@/lib/id";
import { useT } from "@/i18n/useT";
import { mapLegacyOtazkaStatus } from "@/lib/status";
import type { ImageAttachment, Task } from "@/types";

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
  // cancelled / blocked úkoly don't offer flip; use StatusSelect to re-open.
  const isActionable = task.type === "otazka" || task.type === "ukol";
  const current = isActionable ? mapLegacyOtazkaStatus(task.status) : task.status;
  const workflowEnabled = isActionable && current === "OPEN" && Boolean(user);

  // V25 — workflow mode dispatch podle aktuálního statusu + permission:
  //   - "full"          — OPEN (vlastník/cross-team) — close+flip+block+cancel
  //   - "blocked"       — BLOCKED — odblokovat (reopen) + complete
  //   - "terminal"      — DONE/CANCELED — znovu otevřít (reopen)
  //   - "completeOnly"  — V24 legacy: CM-as-assignee bez edit, jen Hotovo.
  const roleState = useUserRole(user?.uid);
  const currentUserRole =
    roleState.status === "ready" ? roleState.profile.role : null;
  const taskAuthorRole = resolveAuthorRole({ task, usersByUid: byUid });
  const isAuthor = Boolean(user && user.uid === task.createdBy);
  const isActionableType = task.type === "otazka" || task.type === "ukol";
  const currentCanonical = isActionableType ? mapLegacyOtazkaStatus(task.status) : null;

  const workflowMode: "full" | "completeOnly" | "blocked" | "terminal" | null = (() => {
    if (!isActionableType || !user) return null;
    // V25 — gating:
    //   - canEdit  = autor / cross-OWNER / cross-CM (per canEditTask)
    //   - isAssign = current user je task.assigneeUid
    //   - Anyone participating (autor / assignee / cross-team) má plný workflow.
    //   - Reopen pro terminal je otevřený všem s read access.
    const canEdit = canFlipAssignee({
      task,
      taskAuthorRole,
      currentUserUid: user.uid,
      currentUserRole,
    });
    const isAssign = task.assigneeUid === user.uid;
    const canParticipate = canEdit || isAssign;

    if (currentCanonical === "OPEN") {
      // Plný 6-akční set pro všechny participants (autor / assignee / cross-team).
      if (canParticipate) return "full";
      return null;
    }
    if (currentCanonical === "BLOCKED") {
      // V25 — odblokovat (reopen) i complete pro participants.
      if (canParticipate) return "blocked";
      return null;
    }
    if (currentCanonical === "DONE" || currentCanonical === "CANCELED") {
      // V25 — Reopen kdokoliv s read access. canViewTask gate v parent
      //   TaskDetail garantuje, že sem dorazíme jen pokud read prošel.
      return "terminal";
    }
    return null;
  })();

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

  // V17.3 — logika v lib/commentTargeting.ts (pure, testovaná).
  const defaultPeerUid = useMemo(
    () => pickDefaultPeer({
      task,
      currentUserUid: user?.uid,
      comments,
      peers,
    }),
    [comments, user, task, peers],
  );

  async function handleSubmit(
    input: {
      body: string;
      imageFiles: File[];
      linkUrls: string[];
      mentionedUids: string[];
    },
    action?: "flip" | "close" | "complete" | "block" | "reopen" | "cancel" | null,
    targetUid?: string | null,
  ) {
    if (!user) return;
    // V25 — block requires non-empty body (důvod externí překážky).
    if (action === "block" && !input.body.trim()) {
      console.warn("block action without comment body — ignoring");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Upload images first (sequential, compress via attachments util)
      const uploaded: ImageAttachment[] = [];
      for (const file of input.imageFiles) {
        const uploader = isImageFile(file) ? uploadTaskImage : uploadTaskFile;
        const { url, path } = await uploader({
          file,
          uid: user.uid,
          taskId: task.id,
        });
        uploaded.push({ id: newId(), url, path });
      }

      // 2. V25 — resolve workflow akcí na status/assignee patch.
      //    V17.3 isRealFlip ošetřuje no-op flip (targetUid === current assignee).
      const realFlip = isRealFlip({
        action: action === "flip" ? "flip" : null,
        workflowEnabled,
        targetUid: targetUid ?? null,
        currentAssigneeUid: task.assigneeUid ?? null,
      });

      let workflow: Parameters<typeof createComment>[1]["workflow"] = undefined;
      if (realFlip && targetUid) {
        workflow = { action: "flip", assigneeAfter: targetUid };
      } else if (action === "complete" || action === "close") {
        // V25 — close legacy → complete; oba dělají DONE.
        workflow = { action: "complete", statusAfter: "DONE" };
      } else if (action === "block") {
        workflow = { action: "block", statusAfter: "BLOCKED" };
      } else if (action === "reopen" && targetUid) {
        // Reopen vrací na OPEN + nastavuje nového assigneeho.
        workflow = {
          action: "reopen",
          statusAfter: "OPEN",
          assigneeAfter: targetUid,
        };
      } else if (action === "cancel") {
        workflow = { action: "cancel", statusAfter: "CANCELED" };
      }

      // 3. Create comment doc s uploaded refs + workflow patch + priorAssignee.
      await createComment(task.id, {
        authorUid: user.uid,
        body: input.body,
        attachmentImages: uploaded,
        attachmentLinks: input.linkUrls,
        mentionedUids: input.mentionedUids,
        priorAssigneeUid: task.assigneeUid ?? null,
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
          workflowMode
            ? {
                closeLabel: t("comments.actionComplete"),
                peers,
                defaultPeerUid,
                mode: workflowMode,
                // V25 — Zrušit smí jen autor (a jen pokud je task aktivní;
                //   na DONE/CANCELED Cancel skryjeme — Reopen pokrývá scénář).
                canCancel:
                  isAuthor &&
                  workflowMode !== "terminal" &&
                  currentCanonical !== "CANCELED",
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
