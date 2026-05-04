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
import type { BankDrawdown } from "@/types";

const COLL = "budget_drawdowns";

interface DrawdownInput {
  castka: number;
  datum: string;
  banka?: string;
  note?: string;
}

function fromDocSnap(id: string, data: Record<string, unknown>): BankDrawdown {
  return {
    id,
    castka: typeof data.castka === "number" ? Math.round(data.castka) : 0,
    datum: typeof data.datum === "string" ? data.datum : "",
    banka:
      typeof data.banka === "string" && data.banka.length > 0
        ? data.banka
        : undefined,
    note:
      typeof data.note === "string" && data.note.length > 0
        ? data.note
        : undefined,
    pdfPath:
      typeof data.pdfPath === "string" && data.pdfPath.length > 0
        ? data.pdfPath
        : null,
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

function validate(input: DrawdownInput): void {
  if (!Number.isFinite(input.castka) || input.castka <= 0) {
    throw new Error("Částka musí být kladné číslo.");
  }
  if (!input.datum) {
    throw new Error("Vyplň datum čerpání.");
  }
}

export async function createDrawdown(
  input: DrawdownInput,
  createdBy: string,
): Promise<string> {
  validate(input);
  const ref = await addDoc(collection(db, COLL), {
    castka: Math.round(input.castka),
    datum: input.datum,
    banka: input.banka?.trim() || null,
    note: input.note?.trim() || null,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDrawdown(
  id: string,
  input: DrawdownInput,
): Promise<void> {
  validate(input);
  await updateDoc(doc(db, COLL, id), {
    castka: Math.round(input.castka),
    datum: input.datum,
    banka: input.banka?.trim() || null,
    note: input.note?.trim() || null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDrawdown(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}

export function subscribeBankDrawdowns(
  onChange: (drawdowns: BankDrawdown[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // Seřadíme podle datum desc — nejnovější tranše nahoře.
  const q = query(collection(db, COLL), orderBy("datum", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const drawdowns = snap.docs.map((d) => fromDocSnap(d.id, d.data()));
      onChange(drawdowns);
    },
    (err) => {
      console.error("subscribeBankDrawdowns error", err);
      onError?.(err);
    },
  );
}
