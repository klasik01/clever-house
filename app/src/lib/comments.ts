import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { deleteTaskImage } from "./attachments";
import type { Comment, ImageAttachment, ReactionMap } from "@/types";

const TASKS = "tasks";
const COMMENTS = "comments";

function taskRef(taskId: string) {
  return doc(db, TASKS, taskId);
}
function commentsCol(taskId: string) {
  return collection(db, TASKS, taskId, COMMENTS);
}
function commentRef(taskId: string, commentId: string) {
  return doc(db, TASKS, taskId, COMMENTS, commentId);
}

/**
 * Realtime subscription to all comments on a task, ordered by createdAt DESC
 * — newest first so the freshest activity sits at the top of the thread.
 */
export function subscribeComments(
  taskId: string,
  onChange: (comments: Comment[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(commentsCol(taskId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(fromDocSnap)),
    (err) => onError(err as Error)
  );
}

/**
 * Create a new comment + atomic commentCount++ on the parent task.
 * Uses writeBatch to keep both writes in one Firestore transaction.
 */
export async function createComment(
  taskId: string,
  input: {
    authorUid: string;
    body: string;
    attachmentImages?: ImageAttachment[];
    attachmentLinks?: string[];
    mentionedUids?: string[];
    /** V17.5 — přítomný assigneeUid tasku v okamžiku odesílání komentáře.
     *  Server CF dostane { priorAssigneeUid, assigneeAfter } ve snapshot comment
     *  doc a sám rozhodne, jestli je to flip (prior != after) a koho má
     *  notifikovat jako "assigned_with_comment". */
    priorAssigneeUid?: string | null;
    /** V4/V10/V25 — workflow action to apply to parent task atomically with comment write.
     *
     *   "flip"     — change assigneeUid only. Status stays.
     *   "complete" — set statusAfter to DONE.
     *   "block"    — set statusAfter to BLOCKED. Requires non-empty comment body
     *                (caller-side gate; rules don't enforce body shape).
     *   "reopen"   — set statusAfter to OPEN; flip assigneeUid to reopener's pick.
     *   "cancel"   — set statusAfter to CANCELED.
     *   "close"    — V4 legacy alias pro "complete"; new code uses "complete".
     */
    workflow?: {
      action: "flip" | "complete" | "block" | "reopen" | "cancel" | "close";
      /** Next status for the task. Omit on flip to leave status untouched. */
      statusAfter?: import("@/types").TaskStatus;
      /** Next assigneeUid. Set on flip / reopen to route the ball. */
      assigneeAfter?: string | null;
    };
  }
): Promise<string> {
  const batch = writeBatch(db);
  const ref = doc(commentsCol(taskId));
  const wf = input.workflow ?? null;
  // V17.5 — explicitní "assignee after": pokud je workflow=flip s assigneeAfter,
  //   má přednost; jinak je rovno priorAssigneeUid (komentář nezměnil assignee).
  // V25 — flip a reopen oba mění assignee. Ostatní akce assignee zachovávají.
  const assigneeAfter = wf && (wf.action === "flip" || wf.action === "reopen")
    ? (wf.assigneeAfter ?? null)
    : (input.priorAssigneeUid ?? null);
  batch.set(ref, {
    authorUid: input.authorUid,
    body: input.body,
    createdAt: serverTimestamp(),
    editedAt: null,
    attachmentImages: input.attachmentImages ?? [],
    attachmentLinks: input.attachmentLinks ?? [],
    mentionedUids: input.mentionedUids ?? [],
    reactions: {},
    workflowAction: wf ? wf.action : null,
    statusAfter: wf?.statusAfter ?? null,
    assigneeAfter,
    priorAssigneeUid: input.priorAssigneeUid ?? null,
  });
  const taskPatch: Record<string, unknown> = {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  };
  if (wf) {
    // V25 — status změna podle akce:
    //   flip:     statusAfter omit, assigneeUid se mění
    //   complete: statusAfter = DONE
    //   block:    statusAfter = BLOCKED
    //   reopen:   statusAfter = OPEN, assigneeUid se mění
    //   cancel:   statusAfter = CANCELED
    //   close:    legacy alias pro complete (DONE)
    if (wf.statusAfter !== undefined) {
      taskPatch.status = wf.statusAfter;
    }
    if (
      (wf.action === "flip" || wf.action === "reopen")
      && wf.assigneeAfter !== undefined
    ) {
      taskPatch.assigneeUid = wf.assigneeAfter;
    }
  }
  batch.update(taskRef(taskId), taskPatch);
  await batch.commit();
  return ref.id;
}

/**
 * Update comment body. Only author should call (rules enforce it).
 * Sets editedAt to serverTimestamp.
 */
export async function updateComment(
  taskId: string,
  commentId: string,
  patch: { body: string }
): Promise<void> {
  await updateDoc(commentRef(taskId, commentId), {
    body: patch.body,
    editedAt: serverTimestamp(),
  });
}

/**
 * Delete comment (hard) + cascade delete all its images from Storage.
 * Decrements parent task commentCount atomically.
 * Caller must ensure they are the author (rules enforce it too).
 */
export async function deleteComment(
  taskId: string,
  commentId: string,
  images: ImageAttachment[] | undefined
): Promise<void> {
  // 1. Best-effort cascade: delete Storage objects first so we do not orphan
  //    them if the Firestore delete succeeds but we fail to clean up later.
  if (images && images.length > 0) {
    for (const img of images) {
      if (img.path) {
        try {
          await deleteTaskImage(img.path);
        } catch (e) {
          console.warn("deleteComment: image cleanup failed", e);
        }
      }
    }
  }

  // 2. Firestore delete + commentCount decrement via batch
  const batch = writeBatch(db);
  batch.delete(commentRef(taskId, commentId));
  batch.update(taskRef(taskId), {
    commentCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Pure helper — kompute next ReactionMap state pro toggle akci.
 * Extrahovaný z toggleReaction transaction body, aby šel unit-testovat
 * bez Firestore mocku.
 *
 * Pravidla:
 *   - Pokud user už emoji reactionu má → odebrat (idempotentní toggle)
 *   - Pokud nemá → přidat na konec listu
 *   - Pokud po toggle list emoji je prázdný → smazat klíč úplně
 *     (nezachovávat `[]` aby render nezobrazoval prázdné chips)
 */
export function computeReactionDelta(
  current: ReactionMap | undefined | null,
  emoji: string,
  uid: string,
): ReactionMap {
  const reactions: ReactionMap = { ...(current ?? {}) };
  const list = reactions[emoji] ?? [];
  const has = list.includes(uid);
  const next = has ? list.filter((x) => x !== uid) : [...list, uid];
  if (next.length === 0) {
    delete reactions[emoji];
  } else {
    reactions[emoji] = next;
  }
  return reactions;
}

/**
 * Toggle emoji reaction — idempotent add/remove for current user.
 * Uses a Firestore transaction to avoid racing concurrent reactions.
 */
export async function toggleReaction(
  taskId: string,
  commentId: string,
  emoji: string,
  uid: string
): Promise<void> {
  const ref = commentRef(taskId, commentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as { reactions?: ReactionMap };
    const reactions = computeReactionDelta(data.reactions, emoji, uid);
    tx.update(ref, { reactions });
  });
}

// ---------- serialization ----------

function fromDocSnap(d: DocumentSnapshot | QueryDocumentSnapshot): Comment {
  const data = d.data() ?? {};
  return {
    id: d.id,
    authorUid: data.authorUid ?? "",
    body: data.body ?? "",
    createdAt: toIso(data.createdAt),
    editedAt: toIsoOrNull(data.editedAt),
    attachmentImages: Array.isArray(data.attachmentImages) ? data.attachmentImages : [],
    attachmentLinks: Array.isArray(data.attachmentLinks) ? data.attachmentLinks : [],
    mentionedUids: Array.isArray(data.mentionedUids) ? data.mentionedUids : [],
    reactions: (data.reactions as ReactionMap) ?? {},
    workflowAction: (data.workflowAction as "flip" | "close" | null) ?? null,
    statusAfter: (data.statusAfter as import("@/types").TaskStatus | null) ?? null,
    assigneeAfter: (data.assigneeAfter as string | null) ?? null,
    priorAssigneeUid: (data.priorAssigneeUid as string | null | undefined) ?? null,
  };
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return null;
}
