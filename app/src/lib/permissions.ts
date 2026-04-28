import type { Task, UserRole } from "@/types";
import { canActOnResource } from "./permissionsConfig";

/**
 * V17.1 — pravidla kdo může editovat task.
 * V18-S38 — refaktor: vnitřek deleguje na `canActOnResource` z permissionsConfig.
 *           API zachované (callers v TaskDetail.tsx a EventDetail.tsx
 *           nezměnili signature) — config se mění na jednom místě.
 *
 *   1. Autor vždy (createdBy === me).
 *   2. OWNER smí editovat libovolný OWNER-vytvořený task (shared household).
 *   3. PM-vytvořené tasky smí editovat jen sám autor-PM.
 *   4. Legacy tasky bez authorRole → safe-default = nedovol cross-edit.
 *
 * Pure funkce — žádný Firestore, žádný UI state. Stejná logika se přidává
 * Firestore rules; tady je klientská varianta pro UI gating (enable/disable
 * vstupů, zobrazení read-only banneru). Rules jsou authoritative, tenhle
 * helper jen dělá UX přívětivějším.
 */

export interface CanEditInput {
  task: Pick<Task, "createdBy">;
  /** V17.8 — role autora tasku, rozhodnutá callerem (buď přímo z task.authorRole,
   *  nebo — pokud field chybí — resolveAuthorRole() přes user lookup). */
  taskAuthorRole: UserRole | undefined;
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
}

export function canEditTask(input: CanEditInput): boolean {
  return canActOnResource("task.edit", {
    role: input.currentUserRole,
    uid: input.currentUserUid,
    resourceCreatedBy: input.task.createdBy,
    resourceAuthorRole: input.taskAuthorRole,
  });
}

/** Opak — pohodlné pojmenování pro UI větve. */
export function isReadOnlyTask(input: CanEditInput): boolean {
  return !canEditTask(input);
}

/**
 * V18-S07 — canEditEvent.
 *
 * Stejný pattern jako canEditTask (V17.1 cross-OWNER model). Po V18-S38
 * deleguje na permissionsConfig přes klíč `event.edit`.
 */
export interface CanEditEventInput {
  event: {
    createdBy: string;
    authorRole?: UserRole;
  };
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
}

export function canEditEvent(input: CanEditEventInput): boolean {
  return canActOnResource("event.edit", {
    role: input.currentUserRole,
    uid: input.currentUserUid,
    resourceCreatedBy: input.event.createdBy,
    resourceAuthorRole: input.event.authorRole,
  });
}

/**
 * V23 — klientský visibility gate.
 *
 * OWNER vidí vždy vše.
 * PM vidí task jen pokud:
 *   - je v sharedWithRoles ("PROJECT_MANAGER"),
 *   - nebo je autorem,
 *   - nebo je assignee.
 *
 * Pure funkce, Firestore rules stále povolují read všem signed-in
 * (V15.2), toto je čistě UX filtr na klientu.
 */
export interface CanViewInput {
  task: Pick<Task, "createdBy" | "assigneeUid" | "sharedWithRoles">;
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
}

export function canViewTask(input: CanViewInput): boolean {
  const { task, currentUserUid, currentUserRole } = input;
  // Unauthenticated — no access.
  if (!currentUserUid || !currentUserRole) return false;
  // OWNER sees everything.
  if (currentUserRole === "OWNER") return true;
  // Author always sees their own tasks.
  if (task.createdBy === currentUserUid) return true;
  // Assignee always sees their assigned tasks.
  if (task.assigneeUid === currentUserUid) return true;
  // PM sees tasks shared with their role.
  const roles = task.sharedWithRoles ?? [];
  return roles.includes(currentUserRole);
}
