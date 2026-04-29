import type { UserRole } from "@/types";

/**
 * V18-S38 — Single source of truth pro KLIENTSKÉ permission gating.
 *
 * Cíl: jedním pohledem do tohohle souboru zjistit "smí role X akci Y?"
 * bez čtení rules + UI komponent rozházených napříč codebase.
 *
 * ⚠️ Server-side authoritative rules živí v `app/deploy/firestore.rules`.
 *    Tento config je MIRROR pro klient — při změně tady **vždy** projet
 *    odpovídající rule přes `rulesAt` pointer a updatovat oba.
 *    Drift mezi configem a rules = UI ukáže klikatelné tlačítko, které
 *    rules zamítnou (špatné UX, ne security risk).
 *
 * Pro některé patterny (isCommentSideEffect diff-gate, calendar token
 * diff whitelist, schema validation `inviteeUids: list(>=1)`) je výhradní
 * domov v rules — sem nepatří, protože nejsou role-driven, ale schema-driven.
 */

/**
 * Kanonická enumerace všech role-gated akcí.
 *
 * Naming: `<resource>.<verb>[.<variant>]`. Variant používáme jen tam,
 * kde se permission liší podle podtypu (např. `task.create.napad`
 * je jen pro OWNER, `task.create.ukol` umí i PM).
 */
export type ActionKey =
  // ---------- Tasks ----------
  | "task.read"
  | "task.create.napad"
  | "task.create.otazka"
  | "task.create.ukol"
  | "task.create.dokumentace"
  | "task.edit"
  | "task.delete"
  | "task.comment"
  | "task.changeType"
  | "task.link"
  // ---------- Events ----------
  | "event.read"
  | "event.create"
  | "event.edit"
  | "event.delete"
  | "event.rsvp"
  // ---------- Taxonomy (OWNER-managed workspace data) ----------
  | "categories.manage"
  | "locations.manage"
  // ---------- Document types ----------
  | "documentTypes.manage"
  // ---------- Settings ----------
  | "settings.profile"
  | "settings.calendarToken";

/**
 * Vlastnictví záznamu — určuje, jestli akce vyžaduje autorství navíc
 * k role check.
 *
 *   - `anyone`: stačí mít roli v `roles[]` (žádný ownership constraint).
 *   - `author`: jen autor (createdBy === me). Cross-team NEMÁ.
 *   - `author-or-cross-team`: autor + (OWNER edituje OWNER-created /
 *     CM edituje CM-created). V17.1 cross-OWNER + V24 cross-CM pattern.
 *     PM je jednotlivec, cross-team mu nepomůže.
 */
/**
 * V24 — `author-or-cross-team` generalizuje cross-OWNER (V17.1) na CM:
 *   - OWNER pár (manželé) sdílí workspace → OWNER může editovat
 *     OWNER-vytvořený task / event.
 *   - CM tým ze stejné firmy → CM může editovat CM-vytvořený task / event.
 *   - PM je jednotlivec → cross-team mu nepomůže (jen autor).
 */
export type Ownership = "anyone" | "author" | "author-or-cross-team";

export interface PermissionRule {
  /** Které role v principu smí (před ownership checkem). */
  roles: UserRole[];
  /** Vlastnictví modifier. Defaultně `anyone`. */
  ownership?: Ownership;
  /** Krátký lidský popis pro auto-gen dokumentaci. */
  description: string;
  /**
   * Pointer kam mrkat v `firestore.rules` při sync auditu.
   * Reviewer při změně configu zkontroluje odpovídající rule.
   */
  rulesAt: string;
}

/**
 * Hlavní matrix. Každá ActionKey má entry s rolemi + ownership +
 * dokumentací + rulesAt pointer.
 *
 * ✏️ Při přidání role:
 *    1. Rozšiř `UserRole` union v `@/types`.
 *    2. Doplň novou roli do relevantních `roles[]` arrayů zde.
 *    3. Updatuj `firestore.rules` (pointer v rulesAt).
 *    4. Spusť `npm run docs:permissions` pro update markdown matrix.
 */
