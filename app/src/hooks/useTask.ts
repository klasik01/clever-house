import { useEffect, useState } from "react";
import { subscribeTask } from "@/lib/tasks";
import type { Task } from "@/types";

type State =
  | { status: "loading"; task: null; error: null }
  | { status: "ready"; task: Task; error: null }
  | { status: "missing"; task: null; error: null }
  | { status: "error"; task: null; error: Error };

export function useTask(id: string | undefined): State {
  const [state, setState] = useState<State>({ status: "loading", task: null, error: null });

  useEffect(() => {
    if (!id) {
      setState({ status: "missing", task: null, error: null });
      return;
    }
    setState({ status: "loading", task: null, error: null });
    const unsub = subscribeTask(
      id,
      (task) =>
        task === null
          ? setState({ status: "missing", task: null, error: null })
          : setState({ status: "ready", task, error: null }),
      (error) => setState({ status: "error", task: null, error })
    );
    return unsub;
  }, [id]);

  return state;
}
