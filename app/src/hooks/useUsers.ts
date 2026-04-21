import { useEffect, useState } from "react";
import { subscribeUsers } from "@/lib/userProfile";
import type { UserProfile } from "@/types";

interface UsersState {
  users: UserProfile[];
  byUid: Map<string, UserProfile>;
  loading: boolean;
  error: Error | null;
}

/**
 * Realtime list of workspace users. Cached in-memory via Firebase SDK listener.
 * Provides a `byUid` Map for O(1) lookups (comment author, assignee, mentions).
 */
export function useUsers(enabled: boolean): UsersState {
  const [state, setState] = useState<UsersState>({
    users: [],
    byUid: new Map(),
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ users: [], byUid: new Map(), loading: false, error: null });
      return;
    }
    const unsub = subscribeUsers(
      (users) => {
        const byUid = new Map(users.map((u) => [u.uid, u]));
        setState({ users, byUid, loading: false, error: null });
      },
      (error) => setState((prev) => ({ ...prev, loading: false, error }))
    );
    return unsub;
  }, [enabled]);

  return state;
}