export const PERMISSIONS: Record<ActionKey, PermissionRule> = {
  // ---------- Tasks ----------
  "task.read": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description:
      "Přečíst task. OWNER+PM listing i detail (V15.2). CM má scoped gate (V24, viz canReadTaskByCm) — server vrací jen otazka/ukol vlastní/cross-CM team + sdílenou dokumentaci. Klient mirroruje přes canViewTask.",
    rulesAt: "tasks/read = canReadTask(resource.data) — isOwner() OR isProjectManager() OR (isConstructionManager() AND canReadTaskByCm(resource.data))",
  },
  "task.create.napad": {
    roles: ["OWNER"],
    description:
      "Vytvořit nápad. Jen OWNER — PM nápady neeviduje (jen na ně reaguje), CM rodinný brainstorming nikdy nevidí (V24 NDA hranice).",
    rulesAt: "tasks/create — authorRole != 'CONSTRUCTION_MANAGER' OR type in ['otazka','ukol']",
  },
  "task.create.otazka": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description: "Vytvořit otázku. Všechny role mohou klást otázky.",
    rulesAt: "tasks/create + composer allowedTypes",
  },
  "task.create.ukol": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description: "Vytvořit úkol. Všechny role mohou tvořit úkoly.",
    rulesAt: "tasks/create + composer allowedTypes",
  },
  "task.create.dokumentace": {
    roles: ["OWNER", "PROJECT_MANAGER"],
    description:
      "Vytvořit dokumentaci. OWNER i PM. CM má read-only (V24) — jen vidí sdílené dokumenty, nevytváří.",
    rulesAt: "tasks/create — authorRole != 'CONSTRUCTION_MANAGER' OR type in ['otazka','ukol']",
  },
  "task.edit": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    ownership: "author-or-cross-team",
    description:
      "Editovat task. Autor vždy. OWNER navíc edituje libovolný OWNER-created (cross-OWNER, V17.1). CM navíc edituje libovolný CM-created (cross-CM team, V24). PM jen vlastní.",
    rulesAt: "tasks/update — isTaskAuthor() OR isCrossOwnerEditable() OR isCrossCmEditable()",
  },
  "task.delete": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    ownership: "author",
    description:
      "Smazat task. Pouze autor — i cross-OWNER / cross-CM respektuje ownership pro delete.",
    rulesAt: "tasks/delete = isTaskAuthor()",
  },
  "task.comment": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description:
      "Napsat komentář. Všechny role s read access na parent task. CM nemůže komentovat napad ani nesdílenou dokumentaci (V24 — comments rule gated na canReadTask).",
    rulesAt: "comments/create gated na canReadTask(parent) + tasks/update isCommentSideEffect() + canReadTask",
  },
  "task.changeType": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    ownership: "author-or-cross-team",
    description:
      "Změnit typ tasku (otázka ↔ úkol). Mutace v místě — zachová ID, autora, komentáře. Stejný permission pattern jako task.edit (cross-OWNER + cross-CM).",
    rulesAt: "tasks/update — isTaskAuthor() OR isCrossOwnerEditable() OR isCrossCmEditable() (changeType je podmnožina edit)",
  },
  "task.link": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    ownership: "author-or-cross-team",
    description:
      "Přidat / odebrat propojení mezi otázkou/úkolem a tématem (nápadem). Vyžaduje edit právo na obě strany. CM nikdy nedosáhne na napad jako druhou stranu (canViewTask vrátí false), takže CM smí linkovat jen mezi svými otázkami/úkoly.",
    rulesAt: "tasks/update — isTaskAuthor() OR isCrossOwnerEditable() OR isCrossCmEditable() (link je podmnožina edit)",
  },

  // ---------- Events ----------
  "event.read": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description:
      "Přečíst event. Všechny role; listing filtrujeme klientsky na 'jsem invitee/autor'. Events nejsou role-restricted (V24 — CM smí vidět + tvořit).",
    rulesAt: "events/read = isSignedIn()",
  },
  "event.create": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description: "Vytvořit event s pozvánkou pro >=1 invitee. Všechny role.",
    rulesAt: "events/create — authorRole in [OWNER, PROJECT_MANAGER, CONSTRUCTION_MANAGER]",
  },
  "event.edit": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    ownership: "author-or-cross-team",
    description:
      "Editovat event. Stejný pattern jako task — autor + cross-OWNER + cross-CM team.",
    rulesAt: "events/update — isTaskAuthor() OR isCrossOwnerEditable() OR isCrossCmEditable()",
  },
  "event.delete": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    ownership: "author",
    description: "Smazat event. Jen autor (i cross-OWNER / cross-CM respektuje).",
    rulesAt: "events/delete = isTaskAuthor()",
  },
  "event.rsvp": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description:
      "Odpovědět na pozvánku (Můžu/Nemůžu). Self-write na rsvps/{userId}. Pozvánka může jít komukoli z rolí.",
    rulesAt: "events/{id}/rsvps/{userId}/write = self",
  },

  // ---------- Taxonomy (OWNER-managed workspace data) ----------
  "documentTypes.manage": {
    roles: ["OWNER"],
    description: "Spravovat typy dokumentů (admin seznam pro upload modal).",
    rulesAt: "documentTypes/write = isOwner()",
  },
  "categories.manage": {
    roles: ["OWNER"],
    description: "Spravovat kategorie (workspace-wide taxonomy).",
    rulesAt: "categories/write = isOwner()",
  },
  "locations.manage": {
    roles: ["OWNER"],
    description: "Spravovat lokace (workspace-wide taxonomy).",
    rulesAt: "locations/write = isOwner()",
  },

  // ---------- Settings ----------
  "settings.profile": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description:
      "Upravit vlastní přezdívku, contactEmail, notification prefs (diff-gate v rules). Všechny role.",
    rulesAt: "users/{uid}/update — self + diff hasOnly([whitelist])",
  },
  "settings.calendarToken": {
    roles: ["OWNER", "PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    description: "Generovat / rotovat osobní token pro webcal subscription. Všechny role.",
    rulesAt: "users/{uid}/update — self + diff hasOnly([calendarToken,…])",
  },
};

