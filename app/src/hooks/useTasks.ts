import { useEffect, useState } from "react";
import { subscribeTasks } from "@/lib/tasks";
import type { Task } from "@/types";

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
}

/** Real-time Firestore subscription. Cleans up on unmount. */
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
      (error) => setState((prev) => ({ ...prev, loading: false, error }))
    );
    return unsub;
  }, [enabled]);

  return state;
}
