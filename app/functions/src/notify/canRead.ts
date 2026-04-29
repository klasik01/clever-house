/**
 * V24 — pure helper pro recipient-side read scope check.
 *
 * Mirror klientského `canViewTask` + serverového `canReadTaskByCm` v rules.
 * Notification pipeline (send.ts) ho volá před push/inbox write — pokud
 * recipient nemá read access na zdrojový task, notifikaci skipneme.
 *
 * Bez pure-helper testu (catalog tests pokrývají recipient logiku v
 * triggerech). Drift mezi tímto helperem a `firestore.rules` /
 * `lib/permissions.canViewTask` = silent bug (CM dostane push o tasku,
 * který nemá v rules dostupný; deep-link mu pak vyhodí permission denied).
 *
 * Cross-CM "assignee role is CM" clause z firestore.rules NENÍ
 * implementovaný — server rule by to povolila, ale klientský mirror
 * (canViewTask) ten case taky nepokrývá. Pro V1 přijatelný kompromis —
 * CM-B nedostane push o tasku assigned to CM-A, vidí ho jen přes
 * mention/comment na něj přímo směrované.
 */
import type { TaskDoc } from "./types";

export interface CanReadCtx {
  /** Recipient's role. Pokud "OWNER" | "PROJECT_MANAGER" → broad access. */
  role: "OWNER" | "PROJECT_MANAGER" | "CONSTRUCTION_MANAGER" | undefined;
  /** Recipient's uid. */
  uid: string;
}

export function canReadTaskForRecipient(
  task: TaskDoc | undefined,
  ctx: CanReadCtx,
): boolean {
  // Event-scope notifikace nemají task — vždy průchozí. Event read scope
  // (events/read = isSignedIn()) je pro všechny role otevřený.
  if (!task) return true;
  // OWNER + PM mají plný read access.
  if (ctx.role === "OWNER" || ctx.role === "PROJECT_MANAGER") return true;
  // Bez resolved role — nedoručujeme (bez rolí by user neměl mít fungující
  // app session; typicky onUserCreated trigger ještě neproběhl). Pro
  // notifikační pipeline raději konzervativně přeskočit.
  if (ctx.role !== "CONSTRUCTION_MANAGER") return false;

  // CM scope: napad nikdy. dokumentace přes sharedWithRoles. otazka/ukol
  // přes vlastnictví / cross-CM team.
  if (task.type === "napad") return false;
  if (task.type === "dokumentace") {
    const roles = Array.isArray(task.sharedWithRoles) ? task.sharedWithRoles : [];
    return roles.includes("CONSTRUCTION_MANAGER");
  }
  // otazka / ukol
  if (task.assigneeUid === ctx.uid) return true;
  if (task.createdBy === ctx.uid) return true;
  if (task.authorRole === "CONSTRUCTION_MANAGER") return true;
  return false;
}

/** Načti recipient role z Firestore. Cached per invocation pro
 *  optimalizaci v fan-out triggerech, kde se ten samý recipient vyskytuje
 *  vícekrát. Na cold start dva extra reads jsou zanedbatelné. */