// ---------- Lookups ----------

/**
 * Plain role-only check. Pro UI gates typu "ukázat tlačítko Nový nápad".
 * Bez ownership — pokud akce má ownership constraint, použij
 * `canActOnResource()`.
 */
export function roleHas(
  action: ActionKey,
  role: UserRole | null | undefined,
): boolean {
  if (!role) return false;
  return PERMISSIONS[action].roles.includes(role);
}

export interface ResourceCtx {
  role: UserRole | null | undefined;
  uid: string | null | undefined;
  resourceCreatedBy: string;
  resourceAuthorRole: UserRole | undefined;
}

/**
 * Full check pro ownership-omezené akce (edit, delete).
 *
 * Postup:
 *   1. Vyžadujeme `uid` (signed-in). `role` může být null (profil ještě
 *      neloadlý) — autor short-circuit projde bez role check, mirror
 *      serverového `isTaskAuthor()`, který userRole() neměří.
 *   2. Pro ownership `author` / `author-or-cross-owner`: autor (uid ===
 *      createdBy) vrátí true bez role check.
 *   3. Jinak: role musí být v allowed list (`rule.roles`).
 *   4. Pak vyhodnotit zbylý ownership constraint:
 *      - `anyone`                 — true (role check už proběhl)
 *      - `author`                 — false (autor by už byl zachycen v 2)
 *      - `author-or-cross-owner`  — OWNER && OWNER-created
 */
export function canActOnResource(
  action: ActionKey,
  ctx: ResourceCtx,
): boolean {
  if (!ctx.uid) return false;
  const rule = PERMISSIONS[action];
  const ownership = rule.ownership ?? "anyone";

  // Autor short-circuit. Mirror server `isTaskAuthor()` — orthogonal
  // k roli. Pokud je akce ownership-driven a já jsem autor, smím bez
  // ohledu na to, jestli profil zatím doloadnul roli (UX edge case).
  if (
    (ownership === "author" || ownership === "author-or-cross-team") &&
    ctx.resourceCreatedBy === ctx.uid
  ) {
    return true;
  }

  if (!ctx.role || !rule.roles.includes(ctx.role)) return false;

  switch (ownership) {
    case "anyone":
      return true;
    case "author":
      // Autor větev byla výše; tady nejsem autor → false.
      return false;
    case "author-or-cross-team":
      // V17.1 cross-OWNER: OWNER edituje OWNER-created task.
      // V24 cross-CM: CM edituje CM-created task. PM — jen autor (zachycen výš).
      if (ctx.role === "OWNER" && ctx.resourceAuthorRole === "OWNER") return true;
      if (
        ctx.role === "CONSTRUCTION_MANAGER"
        && ctx.resourceAuthorRole === "CONSTRUCTION_MANAGER"
      ) return true;
      return false;
  }
}

/**
 * Helper pro use v komponentách, které mají task/event objekty:
 * `canActOn("task.edit", task, taskAuthorRole, currentUid, currentRole)`.
 *
 * Trochu sugar nad canActOnResource — ušetří caller composing ctx objektu.
 */
export function canActOn(
  action: ActionKey,
  resource: { createdBy: string; authorRole?: UserRole | undefined },
  resourceAuthorRoleResolved: UserRole | undefined,
  currentUserUid: string | null | undefined,
  currentUserRole: UserRole | null | undefined,
): boolean {
  return canActOnResource(action, {
    role: currentUserRole,
    uid: currentUserUid,
    resourceCreatedBy: resource.createdBy,
    resourceAuthorRole: resourceAuthorRoleResolved ?? resource.authorRole,
  });
}

/**
 * Pro auto-gen dokumentaci a debugging — vrátí všechny ActionKey klíče
 * v deterministickém pořadí (definition order v PERMISSIONS).
 */
export function listActions(): ActionKey[] {
  return Object.keys(PERMISSIONS) as ActionKey[];
}
