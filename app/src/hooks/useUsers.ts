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
 * V18-S29 — localStorage cache pro instant render přezdívek po reload.
 *
 * Bez cache: po reloadu komponenty (komenty, invitee list, attendee list,
 * notif inbox) zobrazují uid hash → ~200-500ms čekání na Firestore
 * snapshot → překreslení na přezdívku. Visuální flash pro každého user.
 *
 * S cache: hodnotu z předchozí session přečteme synchronně v useState
 * initializer → render od začátku obsahuje přezdívky. Firestore snapshot
 * pak hodnoty aktualizuje (změny v přezdívce, contact email atd.).
 *
 * TTL 1 hodina — pokud snapshot do 1h dorazí, refreshne data; jinak při
 * dalším otevření aplikace cache zahodíme a začínáme znova s "loading"
 * (žádný stale obsah).
 */
const STORAGE_KEY = "users:cache:v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

interface CachedUsers {
  ts: number;
  users: UserProfile[];
}

function readCache(): UserProfile[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUsers;
    if (
      !parsed ||
      typeof parsed.ts !== "number" ||
      !Array.isArray(parsed.users)
    ) {
      return null;
    }
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.users;
  } catch {
    return null;
  }
}

function writeCache(users: UserProfile[]): void {
  try {
    const payload: CachedUsers = { ts: Date.now(), users };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — ignore */
  }
}

/**
 * Realtime list of workspace users. Cached:
 *   - in-memory via Firebase SDK listener (drives realtime updates)
 *   - in localStorage via writeCache() po každém snapshot
 * Provides `byUid` Map for O(1) lookups.
 */
export function useUsers(enabled: boolean): UsersState {
  const [state, setState] = useState<UsersState>(() => {
    // Synchronous lazy init — pokud máme valid cache, render od začátku
    // s přezdívkami. `loading: true` zachováno aby caller pořád věděl
    // že čekáme na fresh snapshot (cache je just optimistic hint).
    const cached = enabled ? readCache() : null;
    if (cached && cached.length > 0) {
      const byUid = new Map(cached.map((u) => [u.uid, u]));
      return { users: cached, byUid, loading: true, error: null };
    }
    return { users: [], byUid: new Map(), loading: true, error: null };
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
        // Persist pro další session.
        writeCache(users);
      },
      (error) => setState((prev) => ({ ...prev, loading: false, error })),
    );
    return unsub;
  }, [enabled]);

  return state;
}
