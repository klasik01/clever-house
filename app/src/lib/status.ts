import type { TaskStatus, TaskType } from "@/types";
import type { TFn } from "@/i18n/useT";

/**
 * V25 — canonical status set: 4 hodnoty.
 *
 *   OPEN     — aktivní, někdo je na tahu (assigneeUid).
 *   BLOCKED  — externí překážka (úřad, statik, materiál, počasí).
 *   CANCELED — zrušeno.
 *   DONE     — vyřešeno.
 *
 * V25 odstranilo legacy hodnoty (V5/V10 mix). `mapLegacyOtazkaStatus` zůstává
 * jako paranoid bridge pro případ neočekávaných legacy reads — vrací OPEN
 * jako safe default. Migration script v `app/deploy/pending/2026-04-29-V25-canonical-status.mjs`
 * přepsal všechny historické tasky.
 */
export type OtazkaStatusCanonical = TaskStatus;

export const OTAZKA_STATUSES: OtazkaStatusCanonical[] = [
  "OPEN",
  "BLOCKED",
  "CANCELED",
  "DONE",
];

/**
 * V25 — defensive mapper. Vstup je teď garantovaně canonical (TaskStatus
 * union má jen 4 hodnoty), ale runtime bridge zachová bezpečnost pro
 * případ, kdyby se v Firestore objevily legacy hodnoty z neúspěšné
 * migrace nebo bypass write.
 *
 * Pre-V25 mapping (deprecated, zachovaný pro defensive read):
 *   - "Otázka" | "Čekám" | "Ve stavbě" | "ON_CLIENT_SITE" | "ON_PM_SITE" | "Nápad" → OPEN
 *   - "Rozhodnuto" | "Hotovo" → DONE
 */
export function mapLegacyOtazkaStatus(s: TaskStatus | string): OtazkaStatusCanonical {
  if (s === "OPEN" || s === "BLOCKED" || s === "CANCELED" || s === "DONE") return s;
  // Defensive — neznámé / legacy → OPEN (assignee dál ukáže kdo je na tahu).
  if (s === "Rozhodnuto" || s === "Hotovo") return "DONE";
  return "OPEN";
}

/**
 * Returns the canonical status for any task. V25 — vstupy už jsou canonical,
 * ale defensive bridge pro případ legacy reads.
 */
export function canonicalStatus(
  type: TaskType,
  status: TaskStatus,
): TaskStatus {
  // V14 — úkol shares the otázka canonical set.
  // V23 — napad (téma) shares the same.
  if (type === "otazka" || type === "ukol" || type === "napad") return mapLegacyOtazkaStatus(status);
  // V19 — dokumentace has no workflow status; raw value passes through.
  return status;
}

export function isOtazkaCanonical(s: TaskStatus): s is OtazkaStatusCanonical {
  return (OTAZKA_STATUSES as readonly string[]).includes(s);
}

/**
 * V10 — ball-on-me = assigneeUid points at `uid` and the úkol is still OPEN.
 * Legacy records without assigneeUid fall back to createdBy so the original
 * author keeps the ball until they explicitly pass it on.
 */
export function isBallOnMe(
  task: { type: TaskType; status: TaskStatus; assigneeUid?: string | null; createdBy: string },
  uid: string | undefined,
): boolean {
  if (!uid) return false;
  // V14 — otázka, úkol carry the ball-on-me semantic. Nápady (témata) and
  // dokumentace are containers and don't flow through an assignee pipeline.
  if (task.type !== "otazka" && task.type !== "ukol") return false;
  if (canonicalStatus(task.type, task.status) !== "OPEN") return false;
  const assigned = task.assigneeUid ?? task.createdBy;
  return assigned === uid;
}

/**
 * V25 — Czech label for canonical status.
 *
 * UI label != technical status (Codequ recommendation):
 *   OPEN     → "Otevřené"
 *   BLOCKED  → "Blokováno"
 *   CANCELED → "Zrušeno"
 *   DONE     → "Hotovo"
 *
 * `opts.isPm` ponecháno pro backwards compat caller signature; aktuálně
 * neoznačuje žádný PM-specifický label (V10 byly role-agnostic).
 */
export function statusLabel(
  t: TFn,
  status: TaskStatus,
  opts: { isPm?: boolean; type?: TaskType } = {},
): string {
  const { type } = opts;
  const s = (type === "otazka" || type === "ukol" || type === "napad") ? mapLegacyOtazkaStatus(status) : status;
  switch (s) {
    case "OPEN":
      return t("statusOtazka.OPEN");
    case "BLOCKED":
      return t("statusOtazka.BLOCKED");
    case "CANCELED":
      return t("statusOtazka.CANCELED");
    case "DONE":
      return t("statusOtazka.DONE");
    default:
      return t(`statusOtazka.OPEN`);
  }
}
