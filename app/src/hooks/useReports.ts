import { useEffect, useState } from "react";
import { subscribeReports } from "@/lib/reports";
import type { SiteReport } from "@/types";

interface ReportsState {
  reports: SiteReport[];
  loading: boolean;
  error: Error | null;
}

/**
 * V26 — realtime Firestore subscription pro /reports kolekci.
 * Pure subscriber pattern (jako useTasks/useEvents).
 */
export function useReports(enabled: boolean): ReportsState {
  const [state, setState] = useState<ReportsState>({
    reports: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ reports: [], loading: false, error: null });
      return;
    }
    const unsub = subscribeReports(
      (reports) => setState({ reports, loading: false, error: null }),
      (error) => setState((prev) => ({ ...prev, loading: false, error })),
    );
    return unsub;
  }, [enabled]);

  return state;
}
