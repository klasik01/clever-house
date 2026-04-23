import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { resolveActorName, sendNotification } from "../notify/send";
import type {
  CommentDoc,
  NotificationEventKey,
  NotifyInput,
  TaskDoc,
} from "../notify/types";

/**
 * V15/N-8 — fires on every new comment under a task and fans out push
 * notifications to everyone with a stake in the thread.
 *
 * Recipient derivation (in priority order — first wins per user):
 *   1. `mention`            — explicit @mention in the comment body
 *                             (comment.mentionedUids).
 *   2. `comment_on_mine`    — the task creator (task.createdBy) when they
 *                             aren't the comment author.
 *   3. `comment_on_thread`  — anyone who previously commented in the
 *                             thread (distinct authorUids of older
 *                             comments), excluding the current author.
 *
 * The priority keeps us from blasting a user with three pushes for a
 * single comment: if the task creator is also mentioned AND has commented
 * before, they get one `mention` push, not three. Per-user prefs and the
 * self-notify filter still apply inside sendNotification.
 */

const REGION = "europe-west1";

/** Priority-ordered list of event keys for dedupe. Lower index = higher
 *  priority. Matches the comment in DISCOVERY.md; duplicated here to keep
 *  functions independent of the app's client-side module. */
const EVENT_PRIORITY: NotificationEventKey[] = [
  "mention",
  "comment_on_mine",
  "comment_on_thread",
];

export const onCommentCreate = onDocumentCreated(
  {
    document: "tasks/{taskId}/comments/{commentId}",
    region: REGION,
  },
  async (event) => {
    const commentSnap = event.data;
    if (!commentSnap) return;
    const comment = commentSnap.data() as CommentDoc | undefined;
    if (!comment) return;

    const taskId = event.params.taskId;
    const commentId = event.params.commentId;
    const actorUid = comment.authorUid;
    if (!actorUid) {
      logger.warn("comment missing authorUid, skipping", { taskId, commentId });
      return;
    }

    // 1) Fetch the parent task — we need its title + createdBy for routing.
    const taskRef = admin.firestore().collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
      logger.warn("parent task missing, skipping", { taskId, commentId });
      return;
    }
    const task = taskSnap.data() as TaskDoc;

    // 2) Derive recipients + their winning event.
    //    We build a Map<recipientUid, NotificationEventKey> where we only
    //    overwrite if the new event has higher priority than what's there.
    const recipients = new Map<string, NotificationEventKey>();
    const maybeSet = (uid: string | undefined, event: NotificationEventKey) => {
      if (!uid) return;
      if (uid === actorUid) return; // redundant with self-filter below, but
                                    // saves a Firestore read per skip
      const current = recipients.get(uid);
      if (!current) {
        recipients.set(uid, event);
        return;
      }
      // Keep the higher-priority event (lower index in EVENT_PRIORITY).
      const currentIdx = EVENT_PRIORITY.indexOf(current);
      const nextIdx = EVENT_PRIORITY.indexOf(event);
      if (nextIdx < currentIdx) {
        recipients.set(uid, event);
      }
    };

    // 2a) mentions — highest priority.
    for (const uid of comment.mentionedUids ?? []) {
      maybeSet(uid, "mention");
    }

    // 2b) task creator → comment_on_mine.
    if (task.createdBy) {
      maybeSet(task.createdBy, "comment_on_mine");
    }

    // 2c) prior commenters → comment_on_thread.
    //     Pull the whole thread and skip the just-created comment in
    //     memory. Threads are small (low tens on a house-build log) so
    //     paging isn't worth the complexity. Using `!=` on documentId
    //     in the query layer can hit index quirks depending on project
    //     setup — client-side filter is safer + equivalent cost here.
    const priorSnap = await taskRef.collection("comments").get();
    const priorAuthors = new Set<string>();
    priorSnap.docs.forEach((d) => {
      if (d.id === commentId) return;
      const authorUid = (d.data() as { authorUid?: string }).authorUid;
      if (typeof authorUid === "string" && authorUid) {
        priorAuthors.add(authorUid);
      }
    });
    priorAuthors.forEach((uid) => maybeSet(uid, "comment_on_thread"));

    if (recipients.size === 0) {
      logger.debug("no recipients after dedupe", { taskId, commentId });
      return;
    }

    // 3) Fan out sends. One call per recipient — sendNotification handles
    //    prefs, device lookup, multicast, and zombie cleanup internally.
    const actorName = await resolveActorName(actorUid);
    const sends: Promise<number>[] = [];
    recipients.forEach((eventType, recipientUid) => {
      const input: NotifyInput = {
        eventType,
        actorUid,
        actorName,
        recipientUid,
        taskId,
        task,
        commentId,
        comment,
      };
      sends.push(sendNotification(input));
    });

    const sentCounts = await Promise.all(sends);
    const totalSent = sentCounts.reduce((a, b) => a + b, 0);
    logger.info("comment fan-out done", {
      taskId,
      commentId,
      recipients: recipients.size,
      delivered: totalSent,
    });
  },
);
