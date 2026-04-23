import type { NotificationEventKey, NotificationPrefs } from "./types";

/**
 * Defaults for users without a notificationPrefs field. Mirrors the
 * client-side default in app/src/lib/notifications.ts — both sides must
 * agree on the "new account" behaviour or fresh users get inconsistent
 * treatment.
 */
export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  events: {
    mention: true,
    assigned: true,
    comment_on_mine: true,
    comment_on_thread: true,
    shared_with_pm: true,
  },
};

/**
 * Merge a raw value from Firestore against the defaults. Pure — every
 * unknown key falls back to default, wrong-type values are ignored. Safe
 * to feed arbitrary garbage data (legacy records, typos, upgrades) in
 * without crashing the trigger.
 */
export function normalisePrefs(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== "object") {
    return { enabled: DEFAULT_PREFS.enabled, events: { ...DEFAULT_PREFS.events } };
  }
  const r = raw as { enabled?: unknown; events?: unknown };
  const enabled = typeof r.enabled === "boolean" ? r.enabled : DEFAULT_PREFS.enabled;

  const rawEvents = (r.events && typeof r.events === "object")
    ? (r.events as Record<string, unknown>)
    : {};
  const events = { ...DEFAULT_PREFS.events };
  (Object.keys(events) as NotificationEventKey[]).forEach((k) => {
    const v = rawEvents[k];
    if (typeof v === "boolean") events[k] = v;
  });

  return { enabled, events };
}
