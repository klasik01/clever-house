// localStorage for client-only state (draft, theme preference).
// Tasks moved to Firestore in S02 (see src/lib/tasks.ts).

const DRAFT_KEY = "chytry-dum:capture-draft";

export function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDraft(text: string): void {
  try {
    if (text.length === 0) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, text);
  } catch {
    /* swallow */
  }
}
