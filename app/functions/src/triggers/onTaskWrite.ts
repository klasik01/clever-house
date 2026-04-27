import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { resolveActorName, resolvePmUids, sendNotification } from "../notify/send";
import { protistrana } from "../notify/protistrana";
import { isCommentBatchUpdate } from "../notify/commentFlip";
import type { NotificationEventKey, TaskDoc } from "../notify/types";

/**
 * V15/N-7 — fires when a task is updated. Two event types travel through
 * this single trigger:
 *
 *   - assigneeUid changed   → push "assigned" to the new assignee.
 *   - sharedWithRoles changed → push "shared_with_pm" to newly added role members.
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

    // On create: sharedWithRoles non-empty on a napad → ping role members.
    if (after.type === "napad" && Array.isArray(after.sharedWithRoles) && after.sharedWithRoles.length > 0) {
      await fanOutShareToRoles(taskId, after, after.sharedWithRoles);
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

    // V17.5 — pokud je tento update součástí comment batch (createComment +
    //   updateTask v jednom writeBatch), přeskočit notifikaci assigneeUid
    //   change. onCommentCreate pozná flip přes priorAssigneeUid na comment
    //   docu a pošle "assigned_with_comment" místo dvou notifikací.
    //
    //   Detekce v notify/commentFlip.ts:isCommentBatchUpdate (testovaná).
    const isCommentBatch = isCommentBatchUpdate({
      beforeCommentCount: (before as unknown as { commentCount?: number }).commentCount,
      afterCommentCount: (after as unknown as { commentCount?: number }).commentCount,
    });
    if (isCommentBatch) {
      logger.debug(
        "skip task-update notifications — comment batch, onCommentCreate handles it",
        { taskId },
      );
      // Sdílení s rolemi je stále relevantní i když se bylo v batch (teoreticky
      //   by se nestalo — sharedWithRoles se nedá flipnout z comment composeru,
      //   ale pro jistotu stále ověřuji). Ostatní eventy přeskočit.
      if (after.type === "napad") {
        const added = newlyAddedRoles(before.sharedWithRoles, after.sharedWithRoles);
        if (added.length > 0) {
          await fanOutShareToRoles(taskId, after, added);
        }
      }
      return;
    }

    // V15/V16.4 — actor detekci nemáme přímou (Firestore nenese kdo doc
    //   updatoval). Jediná cesta by byla zapisovat `updatedBy` z klientu a
    //   to nepokryje Admin-side patches. Fallback: task.createdBy. V praxi
    //   tasky edituje hlavně autor sám (OWNER), občas PM na vlastních
    //   úkolech. Self-filter v sendNotification stejně zabrání falešným
    //   pushe.
    const actorUid = after.createdBy;

    // 1) Assignee change — excluding the special case where it was
    //    simply null → same person (no actual flip).
    if ((before.assigneeUid ?? null) !== (after.assigneeUid ?? null)) {
      const newAssignee = after.assigneeUid ?? null;
      if (newAssignee && newAssignee !== before.assigneeUid) {
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

    // 2) sharedWithRoles — role added to sharing list on a napad.
    if (after.type === "napad") {
      const added = newlyAddedRoles(before.sharedWithRoles, after.sharedWithRoles);
      if (added.length > 0) {
        await fanOutShareToRoles(taskId, after, added);
      }
    }

    // 3) V16.4 — priority change (pošle se jen když je task assignutý).
    if ((before.priority ?? null) !== (after.priority ?? null)) {
      await notifyScalarChange({
        eventType: "priority_changed",
        actorUid,
        after,
        taskId,
      });
    }

    // 4) V16.4 — deadline change.
    if ((before.deadline ?? null) !== (after.deadline ?? null)) {
      await notifyScalarChange({
        eventType: "deadline_changed",
        actorUid,
        after,
        taskId,
      });
    }
  },
);

/**
 * V16.4 — společný flow pro "scalar field" změny (priority, deadline).
 * Rozhoduje o recipientovi přes protistrana() — nikdy actor, jen ten druhý
 * účastník (autor nebo assignee). Pokud task nemá assignee, žádná notifikace.
 */
async function notifyScalarChange(args: {
  eventType: NotificationEventKey;
  actorUid: string;
  after: TaskDoc;
  taskId: string;
}): Promise<void> {
  const recipientUid = protistrana({
    actorUid: args.actorUid,
    createdBy: args.after.createdBy,
    assigneeUid: args.after.assigneeUid,
  });
  if (!recipientUid) {
    logger.debug("scalar change skip — no assignee or only self in the loop", {
      taskId: args.taskId,
      event: args.eventType,
    });
    return;
  }
  const actorName = await resolveActorName(args.actorUid);
  await sendNotification({
    eventType: args.eventType,
    actorUid: args.actorUid,
    actorName,
    recipientUid,
    taskId: args.taskId,
    task: args.after,
  });
}

/** V19 — detect roles that were added (present in after but not in before). */
function newlyAddedRoles(
  before: string[] | undefined,
  after: string[] | undefined,
): string[] {
  const prev = new Set(Array.isArray(before) ? before : []);
  const curr = Array.isArray(after) ? after : [];
  return curr.filter((r) => !prev.has(r));
}

async function fanOutShareToRoles(taskId: string, task: TaskDoc, roles: string[]): Promise<void> {
  // Currently only PM fan-out is implemented; extendable for future roles.
  if (!roles.includes("PROJECT_MANAGER")) {
    logger.debug("no PM in newly shared roles; skip", { taskId, roles });
    return;
  }
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
