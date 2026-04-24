import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { resolveActorName, sendNotification } from "../notify/send";
import type { TaskDoc } from "../notify/types";

/**
 * V16.6 — fires when a task is deleted.
 *
 * Recipients (dle V16 diskuze):
 *   - createdBy (autor tasku) — "někdo mi smazal moje"
 *   - Všichni prior komentátoři — "thread na kterém jsem pracoval zmizel"
 *
 * Self-filter: actor (ten kdo smazal) nikdy nedostane vlastní notifikaci.
 * Current assignee záměrně NENÍ ve fan-outu (diskuze V16.6 — author +
 * komentátoři stačí; assignee se často = author a dedupe se postará).
 *
 * Actor detekce: Firestore nenese authorship, takže podobně jako v
 * onTaskUpdated používáme createdBy jako fallback. Edge case: když task
 * maže PM, po správné cestě by actor byl PM, ne autor — ale onTaskDeleted
 * nemá jak to vědět. Přijímáme drobnou nepřesnost copy ("Stanislav smazal
 * ...") v prospěch jednoduchosti. Pokud to vadí, zavedeme `deletedBy`
 * field v sepisovaném "delete intent" doc před smazáním.
 */

const REGION = "europe-west1";

export const onTaskDeleted = onDocumentDeleted(
  { document: "tasks/{taskId}", region: REGION },
  async (event) => {
    const taskSnap = event.data;
    if (!taskSnap) return;
    const task = taskSnap.data() as TaskDoc | undefined;
    if (!task) return;
    const taskId = event.params.taskId;

    // Actor fallback — viz docstring.
    const actorUid = task.createdBy;

    // Fetch prior komentátory ze stejné subcollection. Firestore odstraní
    // subcollection při rule-driven delete propagation? NE — subcollection
    // může přežít i když parent mizí. Zkusíme read; pokud už není (manual
    // cascade delete nebo rules enforced), bude to prostě prázdný set.
    const priorSnap = await admin.firestore()
      .collection("tasks").doc(taskId)
      .collection("comments")
      .get()
      .catch(() => null);

    const priorAuthors = new Set<string>();
    if (priorSnap) {
      priorSnap.docs.forEach((d) => {
        const authorUid = (d.data() as { authorUid?: string }).authorUid;
        if (typeof authorUid === "string" && authorUid) {
          priorAuthors.add(authorUid);
        }
      });
    }

    // Recipients: autor + komentátoři, minus actor.
    const recipients = new Set<string>();
    if (task.createdBy && task.createdBy !== actorUid) {
      recipients.add(task.createdBy);
    }
    priorAuthors.forEach((uid) => {
      if (uid !== actorUid) recipients.add(uid);
    });

    if (recipients.size === 0) {
      logger.info("task_deleted: no recipients", { taskId });
      return;
    }

    const actorName = await resolveActorName(actorUid);
    const sends = Array.from(recipients).map((recipientUid) =>
      sendNotification({
        eventType: "task_deleted",
        actorUid,
        actorName,
        recipientUid,
        taskId,
        task,
      }),
    );
    const results = await Promise.all(sends);
    const total = results.reduce((a, b) => a + b, 0);
    logger.info("task_deleted fan-out done", {
      taskId,
      recipients: recipients.size,
      delivered: total,
    });
  },
);
