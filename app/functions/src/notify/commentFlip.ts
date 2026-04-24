import type { NotificationEventKey } from "./types";

/**
 * V17.5 — detekce "comment zároveň flipuje assignee" a přepis recipient mapy.
 *
 * Když je comment.priorAssigneeUid != comment.assigneeAfter, znamená to,
 * že autor komentáře zároveň přehodil task na jiného uživatele. Nový
 * assignee nesmí dostat duplicitní notifikace (comment_on_* z fan-outu +
 * assigned z onTaskUpdated triggeru) — nahradíme jeho event v mapě za
 * "assigned_with_comment", co má nejvyšší dedupe prioritu.
 *
 * Pure funkce — mutuje mapu na místě (pohodlné ve flow) a vrací uid
 * merge-target pro logging, nebo null pokud nebyla změna potřeba.
 */

export interface FlipContext {
  priorAssigneeUid: string | null | undefined;
  assigneeAfter: string | null | undefined;
  /** Actor = autor komentáře. Nikdy nedostane vlastní notifikaci. */
  actorUid: string;
}

export function applyAssignedWithCommentOverride(
  recipients: Map<string, NotificationEventKey>,
  ctx: FlipContext,
): string | null {
  const prior = ctx.priorAssigneeUid ?? null;
  const after = ctx.assigneeAfter ?? null;
  if (prior === after) return null; // no flip
  if (!after) return null; // unassignment — neposíláme speciální event
  if (after === ctx.actorUid) return null; // self-assign (actor se přiřadil sám)
  recipients.set(after, "assigned_with_comment");
  return after;
}

/**
 * V17.5 — detekce že update tasku je součástí comment batch (createComment
 * + updateTask v writeBatch). onTaskUpdated skipne notifikace protože
 * onCommentCreate je pokryje přes applyAssignedWithCommentOverride.
 *
 * Heuristika: batch commentu vždy inkrementuje commentCount. Jiné updaty
 * (changing priority, deadline, sharedWithPm) commentCount nemění.
 */
export interface CommentBatchInput {
  beforeCommentCount: number | null | undefined;
  afterCommentCount: number | null | undefined;
}

export function isCommentBatchUpdate(input: CommentBatchInput): boolean {
  const before = input.beforeCommentCount ?? 0;
  const after = input.afterCommentCount ?? 0;
  return after > before;
}
