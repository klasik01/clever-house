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
    /** V4/V10 — workflow action to apply to parent task atomically with comment write.
     *  V10: statusAfter is OPTIONAL on flip (assignee changes, status stays OPEN).
     *  Close always carries statusAfter: "DONE". */
    workflow?: {
      action: "flip" | "close";
      /** Next status for the task. Omit on flip to leave status untouched. */
      statusAfter?: import("@/types").TaskStatus;
      /** Next assigneeUid. Set on flip to route the ball; leave undefined to preserve. */
      assigneeAfter?: string | null;
    };
  }
): Promise<string> {
  const batch = writeBatch(db);
  const ref = doc(commentsCol(taskId));
  const wf = input.workflow ?? null;
  // V17.5 — explicitní "assignee after": pokud je workflow=flip s assigneeAfter,
  //   má přednost; jinak je rovno priorAssigneeUid (komentář nezměnil assignee).
  const assigneeAfter = wf && wf.action === "flip"
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
    // Status only changes if the caller explicitly asks. V10 flip keeps the
    // úkol at OPEN and only moves assigneeUid; close sets DONE.
    if (wf.statusAfter !== undefined) {
      taskPatch.status = wf.statusAfter;
    }
    if (wf.action === "flip" && wf.assigneeAfter !== undefined) {
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
    const reactions: ReactionMap = { ...(data.reactions ?? {}) };
    const list = reactions[emoji] ?? [];
    const has = list.includes(uid);
    const next = has ? list.filter((x) => x !== uid) : [...list, uid];
    if (next.length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = next;
    }
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
