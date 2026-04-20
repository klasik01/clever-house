import { useEffect, useState } from "react";
import { subscribeCategories } from "@/lib/categories";
import type { Category } from "@/types";

interface State {
  categories: Category[];
  loading: boolean;
  error: Error | null;
}

export function useCategories(enabled: boolean): State {
  const [state, setState] = useState<State>({
    categories: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ categories: [], loading: false, error: null });
      return;
    }
    const unsub = subscribeCategories(
      (categories) => setState({ categories, loading: false, error: null }),
      (error) => setState((s) => ({ ...s, loading: false, error }))
    );
    return unsub;
  }, [enabled]);

  return state;
}
