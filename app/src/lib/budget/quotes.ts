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
import type { BudgetQuote } from "@/types";

const SECTION_COLL = "budget_sections";
const QUOTES_SUB = "quotes";

interface QuoteInput {
  castka: number;
  supplier?: string;
  note?: string;
}

function fromDocSnap(
  id: string,
  sectionId: string,
  data: Record<string, unknown>,
): BudgetQuote {
  return {
    id,
    sectionId,
    castka: typeof data.castka === "number" ? Math.round(data.castka) : 0,
    supplier:
      typeof data.supplier === "string" && data.supplier.length > 0
        ? data.supplier
        : undefined,
    note:
      typeof data.note === "string" && data.note.length > 0 ? data.note : undefined,
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

function validate(input: QuoteInput): void {
  if (!Number.isFinite(input.castka) || input.castka <= 0) {
    throw new Error("Částka musí být kladné číslo.");
  }
}

export async function createQuote(
  sectionId: string,
  input: QuoteInput,
  createdBy: string,
): Promise<string> {
  validate(input);
  const ref = await addDoc(collection(db, SECTION_COLL, sectionId, QUOTES_SUB), {
    castka: Math.round(input.castka),
    supplier: input.supplier?.trim() || null,
    note: input.note?.trim() || null,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuote(
  sectionId: string,
  id: string,
  input: QuoteInput,
): Promise<void> {
  validate(input);
  await updateDoc(doc(db, SECTION_COLL, sectionId, QUOTES_SUB, id), {
    castka: Math.round(input.castka),
    supplier: input.supplier?.trim() || null,
    note: input.note?.trim() || null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteQuote(
  sectionId: string,
  id: string,
): Promise<void> {
  await deleteDoc(doc(db, SECTION_COLL, sectionId, QUOTES_SUB, id));
}

export function subscribeSectionQuotes(
  sectionId: string,
  onChange: (quotes: BudgetQuote[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, SECTION_COLL, sectionId, QUOTES_SUB),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => fromDocSnap(d.id, sectionId, d.data()))),
    (err) => {
      console.error("subscribeSectionQuotes error", err);
      onError?.(err);
    },
  );
}
