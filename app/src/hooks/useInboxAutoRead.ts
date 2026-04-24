import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { markRead } from "@/lib/inbox";
import { shouldAutoReadOnPath } from "@/lib/presence";
import type { NotificationItem } from "@/types";

/**
 * V16.9 — auto-mark-read inbox items které se vztahují k tasku, na jehož
 * detailu právě jsem. Dva vstupy:
 *
 *   - "Standard path": Firestore snapshot doručí nový unread item pro task
 *     X, já jsem právě na /t/X, tab je visible → zavolat markRead(uid, id).
 *     Uživatel tak vidí fresh thread bez blikání bellu/badge.
 *
 *   - "SW postMessage": Service Worker při onBackgroundMessage pozná focus
 *     na matching task URL a pošle `{type: "INBOX_AUTO_READ", taskId}`.
 *     Tohle pokrývá race kdy push přijde dřív než Firestore snapshot
 *     dorazí zpět na klienta — SW zná recipient-specific situaci napřed.
 *     Handler jen čeká na items stream a mark-reads relevantní záznamy.
 *
 * Self-filter: pokud uid chybí (user odhlášen), hook je no-op.
 *
 * Pokud tab není visible (minimalizovaný, na pozadí), NEDĚLÁ auto-read —
 * user to fyzicky nevidí, a bell/badge je tam právě proto, aby po návratu
 * mohl přehled vidět.
 */
export function useInboxAutoRead(
  uid: string | null | undefined,
  items: NotificationItem[],
): void {
  const location = useLocation();
  const pathname = location.pathname;
  // Keep track of what's been "seen" this session, aby hook nemrhal writy
  // pro ten samý item opakovaně (každý re-render by jinak spustil markRead).
  const seenRef = useRef<Set<string>>(new Set());

  // 1) Path-based auto-read. Reaguje na {path, items}; jakmile nový unread
  //    item dorazí a pathname matchuje, mark-read ho.
  useEffect(() => {
    if (!uid) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      // Tab v pozadí — user notifikaci fyzicky nevidí, ať mu bell/badge
      // zůstanou na pamět.
      return;
    }
    const seen = seenRef.current;
    for (const item of items) {
      if (item.readAt) continue;
      if (seen.has(item.id)) continue;
      if (!item.taskId) continue;
      if (!shouldAutoReadOnPath(pathname, item.taskId)) continue;
      seen.add(item.id);
      markRead(uid, item.id).catch((e) => {
        console.error("auto-read failed", e);
        // Vrátit item mimo seen, ať se příště pokusí znovu.
        seen.delete(item.id);
      });
    }
  }, [uid, pathname, items]);

  // 2) SW postMessage pipe. Samostatný subscribe, žádná závislost na items
  //    (handler si je vyčte v handleru přes items argument v closure).
  useEffect(() => {
    if (!uid) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "INBOX_AUTO_READ") return;
      const taskId = typeof data.taskId === "string" ? data.taskId : null;
      if (!taskId) return;
      // Ověř že jsem na detailu relevantního tasku — ochrana proti race
      // (SW stihl odeslat když uživatel mezitím navigoval jinam).
      if (!shouldAutoReadOnPath(pathname, taskId)) return;

      const seen = seenRef.current;
      for (const item of items) {
        if (item.readAt) continue;
        if (item.taskId !== taskId) continue;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        markRead(uid!, item.id).catch((e) => {
          console.error("auto-read (SW path) failed", e);
          seen.delete(item.id);
        });
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [uid, pathname, items]);
}
