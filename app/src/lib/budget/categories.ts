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
import type { BudgetCategory } from "@/types";

const COLL = "budget_categories";

interface CategoryInput {
  label: string;
}

function fromDocSnap(id: string, data: Record<string, unknown>): BudgetCategory {
  return {
    id,
    label: typeof data.label === "string" ? data.label : "",
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

function validate(input: CategoryInput): void {
  const label = input.label?.trim();
  if (!label) throw new Error("Kategorie musí mít název.");
  if (label.length > 60) throw new Error("Název kategorie max 60 znaků.");
}

export async function createBudgetCategory(
  input: CategoryInput,
  createdBy: string,
): Promise<string> {
  validate(input);
  const ref = await addDoc(collection(db, COLL), {
    label: input.label.trim(),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBudgetCategory(
  id: string,
  input: CategoryInput,
): Promise<void> {
  validate(input);
  await updateDoc(doc(db, COLL, id), {
    label: input.label.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBudgetCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}

export function subscribeBudgetCategories(
  onChange: (categories: BudgetCategory[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLL), orderBy("label", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => fromDocSnap(d.id, d.data()))),
    (err) => {
      console.error("subscribeBudgetCategories error", err);
      onError?.(err);
    },
  );
}
