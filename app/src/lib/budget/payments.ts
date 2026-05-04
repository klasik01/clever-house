import {
  collection,
  collectionGroup,
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
import type { BudgetPayment } from "@/types";

const SECTION_COLL = "budget_sections";
const PAYMENTS_SUB = "payments";

interface PaymentInput {
  castka: number;
  datum: string;
  supplier?: string;
  note?: string;
  ucetId?: string | null;
}

function fromDocSnap(
  id: string,
  sectionId: string,
  data: Record<string, unknown>,
): BudgetPayment {
  return {
    id,
    sectionId,
    castka: typeof data.castka === "number" ? Math.round(data.castka) : 0,
    datum: typeof data.datum === "string" ? data.datum : "",
    supplier:
      typeof data.supplier === "string" && data.supplier.length > 0
        ? data.supplier
        : undefined,
    note:
      typeof data.note === "string" && data.note.length > 0 ? data.note : undefined,
    ucetId:
      typeof data.ucetId === "string" && data.ucetId.length > 0 ? data.ucetId : null,
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

function validate(input: PaymentInput): void {
  if (!Number.isFinite(input.castka) || input.castka <= 0) {
    throw new Error("Částka musí být kladné číslo.");
  }
  if (!input.datum) {
    throw new Error("Vyplň datum platby.");
  }
}

export async function createPayment(
  sectionId: string,
  input: PaymentInput,
  createdBy: string,
): Promise<string> {
  validate(input);
  const ref = await addDoc(
    collection(db, SECTION_COLL, sectionId, PAYMENTS_SUB),
    {
      castka: Math.round(input.castka),
      datum: input.datum,
      supplier: input.supplier?.trim() || null,
      note: input.note?.trim() || null,
      ucetId: input.ucetId ?? null,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );
  return ref.id;
}

export async function updatePayment(
  sectionId: string,
  id: string,
  input: PaymentInput,
): Promise<void> {
  validate(input);
  await updateDoc(doc(db, SECTION_COLL, sectionId, PAYMENTS_SUB, id), {
    castka: Math.round(input.castka),
    datum: input.datum,
    supplier: input.supplier?.trim() || null,
    note: input.note?.trim() || null,
    ucetId: input.ucetId ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePayment(
  sectionId: string,
  id: string,
): Promise<void> {
  await deleteDoc(doc(db, SECTION_COLL, sectionId, PAYMENTS_SUB, id));
}

export function subscribeSectionPayments(
  sectionId: string,
  onChange: (payments: BudgetPayment[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, SECTION_COLL, sectionId, PAYMENTS_SUB),
    orderBy("datum", "desc"),
  );
  return onSnapshot(
    q,
    (snap) =>
      onChange(snap.docs.map((d) => fromDocSnap(d.id, sectionId, d.data()))),
    (err) => {
      console.error("subscribeSectionPayments error", err);
      onError?.(err);
    },
  );
}

/** collectionGroup query — všechny payments napříč sekcemi pro Dashboard. */
export function subscribeAllPayments(
  onChange: (bySection: Record<string, BudgetPayment[]>) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = collectionGroup(db, PAYMENTS_SUB);
  return onSnapshot(
    q,
    (snap) => {
      const bySection: Record<string, BudgetPayment[]> = {};
      snap.docs.forEach((d) => {
        const parts = d.ref.path.split("/");
        const sectionId = parts[1] ?? "";
        const p = fromDocSnap(d.id, sectionId, d.data());
        if (!bySection[sectionId]) bySection[sectionId] = [];
        bySection[sectionId]!.push(p);
      });
      Object.keys(bySection).forEach((sid) => {
        bySection[sid]!.sort((a, b) => (a.datum > b.datum ? -1 : 1));
      });
      onChange(bySection);
    },
    (err) => {
      console.error("subscribeAllPayments error", err);
      onError?.(err);
    },
  );
}
