import { useEffect, useState } from "react";
import { subscribeSectionQuotes } from "@/lib/budget/quotes";
import type { BudgetQuote } from "@/types";

type State =
  | { status: "loading"; quotes: [] }
  | { status: "ready"; quotes: BudgetQuote[] }
  | { status: "error"; quotes: []; error: Error };

export function useSectionQuotes(sectionId: string | undefined): State {
  const [state, setState] = useState<State>({ status: "loading", quotes: [] });

  useEffect(() => {
    if (!sectionId) return;
    const unsub = subscribeSectionQuotes(
      sectionId,
      (quotes) => setState({ status: "ready", quotes }),
      (error) => setState({ status: "error", quotes: [], error }),
    );
    return unsub;
  }, [sectionId]);

  return state;
}
