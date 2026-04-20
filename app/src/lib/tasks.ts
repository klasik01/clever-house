import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Task } from "@/types";

const TASKS = "tasks";

export function subscribeTasks(
  onChange: (tasks: Task[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(collection(db, TASKS), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(fromQueryDoc)),
    (err) => onError(err)
  );
}

/** Subscribe to one task by ID. onChange(null) signals the task was deleted
 *  or doesn't exist (or user has no read rights). */
export function subscribeTask(
  id: string,
  onChange: (task: Task | null) => void,
  onError: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, TASKS, id),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(fromDocSnap(snap));
    },
    (err) => onError(err)
  );
}

export async function createTask(
  data: {
    type: Task["type"];
    title: string;
    body: string;
    status: Task["status"];
  },
  uid: string
): Promise<string> {
  const ref = await addDoc(collection(db, TASKS), {
    ...data,
    categoryId: null,
    locationId: null,
    linkedTaskId: null,
    projektantAnswer: null,
    attachmentImageUrl: null,
    attachmentImagePath: null,
    attachmentLinkUrl: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "body" | "status" | "categoryId" | "locationId" | "attachmentImageUrl" | "attachmentImagePath" | "attachmentLinkUrl">>
): Promise<void> {
  await updateDoc(doc(db, TASKS, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, TASKS, id));
}

/** One-shot read. Kept for future needs; subscribeTask is preferred for live UI. */
export async function getTask(id: string): Promise<Task | null> {
  const snap = await getDoc(doc(db, TASKS, id));
  return snap.exists() ? fromDocSnap(snap) : null;
}

// ---------- serialization ----------

function fromQueryDoc(d: QueryDocumentSnapshot): Task {
  return fromDocSnap(d);
}

function fromDocSnap(d: DocumentSnapshot): Task {
  const data = d.data() ?? {};
  return {
    id: d.id,
    type: data.type ?? "napad",
    title: data.title ?? "",
    body: data.body ?? "",
    status: data.status ?? "Nápad",
    categoryId: data.categoryId ?? null,
    locationId: data.locationId ?? null,
    linkedTaskId: data.linkedTaskId ?? null,
    projektantAnswer: data.projektantAnswer ?? null,
    attachmentImageUrl: data.attachmentImageUrl ?? null,
    attachmentImagePath: data.attachmentImagePath ?? null,
    attachmentLinkUrl: data.attachmentLinkUrl ?? null,
    createdBy: data.createdBy ?? "",
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}
