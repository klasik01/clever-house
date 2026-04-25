import { useEffect, useState } from "react";
import { subscribeEvent } from "@/lib/events";
import type { Event } from "@/types";

/**
 * V18-S03 — realtime subscription na jeden event. Paralelí s useTask.
 */
type State =
  | { status: "loading"; event: null; error: null }
  | { status: "ready"; event: Event; error: null }
  | { status: "missing"; event: null; error: null }
  | { status: "error"; event: null; error: Error };

export function useEvent(id: string | undefined): State {
  const [state, setState] = useState<State>({
    status: "loading",
    event: null,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ status: "missing", event: null, error: null });
      return;
    }
    setState({ status: "loading", event: null, error: null });
    const unsub = subscribeEvent(
      id,
      (ev) =>
        ev === null
          ? setState({ status: "missing", event: null, error: null })
          : setState({ status: "ready", event: ev, error: null }),
      (error) => setState({ status: "error", event: null, error }),
    );
    return unsub;
  }, [id]);

  return state;
}
