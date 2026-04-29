import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { resolveActorName, sendNotification } from "../notify/send";
import type { ReportDoc } from "../notify/types";

/**
 * V26 — fires when /reports/{reportId} document is created.
 *
 * Recipients: VŠICHNI signed-in v /users (workspace = small trusted group).
 * Self-filter sendNotification odfiltruje autora.
 *
 * Doručení per importance je řešeno v `catalog.ts` (jednotně push+inbox);
 * critical má navíc client-side banner při open app (V26-S07, transient,
 * žádný server state).
 */

const REGION = "europe-west1";

export const onReportCreated = onDocumentCreated(
  { document: "reports/{reportId}", region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as ReportDoc | undefined;
    if (!data) return;
    const reportId = event.params.reportId;

    const actorUid = data.createdBy;
    const actorName = await resolveActorName(actorUid);

    // Load all workspace users (5 max). Per V26 brief — broadcast all,
    // self-filter v sendNotification.
    const usersSnap = await admin.firestore().collection("users").get();
    const recipients = usersSnap.docs
      .map((d) => d.id)
      .filter((uid) => uid !== actorUid);

    if (recipients.length === 0) {
      logger.debug("site_report skip — no recipients", { reportId });
      return;
    }

    logger.info("site_report fan-out", {
      reportId,
      importance: data.importance,
      recipients: recipients.length,
    });

    const sends = recipients.map((recipientUid) =>
      sendNotification({
        eventType: "site_report_created",
        actorUid,
        actorName,
        recipientUid,
        reportId,
        report: data,
      }),
    );
    await Promise.all(sends);
  },
);
