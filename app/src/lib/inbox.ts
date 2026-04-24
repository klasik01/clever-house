import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit as qLimit,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { NotificationEventKey, NotificationItem } from "@/types";

/**
 * V15.1 — in-app inbox data layer.
 *
 * Lives in users/{uid}/notifications/{id}. Each doc is one push event.
 * Server (Cloud Function) writes, owner reads + marks read. See
 * functions/src/notify/send.ts for the write side.
 */

const MAX_ITEMS = 20;

/** Subscribe to the current user's inbox, newest first, hard-capped at 20.
 *  List UI shows only unread (items are filtered out after they're marked
 *  read), so 20 recent = plenty of runway before a chat-heavy day overflows.
 *  Bumping the limit is cheap — Firestore reads are capped, not expensive. */
export function subscribeInbox(
  uid: string,
  onChange: (items: NotificationItem[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, "users", uid, "notifications"),
    orderBy("createdAt", "desc"),
    qLimit(MAX_ITEMS),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(fromSnap)),
    (err) => onError(err),
  );
}

/** Mark a single notification as read. Idempotent — if readAt is already
 *  set, the Firestore rule ignores the no-op write. */
export async function markRead(uid: string, notifId: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "notifications", notifId), {
    readAt: new Date().toISOString(),
  });
}

/** Mark every unread notification as read. Uses a batch — all-or-nothing,
 *  no partial state. Called by the "Označit vše" button. */
export async function markAllRead(
  uid: string,
  items: NotificationItem[],
): Promise<void> {
  const unread = items.filter((it) => !it.readAt);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  const nowIso = new Date().toISOString();
  for (const it of unread) {
    batch.update(doc(db, "users", uid, "notifications", it.id), { readAt: nowIso });
  }
  await batch.commit();
}

// ---------- Serialization ----------

function fromSnap(d: QueryDocumentSnapshot<DocumentData>): NotificationItem {
  const data = d.data();
  return {
    id: d.id,
    eventType: (data.eventType as NotificationEventKey) ?? "comment_on_thread",
    taskId: typeof data.taskId === "string" ? data.taskId : "",
    commentId: typeof data.commentId === "string" ? data.commentId : null,
    actorUid: typeof data.actorUid === "string" ? data.actorUid : "",
    actorName: typeof data.actorName === "string" ? data.actorName : "",
    title: typeof data.title === "string" ? data.title : "",
    body: typeof data.body === "string" ? data.body : "",
    createdAt: toIso(data.createdAt),
    readAt: data.readAt ? toIso(data.readAt) : null,
  };
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return "";
}
