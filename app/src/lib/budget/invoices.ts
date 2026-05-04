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
import type { BudgetInvoice, InvoiceStatus, PaymentMethod } from "@/types";
import { deleteInvoicePdf } from "./storage";

const SECTION_COLL = "budget_sections";
const INVOICES_SUB = "invoices";

interface InvoiceInput {
  castka: number;
  status: InvoiceStatus;
  datumPlatby?: string | null;
  splatnost?: string | null;
  paymentMethod?: PaymentMethod | null;
  nazev?: string;
  supplier?: string;
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
    splatnost:
      typeof data.splatnost === "string" && data.splatnost.length > 0
        ? data.splatnost
        : undefined,
    pdfPath:
      typeof data.pdfPath === "string" && data.pdfPath.length > 0
        ? data.pdfPath
        : null,
    paymentMethod:
      data.paymentMethod === "ONLINE" || data.paymentMethod === "HOTOVOST"
        ? data.paymentMethod
        : null,
    nazev:
      typeof data.nazev === "string" && data.nazev.length > 0
        ? data.nazev
        : undefined,
    supplier:
      typeof data.supplier === "string" && data.supplier.length > 0
        ? data.supplier
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
  // Lib-level validation: jen castka (povinná) + datum/splatnost podle statusu.
  // Pole nazev a paymentMethod jsou OPTIONAL na lib úrovni — modal je
  // doporučuje vyplnit přes UI, ale legacy faktury bez těchto polí lze
  // uložit (nepadá save existujících záznamů, které byly vytvořené před
  // R2/R3 introdukující tyto sloupce).
  if (!Number.isFinite(input.castka) || input.castka <= 0) {
    throw new Error("Částka musí být kladné číslo.");
  }
  if (input.status === "PAID" && !input.datumPlatby) {
    throw new Error("U zaplacené faktury vyplň datum platby.");
  }
  if (input.status === "OPEN" && !input.splatnost) {
    throw new Error("U otevřené faktury vyplň splatnost.");
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
      splatnost: input.splatnost ?? null,
      paymentMethod: input.paymentMethod ?? null,
      nazev: input.nazev?.trim() || null,
      supplier: input.supplier?.trim() || null,
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
    splatnost: input.splatnost ?? null,
    paymentMethod: input.paymentMethod ?? null,
    nazev: input.nazev?.trim() || null,
    supplier: input.supplier?.trim() || null,
    updatedAt: serverTimestamp(),
  });
}

export async function setInvoicePdfPath(
  sectionId: string,
  id: string,
  pdfPath: string | null,
): Promise<void> {
  await updateDoc(doc(db, SECTION_COLL, sectionId, INVOICES_SUB, id), {
    pdfPath: pdfPath ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoice(
  sectionId: string,
  id: string,
  options?: { pdfPath?: string | null },
): Promise<void> {
  // S07 — cascade delete PDF z Storage. Idempotentní (deleteInvoicePdf
  // toleruje "object-not-found"). Děláme to PŘED delete dokumentu, aby
  // při retry-after-fail bylo všechno stále v Firestore.
  if (options?.pdfPath) {
    try {
      await deleteInvoicePdf(options.pdfPath);
    } catch (err) {
      console.warn("deleteInvoice: PDF cleanup failed (continuing)", err);
    }
  }
  await deleteDoc(doc(db, SECTION_COLL, sectionId, INVOICES_SUB, id));
}

/** Cascade: smaže všechny faktury pod sekcí (volá se před deleteSection).
 *  Včetně PDF příloh ve Storage (best-effort, errors logované).
 */
export async function deleteAllInvoicesForSection(
  sectionId: string,
): Promise<void> {
  const snap = await getDocs(
    collection(db, SECTION_COLL, sectionId, INVOICES_SUB),
  );
  if (snap.empty) return;

  // Sebrat PDF cesty PŘEDTÍM, než smažeme docs.
  const pdfPaths: string[] = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    if (typeof data.pdfPath === "string" && data.pdfPath.length > 0) {
      pdfPaths.push(data.pdfPath);
    }
  });

  // Smaž PDFs (best-effort).
  await Promise.all(
    pdfPaths.map(async (path) => {
      try {
        await deleteInvoicePdf(path);
      } catch (err) {
        console.warn("deleteAllInvoicesForSection: PDF cleanup failed", path, err);
      }
    }),
  );

  // Smaž faktura docs.
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
