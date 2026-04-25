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
  task: Pick<Task, "createdBy">;
  /** V17.8 — role autora tasku, rozhodnutá callerem (buď přímo z task.authorRole,
   *  nebo — pokud field chybí — resolveAuthorRole() přes user lookup). */
  taskAuthorRole: UserRole | undefined;
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
}

export function canEditTask(input: CanEditInput): boolean {
  const { task, taskAuthorRole, currentUserUid, currentUserRole } = input;
  if (!currentUserUid) return false;
  if (task.createdBy === currentUserUid) return true;

  // V17.8 — když nevíme roli autora (field chybí a user lookup není k
  //   dispozici), NEDOVOLÍME cross-OWNER edit. Je to konzervativní — legacy
  //   PM-vytvořené tasky před V17.1 deploy nebudou OWNERi moci editovat
  //   dokud migrace nepoběží (viz scripts/migrate-authorRole.mjs).
  if (!taskAuthorRole) return false;
  if (taskAuthorRole === "OWNER" && currentUserRole === "OWNER") {
    return true;
  }
  return false;
}

/** Opak — pohodlné pojmenování pro UI větve. */
export function isReadOnlyTask(input: CanEditInput): boolean {
  return !canEditTask(input);
}

/**
 * V18-S07 — canEditEvent.
 *
 * Stejný pattern jako canEditTask (V17.1 cross-OWNER model) — duplikuji
 * se stejným fieldovým tvarem, protože events mají stejné schema pro
 * createdBy + authorRole. Typově je to separátní helper, aby šlo v
 * budoucnu divergovat (např. pokud events budou mít "edit jen
 * v UPCOMING" konstraint).
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
  const { event, currentUserUid, currentUserRole } = input;
  if (!currentUserUid) return false;
  if (event.createdBy === currentUserUid) return true;
  const role = event.authorRole;
  if (!role) return false; // missing authorRole → safe default: no cross-OWNER
  if (role === "OWNER" && currentUserRole === "OWNER") return true;
  return false;
}
