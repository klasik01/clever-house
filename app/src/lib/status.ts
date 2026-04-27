import type { TaskStatus, TaskType } from "@/types";
import type { TFn } from "@/i18n/useT";

/**
 * V10 — canonical status set for úkoly (otázky).
 *
 * V10 collapsed the V5 role-based model (ON_CLIENT_SITE / ON_PM_SITE) into a
 * single active state + three terminal ones. "Kdo to řeší" lives in
 * `task.assigneeUid` now, not in the status.
 *
 * OPEN     — úkol se aktivně řeší. Assignee = řešitel.
 * BLOCKED  — externě blokováno (např. čeká se na 3. stranu).
 * CANCELED — stornováno, žádná akce se neočekává.
 * DONE     — vyřešeno.
 */
export type OtazkaStatusCanonical =
  | "OPEN"
  | "BLOCKED"
  | "CANCELED"
  | "DONE";

export type NapadStatus = "Nápad" | "Rozhodnuto" | "Ve stavbě" | "Hotovo";

export const OTAZKA_STATUSES: OtazkaStatusCanonical[] = [
  "OPEN",
  "BLOCKED",
  "CANCELED",
  "DONE",
];

export const NAPAD_STATUSES: NapadStatus[] = [
  "Nápad",
  "Rozhodnuto",
  "Ve stavbě",
  "Hotovo",
];

/**
 * Map a legacy otázka status value onto the V10 canonical set.
 *
 *   "Otázka", "Čekám"                       → OPEN   (active, pre-V5 two-state)
 *   "ON_CLIENT_SITE", "ON_PM_SITE"           → OPEN   (active, V5 role-based)
 *   "Rozhodnuto", "Ve stavbě", "Hotovo"      → DONE
 *   "BLOCKED", "CANCELED", "DONE"             pass-through
 *   "OPEN"                                    pass-through
 *
 * Never destructive — only transforms for read/render; writes use the new
 * canonical values directly.
 */
export function mapLegacyOtazkaStatus(s: TaskStatus): OtazkaStatusCanonical {
  switch (s) {
    case "OPEN":
    case "BLOCKED":
    case "CANCELED":
    case "DONE":
      return s;
    case "ON_PM_SITE":
    case "ON_CLIENT_SITE":
    case "Otázka":
    case "Čekám":
      return "OPEN";
    case "Rozhodnuto":
    case "Ve stavbě":
    case "Hotovo":
      return "DONE";
    case "Nápad":
    default:
      // Nápad never reaches here for a type=otazka task — fall back to OPEN
      // so the task doesn’t visually disappear.
      return "OPEN";
  }
}

/**
 * Returns the canonical status for any task, branching on type.
 * For nápad the raw value is returned unchanged; for otázka the legacy mapper
 * normalises older records to V10 values.
 */
export function canonicalStatus(
  type: TaskType,
  status: TaskStatus,
): TaskStatus {
  // V14 — úkol shares the otázka canonical set (OPEN / BLOCKED / CANCELED / DONE).
  if (type === "otazka" || type === "ukol") return mapLegacyOtazkaStatus(status);
  // V19 — dokumentace has no workflow status; return raw value (typically "Nápad"
  // from createTask default, but never displayed in UI).
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
  // V14 — both otázka and úkol carry the ball-on-me semantic. Nápady and
  // dokumentace are containers and don't flow through an assignee pipeline.
  if (task.type !== "otazka" && task.type !== "ukol") return false;
  if (canonicalStatus(task.type, task.status) !== "OPEN") return false;
  const assigned = task.assigneeUid ?? task.createdBy;
  return assigned === uid;
}

/**
 * Render a Czech label for any status. V10 status labels are role-agnostic
 * (assignee drives ownership, not role). Legacy values go through the mapper
 * first so old records still read correctly.
 */
export function statusLabel(
  t: TFn,
  status: TaskStatus,
  opts: { isPm?: boolean; type?: TaskType } = {},
): string {
  const { type } = opts;
  // V14 — úkol uses the same canonical labels as otázka.
  const s = (type === "otazka" || type === "ukol") ? mapLegacyOtazkaStatus(status) : status;
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
      // Nápad flat keys fall through.
      return t(`status.${s}`);
  }
}
