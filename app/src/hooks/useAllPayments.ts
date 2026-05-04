import { useEffect, useState } from "react";
import { subscribeAllPayments } from "@/lib/budget/payments";
import type { BudgetPayment } from "@/types";

type State =
  | { status: "loading"; paymentsBySectionId: Record<string, BudgetPayment[]> }
  | { status: "ready"; paymentsBySectionId: Record<string, BudgetPayment[]> }
  | { status: "error"; paymentsBySectionId: Record<string, BudgetPayment[]>; error: Error };

export function useAllPayments(): State {
  const [state, setState] = useState<State>({
    status: "loading",
    paymentsBySectionId: {},
  });

  useEffect(() => {
    const unsub = subscribeAllPayments(
      (paymentsBySectionId) =>
        setState({ status: "ready", paymentsBySectionId }),
      (error) =>
        setState({ status: "error", paymentsBySectionId: {}, error }),
    );
    return unsub;
  }, []);

  return state;
}
