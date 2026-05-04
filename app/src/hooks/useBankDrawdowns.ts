import { useEffect, useState } from "react";
import { subscribeBankDrawdowns } from "@/lib/budget/drawdowns";
import type { BankDrawdown } from "@/types";

type State =
  | { status: "loading"; drawdowns: [] }
  | { status: "ready"; drawdowns: BankDrawdown[] }
  | { status: "error"; drawdowns: []; error: Error };

export function useBankDrawdowns(): State {
  const [state, setState] = useState<State>({
    status: "loading",
    drawdowns: [],
  });

  useEffect(() => {
    const unsub = subscribeBankDrawdowns(
      (drawdowns) => setState({ status: "ready", drawdowns }),
      (error) => setState({ status: "error", drawdowns: [], error }),
    );
    return unsub;
  }, []);

  return state;
}
