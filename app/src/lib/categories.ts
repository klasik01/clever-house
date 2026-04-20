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
import type { Category } from "@/types";

const CATS = "categories";

const DEFAULT_SEED = [
  "Elektro",
  "Voda",
  "Topení / rekuperace",
  "Zahrada / zavlažování",
  "Stavební úpravy",
  "Kuchyň",
  "Koupelna",
  "Nábytek / interiér",
  "Venkovní stavby",
  "Chytrá domácnost / IT rozvody",
  "Obecné / ostatní",
];

export function subscribeCategories(
  onChange: (cats: Category[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(collection(db, CATS), orderBy("label", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(fromDoc)),
    (err) => onError(err)
  );
}

export async function createCategory(label: string, uid: string): Promise<string> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Empty label");
  const ref = await addDoc(collection(db, CATS), {
    label: trimmed,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameCategory(id: string, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Empty label");
  await updateDoc(doc(db, CATS, id), { label: trimmed });
}

export async function deleteCategory(id: string): Promise<void> {
  // We don't cascade-clear tasks here — tasks keep their categoryId pointer
  // but UI treats "unknown category" as "Bez kategorie". Kept simple for MVP.
  await deleteDoc(doc(db, CATS, id));
}

/** Seed 11 defaults if collection is empty. Idempotent-ish: if anyone has
 *  already added a category, skip. Safe race: dupes only on first-ever concurrent login. */
export async function seedCategoriesIfEmpty(uid: string): Promise<void> {
  const snap = await getDocs(collection(db, CATS));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  for (const label of DEFAULT_SEED) {
    const ref = doc(collection(db, CATS));
    batch.set(ref, {
      label,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

function fromDoc(d: QueryDocumentSnapshot): Category {
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
