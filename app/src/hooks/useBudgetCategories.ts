import { useEffect, useState } from "react";
import { subscribeBudgetCategories } from "@/lib/budget/categories";
import type { BudgetCategory } from "@/types";

type State =
  | { status: "loading"; categories: [] }
  | { status: "ready"; categories: BudgetCategory[] }
  | { status: "error"; categories: []; error: Error };

export function useBudgetCategories(): State {
  const [state, setState] = useState<State>({ status: "loading", categories: [] });

  useEffect(() => {
    const unsub = subscribeBudgetCategories(
      (categories) => setState({ status: "ready", categories }),
      (error) => setState({ status: "error", categories: [], error }),
    );
    return unsub;
  }, []);

  return state;
}
