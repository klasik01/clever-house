import { useEffect, useState } from "react";
import { subscribeSectionPayments } from "@/lib/budget/payments";
import type { BudgetPayment } from "@/types";

type State =
  | { status: "loading"; payments: [] }
  | { status: "ready"; payments: BudgetPayment[] }
  | { status: "error"; payments: []; error: Error };

export function useSectionPayments(sectionId: string | undefined): State {
  const [state, setState] = useState<State>({ status: "loading", payments: [] });

  useEffect(() => {
    if (!sectionId) return;
    const unsub = subscribeSectionPayments(
      sectionId,
      (payments) => setState({ status: "ready", payments }),
      (error) => setState({ status: "error", payments: [], error }),
    );
    return unsub;
  }, [sectionId]);

  return state;
}
