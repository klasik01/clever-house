import { useEffect, useMemo, useState } from "react";
import { subscribeRsvps } from "@/lib/rsvp";
import type { Rsvp } from "@/types";

interface RsvpsState {
  rsvps: Rsvp[];
  /** byUid mapa pro O(1) lookup — key = invitee uid, value = response/respondedAt */
  byUid: Map<string, Rsvp>;
  loading: boolean;
  error: Error | null;
}

/**
 * V18-S05 — realtime subscription na RSVP odpovědi pro daný event.
 * Paralelí s useUsers (Map + list).
 */
export function useRsvps(
  eventId: string | undefined | null,
): RsvpsState {
  const [state, setState] = useState<RsvpsState>({
    rsvps: [],
    byUid: new Map(),
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!eventId) {
      setState({ rsvps: [], byUid: new Map(), loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    const unsub = subscribeRsvps(
      eventId,
      (rsvps) =>
        setState({
          rsvps,
          byUid: new Map(rsvps.map((r) => [r.uid, r])),
          loading: false,
          error: null,
        }),
      (error) => setState((prev) => ({ ...prev, loading: false, error })),
    );
    return unsub;
  }, [eventId]);

  return useMemo(() => state, [state]);
}
