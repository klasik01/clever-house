import { useEffect, useState } from "react";
import { subscribeBudgetAccounts } from "@/lib/budget/accounts";
import type { BudgetAccount } from "@/types";

type State =
  | { status: "loading"; accounts: [] }
  | { status: "ready"; accounts: BudgetAccount[] }
  | { status: "error"; accounts: []; error: Error };

export function useBudgetAccounts(): State {
  const [state, setState] = useState<State>({ status: "loading", accounts: [] });

  useEffect(() => {
    const unsub = subscribeBudgetAccounts(
      (accounts) => setState({ status: "ready", accounts }),
      (error) => setState({ status: "error", accounts: [], error }),
    );
    return unsub;
  }, []);

  return state;
}
