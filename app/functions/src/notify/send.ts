import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { renderPayload } from "./copy";
import { normalisePrefs } from "./prefs";
import type {
  NotificationDevice,
  NotificationPrefs,
  NotifyInput,
} from "./types";

/**
 * Fetch all devices registered for a user. Returns an empty array when
 * the user has no device docs (permission never granted / everyone
 * signed out / zombies cleaned).
 */
async function loadDevices(uid: string): Promise<NotificationDevice[]> {
  const snap = await admin.firestore().collection("users").doc(uid).collection("devices").get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      token: typeof data.token === "string" ? data.token : "",
      platform: (data.platform === "ios" || data.platform === "android" || data.platform === "desktop")
        ? data.platform
        : "desktop",
      userAgent: typeof data.userAgent === "string" ? data.userAgent : "",
    };
  }).filter((d) => d.token);
}

/**
 * Fetch a user's notificationPrefs (merged with defaults). Used by the
 * send pipeline to decide whether to drop before ever hitting FCM.
 */
async function loadPrefs(uid: string): Promise<NotificationPrefs> {
  const snap = await admin.firestore().collection("users").doc(uid).get();
  if (!snap.exists) return normalisePrefs(undefined);
  return normalisePrefs(snap.data()?.notificationPrefs);
}

/**
 * Sends one NotifyInput to every device a recipient has registered.
 * Respects prefs + self-notify filter. Returns the number of tokens
 * actually pushed to — useful for logging / dedupe decisions upstream.
 *
 * Zombie cleanup: per FCM response, any token that returns
 * messaging/registration-token-not-registered or /invalid-argument gets
 * its device doc deleted. Keeps the subcollection tidy without a
 * scheduled job (see N-10 in the design doc).
 */
export async function sendNotification(input: NotifyInput): Promise<number> {
  // 0) Never notify the actor about their own action.
  if (input.actorUid === input.recipientUid) {
    return 0;
  }

  // 1) Recipient's prefs — master + per-event gates.
  const prefs = await loadPrefs(input.recipientUid);
  if (!prefs.enabled) {
    logger.debug("skip: master off", { recipient: input.recipientUid });
    return 0;
  }
  if (!prefs.events[input.eventType]) {
    logger.debug("skip: event off", {
      recipient: input.recipientUid,
      event: input.eventType,
    });
    return 0;
  }

  // 2) Recipient's devices.
  const devices = await loadDevices(input.recipientUid);
  if (devices.length === 0) {
    logger.debug("skip: no devices", { recipient: input.recipientUid });
    return 0;
  }

  // 3) Build shared payload (same title/body for all recipient's devices).
  const { title, body } = renderPayload(input);
  const url = input.commentId
    ? `/t/${input.taskId}#comment-${input.commentId}`
    : `/t/${input.taskId}`;

  const tokens = devices.map((d) => d.token);
  // Data-only payload (žádný top-level `notification` field).
  //   - Proč: když máme i `notification`, FCM SDK na klientu automaticky
  //     zobrazí notifikaci v background handleru ZÁROVEŇ s naším
  //     onBackgroundMessage, co ji taky renderuje → dvojitá notifikace.
  //     Bez `notification` fieldu SDK nic neukáže samo a kontrolu má
  //     výhradně náš SW handler v firebase-messaging-sw.js.
  //   - Title/body přenesené do `data` — SW čte `payload.data.title` /
  //     `payload.data.body` a volá showNotification ručně.
  //   - Toto je standardní pattern pro "custom-rendered" web push, kde
  //     chceš plnou kontrolu nad icon/badge/tag/actions.
  const message: admin.messaging.MulticastMessage = {
    tokens,
    data: {
      title,
      body,
      url,
      eventType: input.eventType,
      taskId: input.taskId,
      ...(input.commentId ? { commentId: input.commentId } : {}),
    },
    webpush: {
      fcmOptions: { link: url },
      // Headers vynutí na APNs straně "alert" priorit — iOS jinak může
      // data-only push zahodit jako silent (nedoručit), bez ohledu na to,
      // že ho SW stejně chce ukázat.
      headers: {
        Urgency: "high",
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // 4) Cleanup stale tokens based on per-token response.
  const cleanupPromises: Promise<unknown>[] = [];
  response.responses.forEach((res, i) => {
    if (!res.success) {
      const code = res.error?.code ?? "";
      const fatal = code === "messaging/registration-token-not-registered"
        || code === "messaging/invalid-argument"
        || code === "messaging/invalid-registration-token";
      if (fatal) {
        const deviceId = devices[i].id;
        logger.info("cleanup stale device", {
          recipient: input.recipientUid,
          deviceId,
          code,
        });
        cleanupPromises.push(
          admin.firestore()
            .collection("users").doc(input.recipientUid)
            .collection("devices").doc(deviceId)
            .delete()
            .catch((err) => logger.warn("device delete failed", { deviceId, err })),
        );
      } else {
        logger.warn("send failed (transient)", {
          recipient: input.recipientUid,
          deviceId: devices[i].id,
          code,
        });
      }
    }
  });
  await Promise.all(cleanupPromises);

  logger.info("sent push", {
    event: input.eventType,
    recipient: input.recipientUid,
    successCount: response.successCount,
    failureCount: response.failureCount,
  });

  return response.successCount;
}

/** Fetch the actor's display name for rendering into copy. Cached per
 *  function invocation; different triggers don't share cache but the
 *  same trigger doesn't re-read the actor doc N times in one go. */
const actorCache = new Map<string, string>();
export async function resolveActorName(uid: string): Promise<string> {
  const hit = actorCache.get(uid);
  if (hit !== undefined) return hit;
  const snap = await admin.firestore().collection("users").doc(uid).get();
  const data = snap.data() ?? {};
  const name = (data.displayName as string | undefined)?.trim()
    || (data.email as string | undefined)?.split("@")[0]
    || uid.slice(0, 6);
  actorCache.set(uid, name);
  return name;
}

/** Find UIDs of users with role === "PROJECT_MANAGER". */
export async function resolvePmUids(): Promise<string[]> {
  const snap = await admin.firestore()
    .collection("users")
    .where("role", "==", "PROJECT_MANAGER")
    .get();
  return snap.docs.map((d) => d.id);
}
