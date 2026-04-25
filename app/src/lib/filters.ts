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
  if (f === "all") return tasks;
  if (f === "done") return tasks.filter((t) => t.status === "Hotovo");
  return tasks.filter((t) => t.status !== "Hotovo");
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
  } catch {
    /* ignore */
  }
}
