/**
 * V18-S12 — detekce reset tokenu pro webcal subscription.
 *
 * Když se `calendarTokenRotatedAt` změní (user kliknul Reset v Settings),
 * pošleme sebesi self-notifikaci `event_calendar_token_reset` — druhé
 * zařízení user dostává potvrzení "Kalendář token resetován" a může
 * v Settings zkopírovat novou URL.
 *
 * Self-filter v sendNotification je pro tento event vypnut díky
 * katalogovému flagu `allowSelf: true`.
 *
 * Ne-notifiable změny `/users/{uid}` (displayName, notificationPrefs,
 * devices registrace jsou v subcollection) se neřeší — skipneme.
 */
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { sendNotification, resolveActorName } from "../notify/send";

const REGION = "europe-west1";

interface UserDoc {
  calendarToken?: string;
  calendarTokenRotatedAt?: string;
}

export const onUserUpdated = onDocumentUpdated(
  { document: "users/{uid}", region: REGION },
  async (event) => {
    const before = event.data?.before.data() as UserDoc | undefined;
    const after = event.data?.after.data() as UserDoc | undefined;
    if (!before || !after) return;
    const uid = event.params.uid;

    // Detekce reset tokenu: rotovaný timestamp se změnil a před tím
    // už existoval (ne první lazy ensure — tam je before undefined /
    // empty). Rozeznáváme přes `before.calendarToken`.
    const beforeToken = typeof before.calendarToken === "string"
      ? before.calendarToken
      : "";
    const afterToken = typeof after.calendarToken === "string"
      ? after.calendarToken
      : "";
    const beforeRotated = before.calendarTokenRotatedAt;
    const afterRotated = after.calendarTokenRotatedAt;

    const isFirstGeneration = beforeToken.length === 0 && afterToken.length > 0;
    const isReset =
      beforeToken.length > 0 &&
      afterToken.length > 0 &&
      beforeToken !== afterToken &&
      beforeRotated !== afterRotated;

    if (!isReset) {
      if (isFirstGeneration) {
        logger.debug("onUserUpdated — first calendarToken (no notifikace)", {
          uid,
        });
      }
      return;
    }

    const actorName = await resolveActorName(uid);
    await sendNotification({
      eventType: "event_calendar_token_reset",
      actorUid: uid,
      actorName,
      recipientUid: uid,
    });
    logger.info("event_calendar_token_reset fired", { uid });
  },
);
