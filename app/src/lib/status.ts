import type { TaskStatus, TaskType } from "@/types";
import type { TFn } from "@/i18n/useT";

/**
 * V5 — canonical status set for otázka.
 *
 * ON_CLIENT_SITE — the ball is on the owner (client). Translations differ by
 *                  viewer role: OWNER sees "K vyjádření", PM sees "Čeká na klienta".
 * ON_PM_SITE     — the ball is on the project manager. OWNER sees
 *                  "Na projektantovi", PM sees "K řešení".
 * BLOCKED        — externally blocked; nobody can move it right now.
 * CANCELED       — withdrawn; no further action expected.
 * DONE           — resolved.
 */
export type OtazkaStatusCanonical =
  | "ON_CLIENT_SITE"
  | "ON_PM_SITE"
  | "BLOCKED"
  | "CANCELED"
  | "DONE";

export type NapadStatus = "Nápad" | "Rozhodnuto" | "Ve stavbě" | "Hotovo";

export const OTAZKA_STATUSES: OtazkaStatusCanonical[] = [
  "ON_PM_SITE",
  "ON_CLIENT_SITE",
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
 * Map legacy otázka status values (from pre-V5 Firestore records) onto the new
 * canonical set. Called at read sites — no destructive DB migration.
 *
 *   "Otázka"     → ON_PM_SITE      (ball was on assignee / PM)
 *   "Čekám"      → ON_CLIENT_SITE  (ball was on OWNER awaiting info)
 *   "Rozhodnuto" → DONE            (rolled up — legacy "decided" is basically closed)
 *   "Ve stavbě"  → DONE            (same — work has moved on)
 *   "Hotovo"     → DONE
 *
 * Already-canonical values pass through. Nápad values are returned untouched
 * because nápad keeps its own workflow — callers should gate on task.type first.
 */
export function mapLegacyOtazkaStatus(s: TaskStatus): OtazkaStatusCanonical {
  switch (s) {
    case "ON_CLIENT_SITE":
    case "ON_PM_SITE":
    case "BLOCKED":
    case "CANCELED":
    case "DONE":
      return s;
    case "Otázka":
      return "ON_PM_SITE";
    case "Čekám":
      return "ON_CLIENT_SITE";
    case "Rozhodnuto":
    case "Ve stavbě":
    case "Hotovo":
      return "DONE";
    case "Nápad":
    default:
      // Should never happen for type=otazka, but default to ON_PM_SITE so the
      // task doesn't visually disappear.
      return "ON_PM_SITE";
  }
}

/**
 * Returns the canonical status for any task, branching on type.
 * For nápad the raw value is returned unchanged; for otázka the legacy mapper
 * normalises old records to V5 values.
 */
export function canonicalStatus(
  type: TaskType,
  status: TaskStatus,
): TaskStatus {
  if (type === "otazka") return mapLegacyOtazkaStatus(status);
  return status;
}

export function isOtazkaCanonical(s: TaskStatus): s is OtazkaStatusCanonical {
  return (OTAZKA_STATUSES as readonly string[]).includes(s);
}

/**
 * Render a per-role Czech label for any (canonical) status.
 *
 * - ON_CLIENT_SITE and ON_PM_SITE have two i18n keys each: `.owner` / `.pm`.
 * - BLOCKED / CANCELED / DONE are role-agnostic.
 * - Legacy otazka values are mapped first.
 * - Nápad statuses fall back to the existing flat `status.*` keys.
 */
export function statusLabel(
  t: TFn,
  status: TaskStatus,
  opts: { isPm: boolean; type?: TaskType } = { isPm: false },
): string {
  const { isPm, type } = opts;
  // If we know it is otázka, normalise legacy values first.
  const s = type === "otazka" ? mapLegacyOtazkaStatus(status) : status;
  switch (s) {
    case "ON_CLIENT_SITE":
      return t(isPm ? "statusOtazka.ON_CLIENT_SITE.pm" : "statusOtazka.ON_CLIENT_SITE.owner");
    case "ON_PM_SITE":
      return t(isPm ? "statusOtazka.ON_PM_SITE.pm" : "statusOtazka.ON_PM_SITE.owner");
    case "BLOCKED":
      return t("statusOtazka.BLOCKED");
    case "CANCELED":
      return t("statusOtazka.CANCELED");
    case "DONE":
      return t("statusOtazka.DONE");
    default:
      // Nápad flat keys + legacy otazka values when type is unknown
      return t(`status.${s}`);
  }
}
