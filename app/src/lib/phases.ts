import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Phase } from "@/types";

const COL = "phases";

/**
 * Default seed — common construction phases.
 * Seeded on first OWNER visit to the admin page (idempotent).
 */
const DEFAULT_SEED = [
  "Projekt",
  "Základy",
  "Hrubá stavba",
  "Střecha",
  "Okna a dveře",
  "Instalace",
  "Omítky",
  "Podlahy",
  "Dokončení",
  "Zahrada",
];

export function subscribePhases(
  onChange: (phases: Phase[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(collection(db, COL), orderBy("label", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(fromDoc)),
    (err) => onError(err),
  );
}

export async function createPhase(label: string, uid: string): Promise<string> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Empty label");
  const ref = await addDoc(collection(db, COL), {
    label: trimmed,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renamePhase(id: string, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Empty label");
  await updateDoc(doc(db, COL, id), { label: trimmed });
}

export async function deletePhase(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

/** Seed defaults if collection is empty. Idempotent. */
export async function seedPhasesIfEmpty(uid: string): Promise<void> {
  const snap = await getDocs(collection(db, COL));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  for (const label of DEFAULT_SEED) {
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      label,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

function fromDoc(d: QueryDocumentSnapshot): Phase {
  const data = d.data();
  return {
    id: d.id,
    label: data.label ?? "",
    createdBy: data.createdBy ?? "",
    createdAt: toIso(data.createdAt),
  };
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}
