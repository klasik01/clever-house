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
 * V18-S40 — kdo smí změnit typ tasku (otazka ↔ ukol).
 *
 * Stejný pattern jako canEditTask (autor + cross-OWNER), ale ostře gated
 * jen na otazka↔ukol mutaci. Napad a dokumentace nelze měnit (mají
 * fundamentálně jiný workflow / pole).
 */
export interface CanChangeTypeInput extends CanEditInput {
  task: Pick<Task, "createdBy" | "type">;
}

export function canChangeTaskType(input: CanChangeTypeInput): boolean {
  // Convert je definovaný jen mezi otazka a ukol. Napad a dokumentace
  // mají vlastní type-specific fields a workflow.
  if (input.task.type !== "otazka" && input.task.type !== "ukol") return false;
  return canActOnResource("task.changeType", {
    role: input.currentUserRole,
    uid: input.currentUserUid,
    resourceCreatedBy: input.task.createdBy,
    resourceAuthorRole: input.taskAuthorRole,
  });
}

/**
 * V18-S40 — kdo smí přidat/odebrat propojení mezi tasky.
 *
 * Pravidlo: caller musí mít edit (autor nebo cross-OWNER) na **obě strany**
 * propojení. Tj. uživatel propojí otázku/úkol s tématem jen tehdy, když
 * smí editovat oba dokumenty. Tímto:
 *   - PM nemůže nasadit cizí téma na PM-otázku, ledaže je téma OWNER-created
 *     (pak má cross-OWNER edit) — ale u OWNER-created tématu by stejně měl
 *     být oprávněný šťourat.
 *   - OWNER nemůže přidat svoji otázku do PM-soukromého tématu (PM-tasks
 *     nelze měnit cross-OWNER).
 *
 * Server-side rules to nemůžou plně vynutit (rule vidí jen jeden dokument),
 * ale obě strany se updatují v jednom batch — když permise selže na jednom,
 * celý batch padne. Tím rules cross-validate efektivně z UI.
 */
export interface CanLinkInput {
  task: Pick<Task, "createdBy">;
  taskAuthorRole: UserRole | undefined;
  other: Pick<Task, "createdBy">;
  otherAuthorRole: UserRole | undefined;
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
}

export function canLinkTasks(input: CanLinkInput): boolean {
  const onTask = canActOnResource("task.link", {
    role: input.currentUserRole,
    uid: input.currentUserUid,
    resourceCreatedBy: input.task.createdBy,
    resourceAuthorRole: input.taskAuthorRole,
  });
  const onOther = canActOnResource("task.link", {
    role: input.currentUserRole,
    uid: input.currentUserUid,
    resourceCreatedBy: input.other.createdBy,
    resourceAuthorRole: input.otherAuthorRole,
  });
  return onTask && onOther;
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
  task: Pick<Task, "type" | "createdBy" | "assigneeUid" | "sharedWithRoles" | "authorRole">;
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
}

/**
 * V23 + V24 — klientský visibility gate.
 *
 * OWNER vidí vždy vše.
 * PM vidí task jen pokud:
 *   - je v sharedWithRoles ("PROJECT_MANAGER"),
 *   - nebo je autorem,
 *   - nebo je assignee.
 *
 * V24 — CONSTRUCTION_MANAGER:
 *   - napad: NIKDY (rodinný brainstorming, NDA hranice)
 *   - dokumentace: jen pokud sharedWithRoles obsahuje "CONSTRUCTION_MANAGER"
 *   - otazka/ukol: vlastní (assignee/creator) nebo cross-CM team (authorRole=CM)
 *
 * Pure funkce. Server-side rules (firestore.rules `canReadTaskByCm`) jsou
 * authoritative; tahle funkce mirrorrue je pro UI gating + dvojitou pojistku
 * v `useVisibleTasks`.
 */
