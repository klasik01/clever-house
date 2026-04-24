import type { NotificationEventKey } from "./types";
import { eventPriorityList } from "./catalog";

/**
 * V16.7 — EVENT_PRIORITY je teď derivováno z NOTIFICATION_CATALOG.
 * Pořadí odpovídá dedupePriority (ascending). Soubor zůstává kvůli
 * buildRecipientMap funkci, která je v mnoha místech hluboko v pipeline.
 */

/** Priority list pro dedupe. Lower index wins když user spadne do víc
 *  event buckets pro jeden comment. Single source of truth: catalog.ts. */
export const EVENT_PRIORITY: NotificationEventKey[] = eventPriorityList();

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
