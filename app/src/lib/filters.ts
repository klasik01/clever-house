import type { Task } from "@/types";

export type OpenClosedFilter = "all" | "open" | "done";

import { FILTER_KEY_PREFIX } from "./storageKeys";

const PREFIX = FILTER_KEY_PREFIX;

// ---------- Open/Closed ----------

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
  // V25 — canonical statuses; "Hotovo" legacy → "DONE".
  if (f === "all") return tasks;
  if (f === "done") return tasks.filter((t) => t.status === "DONE");
  return tasks.filter((t) => t.status !== "DONE");
}

// ---------- Category ----------

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

// ---------- Location ----------

export function loadLocationFilter(key: string): string | null {
  try {
    const v = sessionStorage.getItem(PREFIX + key + ":location");
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveLocationFilter(key: string, value: string | null): void {
  try {
    if (value) sessionStorage.setItem(PREFIX + key + ":location", value);
    else sessionStorage.removeItem(PREFIX + key + ":location");
  } catch {
    /* ignore */
  }
}

export function applyLocation(tasks: Task[], locationId: string | null): Task[] {
  if (!locationId) return tasks;
  return tasks.filter((t) => t.locationId === locationId);
}



// ---------- Phase ----------

export function loadPhaseFilter(key: string): string | null {
  try {
    const v = sessionStorage.getItem(PREFIX + key + ":phase");
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function savePhaseFilter(key: string, value: string | null): void {
  try {
    if (value) sessionStorage.setItem(PREFIX + key + ":phase", value);
    else sessionStorage.removeItem(PREFIX + key + ":phase");
  } catch {
    /* ignore */
  }
}

export function applyPhase(tasks: Task[], phaseId: string | null): Task[] {
  if (!phaseId) return tasks;
  return tasks.filter((t) => t.phaseId === phaseId);
}

// ---------- Sort ----------

export type SortKey = "updatedAt" | "createdAt" | "title";

export function loadSort(key: string): SortKey {
  try {
    const v = sessionStorage.getItem(PREFIX + key + ":sort");
    if (v === "updatedAt" || v === "createdAt" || v === "title") return v;
  } catch { /* ignore */ }
  return "updatedAt";
}

export function saveSort(key: string, value: SortKey): void {
  try {
    sessionStorage.setItem(PREFIX + key + ":sort", value);
  } catch { /* ignore */ }
}

export function applySort(tasks: Task[], sort: SortKey): Task[] {
  const copy = [...tasks];
  switch (sort) {
    case "updatedAt":
      return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    case "createdAt":
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "title":
      return copy.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "cs"));
    default:
      return copy;
  }
}

// ---------- Reset ----------

/**
 * S42 — Remove all filter state for `key` (status / category / location).
 * Called by Reset pill in list header.
 */
export function clearAllFilters(key: string): void {
  try {
    sessionStorage.removeItem(PREFIX + key);
    sessionStorage.removeItem(PREFIX + key + ":category");
    sessionStorage.removeItem(PREFIX + key + ":location");
    sessionStorage.removeItem(PREFIX + key + ":phase");
    sessionStorage.removeItem(PREFIX + key + ":sort");
  } catch {
    /* ignore */
  }
}
