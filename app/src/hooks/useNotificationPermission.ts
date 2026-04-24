import { useEffect, useState } from "react";
import { isMessagingSupported } from "@/lib/messaging";

export type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

/**
 * V15 — reactive browser notification permission state.
 *
 * The `Notification.permission` property doesn't fire events when it
 * changes, so this hook re-reads it whenever the page becomes visible.
 * That catches the common flow "user went into iOS Settings, flipped the
 * app's permission, came back" without needing a manual refresh.
 *
 * Returns "unsupported" when the browser/device can't receive push at
 * all (no Notification API, no service worker, old iOS Safari without
 * PWA install). Callers can treat "unsupported" as "hide the UI and
 * don't offer anything".
 */
export function useNotificationPermission(): NotificationPermissionState {
  const [state, setState] = useState<NotificationPermissionState>("default");

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const supported = await isMessagingSupported();
      if (cancelled) return;
      if (!supported) {
        setState("unsupported");
        return;
      }
      if (typeof Notification === "undefined") {
        setState("unsupported");
        return;
      }
      setState(Notification.permission as NotificationPermissionState);
    }

    void refresh();

    // Reactive update přes Permissions API — nejsilnější cesta jak zachytit,
    // že uživatel flipnul prompt ("granted"/"denied") bez toho, aby musel
    // refresh stránku. Funguje v Chrome/Edge/Firefox; Safari macOS to taky
    // podporuje. iOS PWA nemá Permissions API, tam spadneme zpět na
    // visibilitychange (uživatel se vrátí z iOS Settings → fire refresh).
    type PermStatus = { state: NotificationPermission; onchange: (() => void) | null };
    let permStatusRef: PermStatus | null = null;
    if (navigator.permissions && typeof navigator.permissions.query === "function") {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          permStatusRef = status as unknown as PermStatus;
          permStatusRef.onchange = () => {
            void refresh();
          };
        })
        .catch(() => {
          /* Permissions API nedostupná — visibilitychange fallback řeší zbytek. */
        });
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      if (permStatusRef) permStatusRef.onchange = null;
    };
  }, []);

  return state;
}
