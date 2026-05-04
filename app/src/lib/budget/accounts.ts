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
  writeBatch,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BudgetAccount, BudgetAccountKind } from "@/types";

const COLL = "budget_accounts";

interface AccountInput {
  label: string;
  kind: BudgetAccountKind;
}

function fromDocSnap(id: string, data: Record<string, unknown>): BudgetAccount {
  const kindRaw = data.kind;
  const kind: BudgetAccountKind =
    kindRaw === "BEZNY" || kindRaw === "HYPOTECNI" || kindRaw === "HOTOVOST"
      ? kindRaw
      : "CUSTOM";
  return {
    id,
    label: typeof data.label === "string" ? data.label : "",
    kind,
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

function validate(input: AccountInput): void {
  const label = input.label?.trim();
  if (!label) throw new Error("Účet musí mít název.");
  if (label.length > 80) throw new Error("Název účtu max 80 znaků.");
}

export async function createAccount(
  input: AccountInput,
  createdBy: string,
): Promise<string> {
  validate(input);
  const ref = await addDoc(collection(db, COLL), {
    label: input.label.trim(),
    kind: input.kind,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAccount(
  id: string,
  input: AccountInput,
): Promise<void> {
  validate(input);
  await updateDoc(doc(db, COLL, id), {
    label: input.label.trim(),
    kind: input.kind,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}

export function subscribeBudgetAccounts(
  onChange: (accounts: BudgetAccount[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLL), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => fromDocSnap(d.id, d.data()))),
    (err) => {
      console.error("subscribeBudgetAccounts error", err);
      onError?.(err);
    },
  );
}

/**
 * Při prvním otevření Rozpočtu (žádný účet) vytvoří 3 default:
 * Běžný účet, Hypoteční účet, Hotovost.
 * Idempotent: pokud už nějaké účty existují, nedělá nic.
 */
export async function ensureDefaultAccounts(createdBy: string): Promise<boolean> {
  const snap = await getDocs(collection(db, COLL));
  if (!snap.empty) return false;
  const batch = writeBatch(db);
  const defaults: AccountInput[] = [
    { label: "Běžný účet", kind: "BEZNY" },
    { label: "Hypoteční účet", kind: "HYPOTECNI" },
    { label: "Hotovost", kind: "HOTOVOST" },
  ];
  defaults.forEach((input) => {
    const ref = doc(collection(db, COLL));
    batch.set(ref, {
      label: input.label,
      kind: input.kind,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return true;
}
