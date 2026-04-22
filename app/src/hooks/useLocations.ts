import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCATIONS,
  _setLocationsRuntimeCache,
  subscribeLocations,
} from "@/lib/locations";
import type { Location } from "@/types";

interface State {
  locations: Location[];
  loading: boolean;
  error: Error | null;
}

/**
 * V7 — subscribe to the /locations Firestore collection and keep the module
 * runtime cache in sync so synchronous getLocation() lookups resolve correctly.
 *
 * While the first snapshot is pending we expose DEFAULT_LOCATIONS so lists,
 * pickers, etc. never render empty. `loading` flips false once the first
 * real snapshot lands (or if `enabled=false`).
 */
export function useLocations(enabled: boolean): State {
  const [state, setState] = useState<State>({
    locations: DEFAULT_LOCATIONS,
    loading: Boolean(enabled),
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ locations: DEFAULT_LOCATIONS, loading: false, error: null });
      return;
    }
    const unsub = subscribeLocations(
      (locations) => {
        // Hydrate the module cache so getLocation() outside React trees works.
        _setLocationsRuntimeCache(locations);
        setState({ locations, loading: false, error: null });
      },
      (error) => setState((s) => ({ ...s, loading: false, error })),
    );
    return unsub;
  }, [enabled]);

  return state;
}

/** Convenience: id → Location map. Memoised on list identity. */
export function useLocationsById(locations: Location[]): Map<string, Location> {
  return useMemo(() => {
    const m = new Map<string, Location>();
    for (const l of locations) m.set(l.id, l);
    return m;
  }, [locations]);
}
