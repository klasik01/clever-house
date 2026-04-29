import { useEffect, useState } from "react";
import { subscribeTasks, subscribeTasksForCm } from "@/lib/tasks";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import type { Task } from "@/types";

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
}

/**
 * Real-time Firestore subscription. Cleans up on unmount.
 *
 * V24 — pro CONSTRUCTION_MANAGER používá `subscribeTasksForCm` s 4
 *   rules-aligned queries (assignee/creator/cross-CM team/shared docs).
 *   OWNER + PM mají plný read přes `subscribeTasks` jako dříve.
 *   Dokud role neznáme (loading), zůstaneme v loading state — bez role
 *   nelze rozhodnout jakou subscription použít, plus useUserRole je rychlý.
 */
export function useTasks(enabled: boolean): TasksState {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const [state, setState] = useState<TasksState>({
    tasks: [],
    loading: true,
    error: null,
  });

  const role = roleState.status === "ready" ? roleState.profile.role : null;
  const uid = user?.uid;

  useEffect(() => {
    if (!enabled) {
      setState({ tasks: [], loading: false, error: null });
      return;
    }
    // Bez resolved role nemůžeme spustit správnou subscription. Zachováváme
    //   loading; useUserRole obvykle dořeší během prvního renderu.
    if (!role || !uid) {
      setState((prev) => ({ ...prev, loading: true }));
      return;
    }

    const unsub =
      role === "CONSTRUCTION_MANAGER"
        ? subscribeTasksForCm(
            uid,
            (tasks) => setState({ tasks, loading: false, error: null }),
            (error) => setState((prev) => ({ ...prev, loading: false, error })),
          )
        : subscribeTasks(
            (tasks) => setState({ tasks, loading: false, error: null }),
            (error) => setState((prev) => ({ ...prev, loading: false, error })),
          );
    return unsub;
  }, [enabled, role, uid]);

  return state;
}
