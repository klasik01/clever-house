import type { Task } from "@/types";

/**
 * Normalise a string for search: lowercase + strip combining diacritics so
 * "Kuchyň" matches "kuchyn". Keeps letters + digits + whitespace, drops
 * punctuation so "co teď?" matches "co ted".
 */
export function normaliseForSearch(s: string): string {
  return s
    .toLocaleLowerCase("cs")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Return true if `task.title` or `task.body` contains every word of `query`
 * (AND match). Empty query matches everything.
 */
export function matchTaskQuery(task: Task, query: string): boolean {
  const q = normaliseForSearch(query).trim();
  if (!q) return true;
  const haystack = normaliseForSearch(`${task.title ?? ""}\n${task.body ?? ""}`);
  // Split on whitespace — every token must match somewhere in haystack.
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

export function applySearch(tasks: Task[], query: string): Task[] {
  const q = query.trim();
  if (!q) return tasks;
  return tasks.filter((t) => matchTaskQuery(t, q));
}
