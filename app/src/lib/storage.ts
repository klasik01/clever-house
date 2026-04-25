// localStorage for client-only state (draft, theme preference).
// Tasks moved to Firestore in S02 (see src/lib/tasks.ts).

import { LOCAL_STORAGE } from "./storageKeys";

const DRAFT_KEY = LOCAL_STORAGE.taskDraft;

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
