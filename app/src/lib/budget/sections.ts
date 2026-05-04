import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BudgetSection } from "@/types";

const COLL = "budget_sections";

interface SectionInput {
  title: string;
  description?: string;
}

function fromDocSnap(id: string, data: Record<string, unknown>): BudgetSection {
  return {
    id,
    title: typeof data.title === "string" ? data.title : "",
    description:
      typeof data.description === "string" && data.description.length > 0
        ? data.description
        : undefined,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

function toMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  if (typeof value === "number") return value;
  return 0;
}

export async function createSection(
  input: SectionInput,
  createdBy: string,
): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("Sekce musí mít název.");
  if (title.length > 80) throw new Error("Název sekce může mít max 80 znaků.");

  const ref = await addDoc(collection(db, COLL), {
    title,
    description: input.description?.trim() || null,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSection(
  id: string,
  input: SectionInput,
): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error("Sekce musí mít název.");
  if (title.length > 80) throw new Error("Název sekce může mít max 80 znaků.");

  await updateDoc(doc(db, COLL, id), {
    title,
    description: input.description?.trim() || null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSection(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}

export function subscribeSections(
  onChange: (sections: BudgetSection[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLL), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const sections = snap.docs.map((d) => fromDocSnap(d.id, d.data()));
      onChange(sections);
    },
    (err) => {
      console.error("subscribeSections error", err);
      onError?.(err);
    },
  );
}

export function subscribeSection(
  id: string,
  onChange: (section: BudgetSection | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLL, id),
    (snap) => {
      onChange(snap.exists() ? fromDocSnap(snap.id, snap.data()) : null);
    },
    (err) => {
      console.error("subscribeSection error", err);
      onError?.(err);
    },
  );
}
