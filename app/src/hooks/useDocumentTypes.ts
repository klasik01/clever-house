import { useEffect, useState } from "react";
import { subscribeDocumentTypes } from "@/lib/documentTypes";
import type { DocumentType } from "@/types";

interface State {
  documentTypes: DocumentType[];
  loading: boolean;
  error: Error | null;
}

export function useDocumentTypes(enabled: boolean): State {
  const [state, setState] = useState<State>({
    documentTypes: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ documentTypes: [], loading: false, error: null });
      return;
    }
    const unsub = subscribeDocumentTypes(
      (documentTypes) => setState({ documentTypes, loading: false, error: null }),
      (error) => setState((s) => ({ ...s, loading: false, error })),
    );
    return unsub;
  }, [enabled]);

  return state;
}
