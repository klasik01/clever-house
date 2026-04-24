import {
  writeBatch,
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
  uid: string,
  authorRole: import("@/types").UserRole,
): Promise<string> {
  // V17.2 — PM vytvoří úkol/otázku unassigned; OWNER si je self-assignuje.
  const defaultAssignee =
    data.type !== "napad" && authorRole === "OWNER" ? uid : null;
  const ref = await addDoc(collection(db, TASKS), {
    ...data,
    assigneeUid: defaultAssignee,
    categoryId: null,
    locationId: null,
    linkedTaskId: null,
    projektantAnswer: null,
    projektantAnswerAt: null,
    linkedTaskIds: [],
    attachmentImages: [],
    attachmentImageUrl: null,
    attachmentImagePath: null,
    attachmentLinks: [],
    attachmentLinkUrl: null,
    createdBy: uid,
    // V17.1 — snapshot role autora pro cross-OWNER edit rule.
    authorRole,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "body" | "status" | "categoryId" | "categoryIds" | "locationId" | "attachmentImageUrl" | "attachmentImagePath" | "attachmentLinkUrl" | "attachmentImages" | "attachmentLinks" | "linkedTaskIds" | "linkedTaskId" | "priority" | "deadline" | "assigneeUid" | "commentCount" | "sharedWithPm" | "dependencyText" | "vystup">>
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
    linkedTaskIds: bridgeLinkedTaskIds(data),
    projektantAnswer: data.projektantAnswer ?? null,
    projektantAnswerAt: toIsoOrNull(data.projektantAnswerAt),
    attachmentImages: bridgeImages(data),
    attachmentImageUrl: data.attachmentImageUrl ?? null,
    attachmentImagePath: data.attachmentImagePath ?? null,
    attachmentLinks: bridgeLinks(data),
    attachmentLinkUrl: data.attachmentLinkUrl ?? null,
    categoryIds: bridgeCategoryIds(data),
    priority: bridgePriority(data),
    deadline: data.deadline ?? null,
    assigneeUid: data.assigneeUid ?? null,
    commentCount: typeof data.commentCount === "number" ? data.commentCount : 0,
    sharedWithPm: data.sharedWithPm === true,
    dependencyText: typeof data.dependencyText === "string" ? data.dependencyText : null,
    vystup: typeof data.vystup === "string" ? data.vystup : null,
    createdBy: data.createdBy ?? "",
    // V17.1 — legacy tasky neměly authorRole; fallback na "OWNER" (historicky
    //   v drtivé většině, PM teprve nedávno dostal schopnost create).
    authorRole:
      data.authorRole === "PROJECT_MANAGER" || data.authorRole === "OWNER"
        ? data.authorRole
        : "OWNER",
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}


// ---------- S10: PM-specific actions ----------

import type { TaskStatus } from "@/types";

/** PM submits an answer and closes the task (status → Rozhodnuto). */
export async function answerAsProjektant(id: string, answer: string): Promise<void> {
  await updateDoc(doc(db, TASKS, id), {
    projektantAnswer: answer.trim(),
    projektantAnswerAt: serverTimestamp(),
    status: "Rozhodnuto" as TaskStatus,
    updatedAt: serverTimestamp(),
  });
}

/** PM saves an answer but keeps the task open (needs OWNER to clarify). */
export async function needMoreInfoAsProjektant(id: string, answer: string): Promise<void> {
  await updateDoc(doc(db, TASKS, id), {
    projektantAnswer: answer.trim(),
    projektantAnswerAt: serverTimestamp(),
    status: "Čekám" as TaskStatus,
    updatedAt: serverTimestamp(),
  });
}


/**
 * S11: Convert a nápad into an otázka for the Projektant.
 * Creates a new task (type=otazka) pre-filled with the nápad's content and
 * attachments, then links both documents via `linkedTaskId`. Single batch
 * write = atomic; either both docs update or neither does.
 *
 * Attachment handling:
 * - `attachmentImageUrl` and `attachmentLinkUrl` are COPIED (display-only).
 * - `attachmentImagePath` is NOT copied — the original nápad owns deletion.
 *   Cost: if OWNER later deletes the image on the nápad, the otázka shows a
 *   broken thumbnail. Acceptable MVP edge case; documented in S11 deviations.
 */
export async function convertNapadToOtazka(
  source: import("@/types").Task,
  uid: string,
  authorRole: import("@/types").UserRole,
): Promise<string> {
  const newRef = doc(collection(db, TASKS));
  const batch = writeBatch(db);

  // V17.2 — PM vytvoří otázku unassigned; OWNER si ji přiřadí sám.
  const defaultAssignee = authorRole === "OWNER" ? uid : null;

  batch.set(newRef, {
    type: "otazka",
    title: "",
    body: "",
    status: "OPEN",
    assigneeUid: defaultAssignee,
    categoryId: source.categoryId ?? null,
    locationId: source.locationId ?? null,
    linkedTaskId: source.id,
    projektantAnswer: null,
    projektantAnswerAt: null,
    linkedTaskIds: [],
    attachmentImageUrl: source.attachmentImageUrl ?? null,
    attachmentImagePath: null,
    attachmentLinkUrl: source.attachmentLinkUrl ?? null,
    createdBy: uid,
    authorRole,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const existingLinked = source.linkedTaskIds ?? (source.linkedTaskId ? [source.linkedTaskId] : []);
  batch.update(doc(db, TASKS, source.id), {
    linkedTaskIds: [...existingLinked, newRef.id],
    // keep legacy linkedTaskId synced to last added for backward compat reads
    linkedTaskId: newRef.id,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return newRef.id;
}


/**
 * V14: Create a new úkol (type=ukol) linked to an existing nápad. Mirrors
 * convertNapadToOtazka but produces a type=ukol. Copies only display-only
 * attachment refs (image URL + link URL) so the original nápad keeps owning
 * actual storage paths. Úkol starts OPEN with creator assigned — identical
 * to a fresh standalone úkol, just with linkedTaskId pointing at the parent.
 */
export async function convertNapadToUkol(
  source: import("@/types").Task,
  uid: string,
  authorRole: import("@/types").UserRole,
): Promise<string> {
  const newRef = doc(collection(db, TASKS));
  const batch = writeBatch(db);

  const defaultAssignee = authorRole === "OWNER" ? uid : null;

  batch.set(newRef, {
    type: "ukol",
    title: "",
    body: "",
    status: "OPEN",
    assigneeUid: defaultAssignee,
    categoryId: source.categoryId ?? null,
    locationId: source.locationId ?? null,
    linkedTaskId: source.id,
    projektantAnswer: null,
    projektantAnswerAt: null,
    linkedTaskIds: [],
    attachmentImageUrl: source.attachmentImageUrl ?? null,
    attachmentImagePath: null,
    attachmentLinkUrl: source.attachmentLinkUrl ?? null,
    createdBy: uid,
    authorRole,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const existingLinked = source.linkedTaskIds ?? (source.linkedTaskId ? [source.linkedTaskId] : []);
  batch.update(doc(db, TASKS, source.id), {
    linkedTaskIds: [...existingLinked, newRef.id],
    linkedTaskId: newRef.id,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return newRef.id;
}


/** Bridge legacy single-image fields to the S24 array shape. Returns an array. */
function bridgeImages(data: Record<string, unknown>): import("@/types").ImageAttachment[] {
  const arr = (data.attachmentImages as import("@/types").ImageAttachment[] | undefined) ?? [];
  if (Array.isArray(arr) && arr.length > 0) return arr;
  if (typeof data.attachmentImageUrl === "string" && data.attachmentImageUrl) {
    return [
      {
        id: "legacy-0",
        url: data.attachmentImageUrl,
        path: (data.attachmentImagePath as string) ?? "",
      },
    ];
  }
  return [];
}


/** Bridge legacy single link field to the S25 array shape. */
function bridgeLinks(data: Record<string, unknown>): string[] {
  const arr = data.attachmentLinks as string[] | undefined;
  if (Array.isArray(arr) && arr.length > 0) return arr.filter((x) => typeof x === "string");
  if (typeof data.attachmentLinkUrl === "string" && data.attachmentLinkUrl) {
    return [data.attachmentLinkUrl];
  }
  return [];
}


/** Bridge legacy linkedTaskId on a nápad to the S26 array shape. For otázka it's ignored (otázka uses single linkedTaskId). */
/**
 * V3 bridge — categoryIds[].
 * Prefers new `categoryIds` array; falls back to legacy single `categoryId`.
 * Returns [] if neither is present.
 */
function bridgeCategoryIds(data: Record<string, unknown>): string[] {
  const arr = data.categoryIds;
  if (Array.isArray(arr)) {
    return arr.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  const single = data.categoryId;
  if (typeof single === "string" && single.length > 0) {
    return [single];
  }
  return [];
}

/**
 * V3 bridge — priority.
 * Otazky default to "P2" if missing; nápady return undefined.
 */
function bridgePriority(data: Record<string, unknown>): import("@/types").TaskPriority | undefined {
  const p = data.priority;
  if (p === "P1" || p === "P2" || p === "P3") return p;
  // V14 — default P2 applies to otázka + úkol (both actionable).
  if (data.type === "otazka" || data.type === "ukol") return "P2";
  return undefined;
}

function bridgeLinkedTaskIds(data: Record<string, unknown>): string[] {
  const arr = data.linkedTaskIds as string[] | undefined;
  if (Array.isArray(arr) && arr.length > 0) return arr.filter((x) => typeof x === "string");
  // Only nápad's legacy linkedTaskId maps to the array; otázka keeps its own.
  if (data.type === "napad" && typeof data.linkedTaskId === "string" && data.linkedTaskId) {
    return [data.linkedTaskId];
  }
  return [];
}
