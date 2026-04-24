import { useEffect } from "react";

/**
 * V15.1 — syncs the OS home-screen app badge with the in-app inbox's
 * real unread count. Supersedes the V15/N-19 minimal version that just
 * cleared the badge on app-open.
 *
 * Input: unread count from useInbox. Whenever that count changes:
 *   - n > 0  → navigator.setAppBadge(n)  → red badge with number on icon
 *   - n === 0 → navigator.clearAppBadge() → icon returns to neutral
 *
 * The SW's push handler still bumps the badge to "1" when it arrives
 * while the app is closed (as a signal "something new"). On next app
 * launch, this hook overwrites it with the true unread count from
 * Firestore (source of truth). Brief stale state possible when offline;
 * corrects itself on reconnect.
 *
 * Graceful no-op on Firefox / pre-16.4 Safari where the API isn't present.
 */
export function useAppBadge(unreadCount: number): void {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!("setAppBadge" in nav) && !("clearAppBadge" in nav)) return;

    if (unreadCount > 0) {
      nav.setAppBadge?.(unreadCount).catch(() => {
        /* ignore — happens when PWA isn't standalone */
      });
    } else {
      nav.clearAppBadge?.().catch(() => {
        /* ignore */
      });
    }
  }, [unreadCount]);
}
