import { useEffect, useMemo, useState } from "react";
import { subscribeInbox } from "@/lib/inbox";
import type { NotificationItem } from "@/types";

export interface UseInboxResult {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
}

/**
 * V15.1 — reactive subscription to the current user's inbox. Fed by
 * subscribeInbox; returns items + a derived unread count. Loading is true
 * until first snapshot arrives.
 */
export function useInbox(uid: string | null | undefined): UseInboxResult {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(uid));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeInbox(
      uid,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  const unreadCount = useMemo(
    () => items.filter((it) => !it.readAt).length,
    [items],
  );

  return { items, unreadCount, loading, error };
}
