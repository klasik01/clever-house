import type { Task, UserProfile, UserRole } from "@/types";

/**
 * V17.8 — resolve role autora tasku. Source of truth hierarchie:
 *
 *   1. task.authorRole — snapshot uložený při create (V17.1 a novější).
 *   2. users[task.createdBy].role — current role autora (self-healing
 *      pro legacy tasky vytvořené před V17.1 deploy).
 *   3. undefined — autor neznámý (smazaný účet, data corruption). Caller
 *      musí rozhodnout co s tím; obvykle to znamená "nedovol edit" pro
 *      bezpečnostní safe-default.
 *
 * Pokud chceš trvalé řešení bez dependency na users lookup, spusť
 * `scripts/migrate-authorRole.mjs` — doplní field do všech historických
 * tasků přes Admin SDK. Potom je #1 pravidlo vždy dostačující.
 */

export interface ResolveAuthorRoleInput {
  task: Pick<Task, "createdBy" | "authorRole">;
  /** Map UID → UserProfile. Caller typicky dodá `byUid` z useUsers hooku. */
  usersByUid: Map<string, Pick<UserProfile, "role">>;
}

export function resolveAuthorRole(
  input: ResolveAuthorRoleInput,
): UserRole | undefined {
  if (input.task.authorRole === "OWNER" || input.task.authorRole === "PROJECT_MANAGER") {
    return input.task.authorRole;
  }
  const user = input.usersByUid.get(input.task.createdBy);
  if (user?.role === "OWNER" || user?.role === "PROJECT_MANAGER") {
    return user.role;
  }
  return undefined;
}
