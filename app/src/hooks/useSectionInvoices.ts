import { useEffect, useState } from "react";
import { subscribeSectionInvoices } from "@/lib/budget/invoices";
import type { BudgetInvoice } from "@/types";

type State =
  | { status: "loading"; invoices: [] }
  | { status: "ready"; invoices: BudgetInvoice[] }
  | { status: "error"; invoices: []; error: Error };

export function useSectionInvoices(sectionId: string | undefined): State {
  const [state, setState] = useState<State>({ status: "loading", invoices: [] });

  useEffect(() => {
    if (!sectionId) return;
    const unsub = subscribeSectionInvoices(
      sectionId,
      (invoices) => setState({ status: "ready", invoices }),
      (error) => setState({ status: "error", invoices: [], error }),
    );
    return unsub;
  }, [sectionId]);

  return state;
}