export function canViewTask(input: CanViewInput): boolean {
  const { task, currentUserUid, currentUserRole } = input;
  // Unauthenticated — no access.
  if (!currentUserUid || !currentUserRole) return false;
  // OWNER sees everything.
  if (currentUserRole === "OWNER") return true;

  // V24 — CM má scoped access.
  if (currentUserRole === "CONSTRUCTION_MANAGER") {
    // CM nikdy nevidí napad (rodinný brainstorming).
    if (task.type === "napad") return false;
    if (task.type === "dokumentace") {
      const roles = task.sharedWithRoles ?? [];
      return roles.includes("CONSTRUCTION_MANAGER");
    }
    // otazka / ukol — vlastní nebo cross-CM team scope.
    if (task.createdBy === currentUserUid) return true;
    if (task.assigneeUid === currentUserUid) return true;
    if (task.authorRole === "CONSTRUCTION_MANAGER") return true;
    // Cross-CM via assignee role NENÍ pokrytý klientským filtrem (vyžadovalo
    //   by useUsers lookup s CM uids); server rules ho povolují, klient
    //   ho v listingu nezobrazí. CM-B uvidí "OWNER → CM-A" task přes
    //   mention/comment notifikaci, deep-link do TaskDetailu projde
    //   přes single-doc subscription.
    return false;
  }

  // PROJECT_MANAGER (a fallback pro nové role) — author/assignee/sharedWithRoles.
  if (task.createdBy === currentUserUid) return true;
  if (task.assigneeUid === currentUserUid) return true;
  const roles = task.sharedWithRoles ?? [];
  return roles.includes(currentUserRole);
}


/**
 * V24 — kdo smí použít workflow akci "Hotovo" (komentář flipne status na DONE)?
 *
 * Pravidlo:
 *   - autor task vždy (přes canEditTask)
 *   - cross-OWNER (V17.1) přes canEditTask
 *   - cross-CM (V24) přes canEditTask
 *   - **CM jako assignee** na OPEN ukol/otazka — i když není autor,
 *     ukončí svůj zadaný úkol kliknutím "Hotovo"
 *
 * Ostatní kombinace (PM jako ne-autor assignee) následují klasický
 * canEditTask gate — pokud nemají edit, nemůžou změnit status.
 *
 * Pure funkce; mirror server-side `isCommentSideEffect` rule + read gate
 * + S07-specific server validation (TBD: tighter rule pro CM-only DONE flip).
 */
export interface CanCompleteAsAssigneeInput {
  task: Pick<Task, "type" | "status" | "createdBy" | "assigneeUid">;
  taskAuthorRole: UserRole | undefined;
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
}

export function canCompleteAsAssignee(input: CanCompleteAsAssigneeInput): boolean {
  const { task, currentUserUid, currentUserRole } = input;
  if (!currentUserUid || !currentUserRole) return false;
  // Active workflow jen na otazka/ukol s OPEN. Hotovo je no-op pro
  // dokumentaci/napad nebo již uzavřené tasky.
  if (task.type !== "otazka" && task.type !== "ukol") return false;
  // Status je import-time TaskStatus (V10 + legacy mix). Hotovo dává smysl
  // jen na "OPEN" — ostatní (BLOCKED, DONE, CANCELED, legacy) řeší editor.
  if (task.status !== "OPEN") return false;

  // Autor / cross-team (přes canEditTask) — má edit, smí. Krátká cesta.
  if (
    canEditTask({
      task,
      taskAuthorRole: input.taskAuthorRole,
      currentUserUid,
      currentUserRole,
    })
  ) {
    return true;
  }

  // V24 — CM-as-assignee dovětek: i bez edit může uzavřít svůj zadaný úkol.
  if (
    currentUserRole === "CONSTRUCTION_MANAGER"
    && task.assigneeUid === currentUserUid
  ) {
    return true;
  }

  return false;
}

/**
 * V24 — kdo smí flip-action (změnit assignee komentem)?
 *
 * Pravidlo: jen ten, kdo má edit (autor / cross-team). CM-as-assignee
 * NESMÍ reassignnout — má jen "Hotovo" akci. PM bez edit-rights NESMÍ
 * (defense in depth nad existujícím UI gating).
 *
 * Mirror server: `isCommentSideEffect` v rules dovoluje assigneeUid
 * change pro libovolného signed-in s read access — to je úmyslný compromise
 * pro UX simplification (recipient můžete vyrazit ball ze stránky bez
 * jiných kroků). Klient gating drží přísnější model.
 */
export function canFlipAssignee(input: CanCompleteAsAssigneeInput): boolean {
  return canEditTask({
    task: input.task,
    taskAuthorRole: input.taskAuthorRole,
    currentUserUid: input.currentUserUid,
    currentUserRole: input.currentUserRole,
  });
}
