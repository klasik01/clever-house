import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { resolveActorName, resolvePmUids, sendNotification } from "../notify/send";
import type { TaskDoc } from "../notify/types";

/**
 * V15/N-7 — fires when a task is updated. Two event types travel through
 * this single trigger:
 *
 *   - assigneeUid changed   → push "assigned" to the new assignee.
 *   - sharedWithPm flipped  → push "shared_with_pm" to every PM.
 *
 * We use update + create triggers (create covers "new task with assignee
 * already set"). The assignee-changed logic cross-references `before` and
 * `after`; for the create case `before` is undefined so we notify when
 * `after.assigneeUid` is set and isn't the creator (they don't need to
 * tell themselves).
 *
 * "Actor" of the change is the latest editor. Firestore doesn't carry
 * authorship metadata on writes, so we use task.createdBy on create and
 * — for updates where we can't know — fall back to a generic "Někdo".
 * In practice updates come from the creator 99% of the time (they're the
 * ones editing their own task), so treating createdBy as the actor is a
 * safe approximation. We filter self-notifications inside sendNotification.
 */

const REGION = "europe-west1";

export const onTaskCreated = onDocumentCreated(
  { document: "tasks/{taskId}", region: REGION },
  async (event) => {
    const after = event.data?.data() as TaskDoc | undefined;
    if (!after) return;
    const taskId = event.params.taskId;

    // On create: assigneeUid present + != creator → notify.
    if (after.assigneeUid && after.assigneeUid !== after.createdBy) {
      const actorName = await resolveActorName(after.createdBy);
      await sendNotification({
        eventType: "assigned",
        actorUid: after.createdBy,
        actorName,
        recipientUid: after.assigneeUid,
        taskId,
        task: after,
      });
    }

    // On create: sharedWithPm already true on a napad → ping PMs.
    if (after.type === "napad" && after.sharedWithPm === true) {
      await fanOutShareToPm(taskId, after);
    }
  },
);

export const onTaskUpdated = onDocumentUpdated(
  { document: "tasks/{taskId}", region: REGION },
  async (event) => {
    const before = event.data?.before.data() as TaskDoc | undefined;
    const after = event.data?.after.data() as TaskDoc | undefined;
    if (!before || !after) return;
    const taskId = event.params.taskId;

    // 1) Assignee change — excluding the special case where it was
    //    simply null → same person (no actual flip).
    if ((before.assigneeUid ?? null) !== (after.assigneeUid ?? null)) {
      const newAssignee = after.assigneeUid ?? null;
      if (newAssignee && newAssignee !== before.assigneeUid) {
        // Actor is whoever edited this task — not reliably known from
        // the change alone. Fall back to task creator (the common case).
        const actorUid = after.createdBy;
        const actorName = await resolveActorName(actorUid);
        await sendNotification({
          eventType: "assigned",
          actorUid,
          actorName,
          recipientUid: newAssignee,
          taskId,
          task: after,
        });
      }
    }

    // 2) sharedWithPm flip false → true on a napad.
    if (
      after.type === "napad"
      && before.sharedWithPm !== true
      && after.sharedWithPm === true
    ) {
      await fanOutShareToPm(taskId, after);
    }
  },
);

async function fanOutShareToPm(taskId: string, task: TaskDoc): Promise<void> {
  const pmUids = await resolvePmUids();
  if (pmUids.length === 0) {
    logger.info("no PMs configured; skip shared_with_pm", { taskId });
    return;
  }
  const actorName = await resolveActorName(task.createdBy);
  await Promise.all(
    pmUids.map((recipientUid) =>
      sendNotification({
        eventType: "shared_with_pm",
        actorUid: task.createdBy,
        actorName,
        recipientUid,
        taskId,
        task,
      }),
    ),
  );
}
