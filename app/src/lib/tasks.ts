import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Task } from "@/types";

const TASKS = "tasks";

/**
 * Subscribe to all tasks visible to the signed-in user.
 * In S02 rules: both OWNERs share workspace, so this returns everything
 * created by anyone with OWNER role. PM role (S10) narrows reads server-side.
 */
export function subscribeTasks(
  onChange: (tasks: Task[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(collection(db, TASKS), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(fromDoc);
      onChange(list);
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
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, TASKS, id));
}

function fromDoc(d: QueryDocumentSnapshot): Task {
  const data = d.data();
  return {
    id: d.id,
    type: data.type,
    title: data.title,
    body: data.body,
    status: data.status,
    categoryId: data.categoryId ?? null,
    locationId: data.locationId ?? null,
    linkedTaskId: data.linkedTaskId ?? null,
    projektantAnswer: data.projektantAnswer ?? null,
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
