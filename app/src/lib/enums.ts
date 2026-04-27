/**
 * V18-S40 — `as const` arraye pro cross-cutting union types.
 *
 * Dva use-cases, které čisté TS unions neřeší:
 *
 *   1. **Iterace** — pro dropdowns, select options, validation:
 *      `USER_ROLES.map(role => ...)` místo "OWNER" | "PROJECT_MANAGER"
 *      hard-coded array někde.
 *
 *   2. **Runtime check** — `EVENT_STATUSES.includes(value)` jako type
 *      guard. TS si v unionu nemá podle čeho rozhodnout v runtime.
 *
 * **Source of truth pravidlo**: pokud TS union (`UserRole`, `TaskType`)
 * existuje v `types.ts`, **odvozuji array TADY** ze stejných hodnot a
 * deklaruji invariant test (níže). Jakmile někdo přidá novou hodnotu
 * do unionu, test selže a donutí ho doplnit i sem. Tím je drift
 * detekovaný v review, ne v produkci.
 */

import type {
  EventStatus,
  TaskType,
  UserRole,
} from "@/types";

// ---------- Roles ----------

export const USER_ROLES = ["OWNER", "PROJECT_MANAGER"] as const;
// Sanity: array hodnoty musí matchnout UserRole union (TypeScript ti to ohlídá).
// Pokud přidáš "WORKER" do UserRole, tady to TS označí.
const _userRolesCheck: readonly UserRole[] = USER_ROLES;
void _userRolesCheck;

// ---------- Task types ----------

export const TASK_TYPES = ["napad", "otazka", "ukol", "dokumentace"] as const;
const _taskTypesCheck: readonly TaskType[] = TASK_TYPES;
void _taskTypesCheck;

// ---------- Event statuses ----------

export const EVENT_STATUSES = [
  "UPCOMING",
  "AWAITING_CONFIRMATION",
  "HAPPENED",
  "CANCELLED",
] as const;
const _eventStatusesCheck: readonly EventStatus[] = EVENT_STATUSES;
void _eventStatusesCheck;

// ---------- Helpers ----------

/** Type guard nad libovolným unknown. Bezpečnější než přímý cast. */
export function isUserRole(v: unknown): v is UserRole {
  return typeof v === "string" && (USER_ROLES as readonly string[]).includes(v);
}

export function isTaskType(v: unknown): v is TaskType {
  return typeof v === "string" && (TASK_TYPES as readonly string[]).includes(v);
}

export function isEventStatus(v: unknown): v is EventStatus {
  return typeof v === "string" && (EVENT_STATUSES as readonly string[]).includes(v);
}
