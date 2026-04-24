import { useEffect } from "react";

/**
 * V15/N-19 — clears the OS-level app badge (red dot on home-screen icon)
 * whenever the PWA becomes visible. Pairs with the SW setAppBadge(1) call
 * in firebase-messaging-sw.js — push increments the badge, opening the app
 * clears it.
 *
 * Web Badging API: https://developer.mozilla.org/en-US/docs/Web/API/Badging_API
 * Support matrix (as of iOS 26.3 / April 2026):
 *   - iOS 16.4+ Safari PWA (standalone mode) ✓
 *   - Chrome desktop / Android PWA ✓
 *   - macOS Safari installed PWA ✓
 *   - Firefox ✗ (gracefully no-op)
 *
 * The hook is a no-op on unsupported browsers.
 */
export function useAppBadge(): void {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("clearAppBadge" in navigator)) return;

    function clear() {
      const n = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
      n.clearAppBadge?.().catch(() => {
        /* Safari občas odmítne když PWA není v standalone mode — safe to ignore */
      });
    }

    // Clear on mount (app just opened).
    clear();

    // Clear when tab becomes visible again (e.g. user swiped to PWA from
    // another app). Used in addition to mount because a long-lived session
    // could accumulate badges while backgrounded.
    function onVisibility() {
      if (document.visibilityState === "visible") clear();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);
}
