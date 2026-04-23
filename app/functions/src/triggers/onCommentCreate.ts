import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { buildRecipientMap } from "../notify/dedupe";
import { resolveActorName, sendNotification } from "../notify/send";
import type {
  CommentDoc,
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

    // 2) Pull prior commenter uids (distinct authors of older comments).
    //    Uses a full scan + client-side skip: threads are small (<100
    //    comments on a house-build log) and `!=` on documentId in the
    //    query layer has index quirks that aren't worth debugging.
    const priorSnap = await taskRef.collection("comments").get();
    const priorAuthors = new Set<string>();
    priorSnap.docs.forEach((d) => {
      if (d.id === commentId) return;
      const authorUid = (d.data() as { authorUid?: string }).authorUid;
      if (typeof authorUid === "string" && authorUid) {
        priorAuthors.add(authorUid);
      }
    });

    // 3) Derive the final recipient map (pure function — unit tested).
    const recipients = buildRecipientMap({
      actorUid,
      mentionedUids: comment.mentionedUids ?? [],
      taskCreatorUid: task.createdBy,
      priorCommenterUids: Array.from(priorAuthors),
    });

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
