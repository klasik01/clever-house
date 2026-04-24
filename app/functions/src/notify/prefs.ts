import type { NotificationEventKey, NotificationPrefs } from "./types";
import { buildDefaultPrefs, NOTIFICATION_EVENT_KEYS } from "./catalog";

/**
 * V16.7 — DEFAULT_PREFS je teď odvozeno z NOTIFICATION_CATALOG. Když přidáš
 * nový event type do katalogu (s defaultEnabled=true), nový uživatel ho
 * dostane automaticky v prefs bez ruční synchronizace tohoto souboru.
 */
export const DEFAULT_PREFS: NotificationPrefs = buildDefaultPrefs();

/**
 * Merge a raw value from Firestore against the defaults. Pure — každý
 * unknown key padne na default, wrong-type values se ignorují. Bezpečné
 * proti libovolným garbage datům (legacy záznamy, typo, upgrady) — trigger
 * nespadne.
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
  NOTIFICATION_EVENT_KEYS.forEach((k: NotificationEventKey) => {
    const v = rawEvents[k];
    if (typeof v === "boolean") events[k] = v;
  });

  return { enabled, events };
}
