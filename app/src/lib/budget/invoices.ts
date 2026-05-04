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
  getDocs,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BudgetInvoice, InvoiceStatus } from "@/types";

const SECTION_COLL = "budget_sections";
const INVOICES_SUB = "invoices";

interface InvoiceInput {
  castka: number;
  status: InvoiceStatus;
  datumPlatby?: string | null;
}

function fromDocSnap(
  id: string,
  sectionId: string,
  data: Record<string, unknown>,
): BudgetInvoice {
  return {
    id,
    sectionId,
    castka: typeof data.castka === "number" ? Math.round(data.castka) : 0,
    status: data.status === "PAID" ? "PAID" : "OPEN",
    datumPlatby:
      typeof data.datumPlatby === "string" && data.datumPlatby.length > 0
        ? data.datumPlatby
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

function validateInvoiceInput(input: InvoiceInput): void {
  if (!Number.isFinite(input.castka) || input.castka <= 0) {
    throw new Error("Částka musí být kladné číslo.");
  }
  if (input.status === "PAID" && !input.datumPlatby) {
    throw new Error("U zaplacené faktury vyplň datum platby.");
  }
}

export async function createInvoice(
  sectionId: string,
  input: InvoiceInput,
  createdBy: string,
): Promise<string> {
  validateInvoiceInput(input);
  const ref = await addDoc(
    collection(db, SECTION_COLL, sectionId, INVOICES_SUB),
    {
      castka: Math.round(input.castka),
      status: input.status,
      datumPlatby: input.status === "PAID" ? input.datumPlatby ?? null : null,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );
  return ref.id;
}

export async function updateInvoice(
  sectionId: string,
  id: string,
  input: InvoiceInput,
): Promise<void> {
  validateInvoiceInput(input);
  await updateDoc(doc(db, SECTION_COLL, sectionId, INVOICES_SUB, id), {
    castka: Math.round(input.castka),
    status: input.status,
    datumPlatby: input.status === "PAID" ? input.datumPlatby ?? null : null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoice(
  sectionId: string,
  id: string,
): Promise<void> {
  await deleteDoc(doc(db, SECTION_COLL, sectionId, INVOICES_SUB, id));
}

/** Cascade: smaže všechny faktury pod sekcí (volá se před deleteSection). */
export async function deleteAllInvoicesForSection(
  sectionId: string,
): Promise<void> {
  const snap = await getDocs(
    collection(db, SECTION_COLL, sectionId, INVOICES_SUB),
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export function subscribeSectionInvoices(
  sectionId: string,
  onChange: (invoices: BudgetInvoice[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, SECTION_COLL, sectionId, INVOICES_SUB),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const invoices = snap.docs.map((d) =>
        fromDocSnap(d.id, sectionId, d.data()),
      );
      onChange(invoices);
    },
    (err) => {
      console.error("subscribeSectionInvoices error", err);
      onError?.(err);
    },
  );
}

/**
 * collectionGroup query — všechny faktury napříč všemi sekcemi.
 * Vrací mapu { sectionId → invoices[] }. Vyžaduje rule pro {path=**}/invoices/{iid}.
 */
export function subscribeAllInvoices(
  onChange: (bySection: Record<string, BudgetInvoice[]>) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = collectionGroup(db, INVOICES_SUB);
  return onSnapshot(
    q,
    (snap) => {
      const bySection: Record<string, BudgetInvoice[]> = {};
      snap.docs.forEach((d) => {
        const parts = d.ref.path.split("/");
        const sectionId = parts[1] ?? "";
        const inv = fromDocSnap(d.id, sectionId, d.data());
        if (!bySection[sectionId]) bySection[sectionId] = [];
        bySection[sectionId]!.push(inv);
      });
      Object.keys(bySection).forEach((sid) => {
        bySection[sid]!.sort((a, b) => a.createdAt - b.createdAt);
      });
      onChange(bySection);
    },
    (err) => {
      console.error("subscribeAllInvoices error", err);
      onError?.(err);
    },
  );
}
