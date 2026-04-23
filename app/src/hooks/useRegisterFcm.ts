import { useEffect, useRef } from "react";
import {
  isMessagingSupported,
  requestPermissionAndRegister,
  unregisterCurrentDevice,
} from "@/lib/messaging";

/**
 * V15 — mount once (in App). Watches auth state + browser notification
 * permission and keeps the current device's FCM registration up to date:
 *
 *   - uid arrived + Notification.permission === "granted"
 *       → call requestPermissionAndRegister(uid). Idempotent — it's fine
 *         to fire every time this hook's deps change; the lib short-circuits
 *         the permission prompt if it's already granted and just refreshes
 *         the token in Firestore.
 *
 *   - uid changed to null (logout)
 *       → call unregisterCurrentDevice(previousUid). Removes the device
 *         doc so the old user doesn't keep receiving pushes on this
 *         browser.
 *
 *   - uid = null on first mount + permission !== "granted"
 *       → do nothing. The explicit permission prompt lives on a banner /
 *         Settings toggle (slice N-3) so we don't surprise users with a
 *         system dialog at page load.
 *
 * Permission request itself is NOT triggered here — only token refresh
 * after permission already exists. That keeps this hook safe to mount
 * anywhere without user-gesture concerns.
 */
export function useRegisterFcm(uid: string | null | undefined): void {
  // Remember the last uid we registered for so we can clean it up on logout.
  const lastUidRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supported = await isMessagingSupported();
      if (!supported) return;

      const current = uid ?? null;
      const prev = lastUidRef.current;

      // Logout path — previous uid present, current is null.
      if (prev && !current) {
        await unregisterCurrentDevice(prev);
        if (!cancelled) lastUidRef.current = null;
        return;
      }

      // Login / switch-user path — refresh token if permission is already
      // granted. Skip silent call if no permission yet; UI banner will
      // drive the first prompt.
      if (current) {
        if (typeof Notification === "undefined") return;
        if (Notification.permission !== "granted") {
          if (!cancelled) lastUidRef.current = current;
          return;
        }
        // Already granted — safe to getToken without a gesture.
        await requestPermissionAndRegister(current);
        if (!cancelled) lastUidRef.current = current;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);
}
