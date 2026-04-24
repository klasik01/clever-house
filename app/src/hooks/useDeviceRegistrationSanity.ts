import { useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getOrCreateDeviceId } from "@/lib/notifications";
import { requestPermissionAndRegister } from "@/lib/messaging";

/**
 * V17.4 — pokud má uživatel `Notification.permission === "granted"` ale
 * jeho device doc v /users/{uid}/devices/{deviceId} neexistuje (sněhem
 * smazaný zombie cleanup, expirovaný FCM token, clear site data, etc.),
 * automaticky znovu vyvolá registraci.
 *
 * Scénář, který tohle opravuje:
 *   1. User povolí push (token → Firestore)
 *   2. Něco smaže device doc: ručně, migrace, zombie cleanup v send.ts po
 *      dead-token error, user clear site data
 *   3. User má stále Notification.permission === "granted", ale v reality
 *      už nic nedostane — žádný token v Firestore == žádná delivery
 *   4. Bez tohoto hooku user ani neví, a jediná cesta by byla ručně
 *      zrevokeovat + znovu povolit permissions (což je nepohodlné)
 *
 * Tento hook tiše volá `requestPermissionAndRegister` (které je idempotent:
 * na již-granted permission jen získá fresh token + zapíše device doc).
 * Běží jednou per session po mount — ne opakovaně, aby nesežrala rate limits.
 *
 * Výstup je side-effect only. Úspěch/neúspěch jen loguje — UI nic neukazuje.
 */
export function useDeviceRegistrationSanity(
  uid: string | null | undefined,
): void {
  const ranRef = useRef(false);

  useEffect(() => {
    if (!uid) return;
    if (ranRef.current) return;
    ranRef.current = true;

    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    (async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        const snap = await getDoc(doc(db, "users", uid, "devices", deviceId));
        if (snap.exists()) {
          // Device doc je OK — žádná akce potřeba.
          return;
        }
        console.info(
          "[FCM sanity] device doc chybí v Firestore ale permission=granted; " +
            "znovu registruji token...",
          { uid, deviceId },
        );
        const result = await requestPermissionAndRegister(uid);
        console.info("[FCM sanity] re-register result:", result.status);
      } catch (e) {
        console.error("[FCM sanity] check/reregister failed", e);
      }
    })();
  }, [uid]);
}
