import type { Task } from "@/types";

export type OpenClosedFilter = "all" | "open" | "done";

const PREFIX = "filter:";

export function loadFilter(key: string): OpenClosedFilter {
  try {
    const v = sessionStorage.getItem(PREFIX + key);
    if (v === "all" || v === "open" || v === "done") return v;
  } catch {
    /* ignore */
  }
  return "open"; // default: otevřené
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
