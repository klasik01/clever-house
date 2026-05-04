import { useEffect, useState } from "react";
import { subscribeAllInvoices } from "@/lib/budget/invoices";
import type { BudgetInvoice } from "@/types";

type State =
  | { status: "loading"; invoicesBySectionId: Record<string, BudgetInvoice[]> }
  | { status: "ready"; invoicesBySectionId: Record<string, BudgetInvoice[]> }
  | { status: "error"; invoicesBySectionId: Record<string, BudgetInvoice[]>; error: Error };

export function useAllInvoices(): State {
  const [state, setState] = useState<State>({
    status: "loading",
    invoicesBySectionId: {},
  });

  useEffect(() => {
    const unsub = subscribeAllInvoices(
      (invoicesBySectionId) =>
        setState({ status: "ready", invoicesBySectionId }),
      (error) =>
        setState({
          status: "error",
          invoicesBySectionId: {},
          error,
        }),
    );
    return unsub;
  }, []);

  return state;
}
