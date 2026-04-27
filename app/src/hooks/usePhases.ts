import { useEffect, useState } from "react";
import { subscribePhases } from "@/lib/phases";
import type { Phase } from "@/types";

interface State {
  phases: Phase[];
  loading: boolean;
  error: Error | null;
}

export function usePhases(enabled: boolean): State {
  const [state, setState] = useState<State>({
    phases: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ phases: [], loading: false, error: null });
      return;
    }
    const unsub = subscribePhases(
      (phases) => setState({ phases, loading: false, error: null }),
      (error) => setState((s) => ({ ...s, loading: false, error })),
    );
    return unsub;
  }, [enabled]);

  return state;
}
