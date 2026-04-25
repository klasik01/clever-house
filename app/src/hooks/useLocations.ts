import { useEffect, useMemo, useState } from "react";
import {
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
 * V18-S29 — odstraněn fallback na DEFAULT_LOCATIONS jako initial state.
 * Předtím komponenty zobrazily hard-coded seed defaults na ~100ms než
 * dorazil první Firestore snapshot — flash of stale content. Teď začínáme
 * s prázdným polem a `loading: true`. Caller je zodpovědný za skeleton /
 * spinner do doby, než `loading` přepadne na false.
 */
export function useLocations(enabled: boolean): State {
  const [state, setState] = useState<State>({
    locations: [],
    loading: Boolean(enabled),
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ locations: [], loading: false, error: null });
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
