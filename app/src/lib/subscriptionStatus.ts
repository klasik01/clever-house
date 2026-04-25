/**
 * V18-S25 — heuristic detekce zda user má aktivní Apple Calendar
 * subscription pro webcal feed. Vychází z `calendarLastFetchedAt` co
 * CF zapisuje throttled při každém HTTP GET.
 *
 * Pravidla:
 *   - undefined / null → "unknown" (nevíme, user možná nikdy nezapojil)
 *   - last fetch ≤ 25h zpátky → "active" (Apple Calendar fetchuje 15min-1h
 *     default, 25h je generous buffer pro slabé connectivity)
 *   - jinak → "stale" (kdysi byl, teď nefetchuje — možná unsubscribed
 *     nebo offline)
 *
 * Pure funkce, žádný side effect.
 */

import { CALENDAR_SUBSCRIPTION_ACTIVE_WINDOW_MS } from "./limits";

const ACTIVE_WINDOW_MS = CALENDAR_SUBSCRIPTION_ACTIVE_WINDOW_MS;

export type SubscriptionStatus = "unknown" | "active" | "stale";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  lastFetchedAt: string | null;
  /** Minutes since last fetch. null pokud unknown. */
  staleMinutes: number | null;
}

export function subscriptionStatus(
  lastFetchedAt: string | undefined | null,
  nowMs: number = Date.now(),
): SubscriptionInfo {
  if (!lastFetchedAt || typeof lastFetchedAt !== "string") {
    return { status: "unknown", lastFetchedAt: null, staleMinutes: null };
  }
  const t = Date.parse(lastFetchedAt);
  if (Number.isNaN(t)) {
    return { status: "unknown", lastFetchedAt: null, staleMinutes: null };
  }
  const ageMs = nowMs - t;
  const staleMinutes = Math.floor(ageMs / 60000);
  if (ageMs <= ACTIVE_WINDOW_MS) {
    return { status: "active", lastFetchedAt, staleMinutes };
  }
  return { status: "stale", lastFetchedAt, staleMinutes };
}
