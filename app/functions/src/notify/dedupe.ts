import type { NotificationEventKey } from "./types";

/**
 * Priority list for dedupe. Lower index wins when a single user falls
 * into multiple event buckets for the same comment (e.g. they're both
 * the task creator AND @mentioned — they get `mention`, not two pushes).
 *
 * Keep in sync with the UI copy in i18n (cs.json) and the discovery doc.
 */
export const EVENT_PRIORITY: NotificationEventKey[] = [
  "mention",
  "assigned",
  "comment_on_mine",
  "comment_on_thread",
  "shared_with_pm",
];

export interface RecipientSources {
  /** The user whose action triggered this. Never notified (self-filter). */
  actorUid: string;
  /** UIDs explicitly @mentioned in the comment body. */
  mentionedUids: string[];
  /** Task creator — always eligible for comment_on_mine. Can be empty. */
  taskCreatorUid: string | null | undefined;
  /** Distinct authors of older comments in the thread. */
  priorCommenterUids: string[];
}

/**
 * Build a Map<recipientUid, NotificationEventKey> where each user is
 * assigned the single highest-priority event they qualify for. Applies
 * the self-filter up front — actor never appears in the result.
 *
 * Pure function — no Firestore, no side effects. Trivially unit-testable.
 */
export function buildRecipientMap(
  sources: RecipientSources,
): Map<string, NotificationEventKey> {
  const map = new Map<string, NotificationEventKey>();

  const maybeSet = (uid: string | null | undefined, event: NotificationEventKey) => {
    if (!uid) return;
    if (uid === sources.actorUid) return;
    const current = map.get(uid);
    if (!current) {
      map.set(uid, event);
      return;
    }
    const currentIdx = EVENT_PRIORITY.indexOf(current);
    const nextIdx = EVENT_PRIORITY.indexOf(event);
    if (nextIdx < currentIdx) {
      map.set(uid, event);
    }
  };

  for (const uid of sources.mentionedUids) {
    maybeSet(uid, "mention");
  }
  maybeSet(sources.taskCreatorUid ?? null, "comment_on_mine");
  for (const uid of sources.priorCommenterUids) {
    maybeSet(uid, "comment_on_thread");
  }

  return map;
}
