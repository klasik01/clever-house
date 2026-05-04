import { useEffect, useState } from "react";
import { subscribeSection, subscribeSections } from "@/lib/budget/sections";
import type { BudgetSection } from "@/types";

type SectionsState =
  | { status: "loading"; sections: [] }
  | { status: "ready"; sections: BudgetSection[] }
  | { status: "error"; sections: []; error: Error };

export function useBudgetSections(): SectionsState {
  const [state, setState] = useState<SectionsState>({
    status: "loading",
    sections: [],
  });

  useEffect(() => {
    const unsub = subscribeSections(
      (sections) => setState({ status: "ready", sections }),
      (error) => setState({ status: "error", sections: [], error }),
    );
    return unsub;
  }, []);

  return state;
}

type SectionState =
  | { status: "loading"; section: null }
  | { status: "ready"; section: BudgetSection }
  | { status: "missing"; section: null }
  | { status: "error"; section: null };

export function useBudgetSection(id: string | undefined): SectionState {
  const [state, setState] = useState<SectionState>({
    status: "loading",
    section: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ status: "loading", section: null });
      return;
    }
    const unsub = subscribeSection(
      id,
      (section) =>
        setState(
          section
            ? { status: "ready", section }
            : { status: "missing", section: null },
        ),
      () => setState({ status: "error", section: null }),
    );
    return unsub;
  }, [id]);

  return state;
}
