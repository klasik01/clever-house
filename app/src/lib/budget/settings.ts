import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BudgetSettings } from "@/types";

const COLL = "budget_settings";
const DOC_ID = "main";

interface MortgageInput {
  mortgageApprovedAmountCzk: number;
  mortgageBank?: string;
  mortgageApprovedAt?: string;
}

function fromDocSnap(data: Record<string, unknown> | undefined): BudgetSettings {
  if (!data) {
    return { updatedAt: 0 };
  }
  return {
    mortgageApprovedAmountCzk:
      typeof data.mortgageApprovedAmountCzk === "number"
        ? Math.round(data.mortgageApprovedAmountCzk)
        : null,
    mortgageBank:
      typeof data.mortgageBank === "string" && data.mortgageBank.length > 0
        ? data.mortgageBank
        : null,
    mortgageApprovedAt:
      typeof data.mortgageApprovedAt === "string" && data.mortgageApprovedAt.length > 0
        ? data.mortgageApprovedAt
        : null,
    updatedAt: toMillis(data.updatedAt),
    updatedBy:
      typeof data.updatedBy === "string" ? data.updatedBy : undefined,
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

/**
 * Aktualizuje hypoteční nastavení. Singleton doc `main`. setDoc s merge,
 * takže ostatní pole (např. budoucí currentAccountBalanceCzk) se nepřepíšou.
 */
export async function updateMortgageSettings(
  input: MortgageInput,
  updatedBy: string,
): Promise<void> {
  if (!Number.isFinite(input.mortgageApprovedAmountCzk) || input.mortgageApprovedAmountCzk < 0) {
    throw new Error("Schválená částka musí být nezáporné číslo.");
  }
  await setDoc(
    doc(db, COLL, DOC_ID),
    {
      mortgageApprovedAmountCzk: Math.round(input.mortgageApprovedAmountCzk),
      mortgageBank: input.mortgageBank?.trim() || null,
      mortgageApprovedAt: input.mortgageApprovedAt?.trim() || null,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
}

export function subscribeBudgetSettings(
  onChange: (settings: BudgetSettings) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLL, DOC_ID),
    (snap) => {
      onChange(fromDocSnap(snap.exists() ? snap.data() : undefined));
    },
    (err) => {
      console.error("subscribeBudgetSettings error", err);
      onError?.(err);
    },
  );
}
