import { useEffect, useState } from "react";
import { subscribeBudgetSettings } from "@/lib/budget/settings";
import type { BudgetSettings } from "@/types";

type State =
  | { status: "loading"; settings: null }
  | { status: "ready"; settings: BudgetSettings }
  | { status: "error"; settings: null; error: Error };

export function useBudgetSettings(): State {
  const [state, setState] = useState<State>({
    status: "loading",
    settings: null,
  });

  useEffect(() => {
    const unsub = subscribeBudgetSettings(
      (settings) => setState({ status: "ready", settings }),
      (error) => setState({ status: "error", settings: null, error }),
    );
    return unsub;
  }, []);

  return state;
}
