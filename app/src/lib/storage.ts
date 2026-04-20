// localStorage-backed persistence for S01. Replaced by Firestore in S02.
import type { Task } from "@/types";

const TASKS_KEY = "chytry-dum:tasks";
const DRAFT_KEY = "chytry-dum:capture-draft";

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Task[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (e) {
    // QuotaExceeded? Signal via console for now; S14 adds telemetry.
    console.error("saveTasks failed", e);
  }
}

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
