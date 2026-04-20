import type { Task } from "@/types";

export type OpenClosedFilter = "all" | "open" | "done";

const PREFIX = "filter:";

// ---------- Open/Closed filter ----------

export function loadFilter(key: string): OpenClosedFilter {
  try {
    const v = sessionStorage.getItem(PREFIX + key);
    if (v === "all" || v === "open" || v === "done") return v;
  } catch {
    /* ignore */
  }
  return "open";
}

export function saveFilter(key: string, value: OpenClosedFilter): void {
  try {
    sessionStorage.setItem(PREFIX + key, value);
  } catch {
    /* ignore */
  }
}

export function applyOpenClosed(tasks: Task[], f: OpenClosedFilter): Task[] {
  if (f === "all") return tasks;
  if (f === "done") return tasks.filter((t) => t.status === "Hotovo");
  return tasks.filter((t) => t.status !== "Hotovo");
}

// ---------- Category filter ----------

export function loadCategoryFilter(key: string): string | null {
  try {
    const v = sessionStorage.getItem(PREFIX + key + ":category");
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveCategoryFilter(key: string, value: string | null): void {
  try {
    if (value) sessionStorage.setItem(PREFIX + key + ":category", value);
    else sessionStorage.removeItem(PREFIX + key + ":category");
  } catch {
    /* ignore */
  }
}

export function applyCategory(tasks: Task[], categoryId: string | null): Task[] {
  if (!categoryId) return tasks;
  return tasks.filter((t) => t.categoryId === categoryId);
}
