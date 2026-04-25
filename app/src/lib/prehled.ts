import type { Task } from "@/types";
import { STUCK_TASK_THRESHOLD_DAYS, STUCK_TASK_THRESHOLD_MS } from "./limits";

export type PrehledFilterId = "waiting-me" | "waiting-others" | "overdue" | "stuck";
/**
 * @deprecated Pojmenování zachováno pro existing imports;
 * delegujeme na `STUCK_TASK_THRESHOLD_DAYS` z `limits.ts`.
 */
export const STUCK_DAYS = STUCK_TASK_THRESHOLD_DAYS;
export const M2_TARGET = 3;

/**
 * Group all tasks (otazky only) into the 4 /prehled buckets.
 * Pure fn — used both by the /prehled route and the Nastavení summary card.
 */
export function computePrehledGroups(
  tasks: Task[],
  uid: string,
  now = Date.now()
): Record<PrehledFilterId, Task[]> {
  const stuckThresholdMs = STUCK_TASK_THRESHOLD_MS;
  // V14 — Přehled covers both otázka and úkol (both are actionable).
  const onlyOtazky = tasks.filter((t) => t.type === "otazka" || t.type === "ukol");

  return {
    "waiting-me": onlyOtazky.filter((t) => {
      const assigned = t.assigneeUid ?? t.createdBy;
      return assigned === uid && (t.status === "Otázka" || t.status === "Čekám");
    }),
    "waiting-others": onlyOtazky.filter((t) => {
      const assigned = t.assigneeUid ?? t.createdBy;
      return Boolean(assigned) && assigned !== uid && (t.status === "Otázka" || t.status === "Čekám");
    }),
    overdue: onlyOtazky.filter((t) => {
      return Boolean(t.deadline) && (t.deadline ?? 0) < now && t.status !== "Hotovo";
    }),
    stuck: onlyOtazky.filter((t) => {
      if (t.status !== "Čekám") return false;
      const updated = Date.parse(t.updatedAt);
      if (!Number.isFinite(updated)) return false;
      return now - updated >= stuckThresholdMs;
    }),
  };
}

/** Quick check for M2 banner state. True = within target. */
export function isM2Ok(stuckCount: number): boolean {
  return stuckCount <= M2_TARGET;
}
