import { useEffect, useState } from "react";
import { subscribeTasks } from "@/lib/tasks";
import type { Task } from "@/types";

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
}

/**
 * Real-time Firestore subscription. Cleans up on unmount.
 *
 * V24 — všechny role používají stejnou collection-level subscription
 *   (subscribeTasks). Server rules zůstávají permissive (V15.2 isSignedIn —
 *   viz S20 SAFE FALLBACK v firestore.rules), CM scope se enforcuje:
 *     1. KLIENTSKY přes canViewTask v useVisibleTasks (filtruje napady,
 *        nesdílenou dokumentaci, ne-CM-team úkoly)
 *     2. PUSH/INBOX přes canReadTaskForRecipient v functions/notify/canRead
 *
 *   Server-side per-doc gate (canReadTaskByCm + 4-query rules-aligned subscribe)
 *   je odložený do hardening sprintu — viz `.design/stavbyvedouci-role/DESIGN_REVIEW.md`.
 *   Důvod: composite indexes pro CM-specific queries vyžadují deploy +
 *   build time, a SAFE FALLBACK rules by je odmítly stejně. Konzistentní
 *   pattern je rely on broad rules + client filter (jako PM dnes).
 */
export function useTasks(enabled: boolean): TasksState {
  const [state, setState] = useState<TasksState>({
    tasks: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ tasks: [], loading: false, error: null });
      return;
    }
    const unsub = subscribeTasks(
      (tasks) => setState({ tasks, loading: false, error: null }),
      (error) => setState((prev) => ({ ...prev, loading: false, error })),
    );
    return unsub;
  }, [enabled]);

  return state;
}
