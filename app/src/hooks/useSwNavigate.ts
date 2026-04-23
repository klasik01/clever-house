import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeSwNavigate } from "@/lib/messaging";

/**
 * V15 — bridge service-worker NAVIGATE messages into React Router.
 *
 * Background push click flow:
 *   1. User taps notification on lockscreen.
 *   2. SW's notificationclick handler (in firebase-messaging-sw.js) finds
 *      an open window and posts { type: "NAVIGATE", url } to it.
 *   3. This hook receives the message and calls router navigate(url) so
 *      the detail page opens without a full reload.
 *
 * If the app wasn't open when the push arrived, the SW falls back to
 * clients.openWindow(url) which already lands on the right URL — no
 * client-side handling needed for that path.
 *
 * Mount inside <BrowserRouter> (i.e. in ProtectedLayout or above), NOT
 * at module top level — useNavigate only works within a Router.
 */
export function useSwNavigate(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = subscribeSwNavigate((url) => {
      // Split hash so we can scroll to the anchor after the route change
      // commits. react-router v6 doesn't scroll to hash automatically.
      const [pathname, hash] = url.split("#");
      navigate(pathname || "/");
      if (hash) {
        // Defer to next tick so the destination route has a chance to
        // render and mount the target element.
        requestAnimationFrame(() => {
          const el = document.getElementById(hash);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }
    });
    return unsub;
  }, [navigate]);
}
