import type { Task, UserRole } from "@/types";

/**
 * V17.1 — pravidla kdo může editovat task.
 *
 *   1. Autor vždy (createdBy === me).
 *   2. OWNER smí editovat libovolný OWNER-vytvořený task (shared household).
 *   3. PM-vytvořené tasky smí editovat jen sám autor-PM.
 *   4. Legacy tasky bez authorRole → fallback "OWNER".
 *
 * Pure funkce — žádný Firestore, žádný UI state. Stejná logika se přidává
 * Firestore rules; tady je klientská varianta pro UI gating (enable/disable
 * vstupů, zobrazení read-only banneru). Rules jsou authoritative, tenhle
 * helper jen dělá UX přívětivějším.
 */

export interface CanEditInput {
  task: Pick<Task, "createdBy" | "authorRole">;
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
}

export function canEditTask(input: CanEditInput): boolean {
  const { task, currentUserUid, currentUserRole } = input;
  if (!currentUserUid) return false;
  if (task.createdBy === currentUserUid) return true;

  // Legacy fallback: neuložený authorRole → předpokládáme OWNER (historicky
  // PM neexistoval jako tvůrce).
  const taskAuthorRole: UserRole = task.authorRole ?? "OWNER";
  if (taskAuthorRole === "OWNER" && currentUserRole === "OWNER") {
    return true;
  }
  return false;
}

/** Opak — pohodlné pojmenování pro UI větve. */
export function isReadOnlyTask(input: CanEditInput): boolean {
  return !canEditTask(input);
}
