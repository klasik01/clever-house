import { describe, it, expect } from "vitest";
import {
  DEFAULT_PREFS,
  NOTIFICATION_EVENTS,
  mergePrefsWithDefaults,
} from "./notifications";
import type { NotificationEventKey } from "@/types";

/**
 * V16.7 — test ujistí že klientský mirror DEFAULT_PREFS + NOTIFICATION_EVENTS
 * drží krok s CF katalogem. Nemůžeme sem import přímo z functions/ (jiný
 * balíček), takže kontrola je "každý klíč v NOTIFICATION_EVENTS má záznam
 * v DEFAULT_PREFS.events a vice versa" + přítomnost všech 8 V16 klíčů.
 */

describe("NOTIFICATION_EVENTS + DEFAULT_PREFS — mirror consistency", () => {
  const EXPECTED_KEYS: NotificationEventKey[] = [
    "mention",
    "assigned",
    "comment_on_mine",
    "comment_on_thread",
    "shared_with_pm",
    "priority_changed",         // V16.4
    "deadline_changed",         // V16.4
    "task_deleted",             // V16.6
    "assigned_with_comment",    // V17.5
    "event_invitation",         // V18-S04
    "event_rsvp_response",      // V18-S05
    "event_update",             // V18-S07
    "event_uninvited",          // V18-S07
    "event_cancelled",          // V18-S08
    "event_calendar_token_reset", // V18-S12
    "event_rsvp_reminder",      // V18-S13
  ];

  it("NOTIFICATION_EVENTS obsahuje všech 16 V18 klíčů", () => {
    expect(NOTIFICATION_EVENTS.sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it("DEFAULT_PREFS.events má entry pro každý klíč z NOTIFICATION_EVENTS", () => {
    for (const key of NOTIFICATION_EVENTS) {
      expect(DEFAULT_PREFS.events).toHaveProperty(key);
      expect(typeof DEFAULT_PREFS.events[key]).toBe("boolean");
    }
  });

  it("DEFAULT_PREFS.events nemá navíc žádný klíč nad rámec NOTIFICATION_EVENTS", () => {
    const eventKeys = Object.keys(DEFAULT_PREFS.events).sort();
    const expectedKeys = [...NOTIFICATION_EVENTS].sort();
    expect(eventKeys).toEqual(expectedKeys);
  });

  it("DEFAULT_PREFS má enabled=true + všechny eventy=true (gentle opt-out)", () => {
    expect(DEFAULT_PREFS.enabled).toBe(true);
    for (const key of NOTIFICATION_EVENTS) {
      expect(DEFAULT_PREFS.events[key]).toBe(true);
    }
  });
});

describe("mergePrefsWithDefaults", () => {
  it("undefined → clone DEFAULT_PREFS (deep — nelze mutovat přes návrat)", () => {
    const merged = mergePrefsWithDefaults(undefined);
    expect(merged).toEqual(DEFAULT_PREFS);
    merged.events.mention = false;
    expect(DEFAULT_PREFS.events.mention).toBe(true);
  });

  it("preserves a fully specified shape", () => {
    const events = Object.fromEntries(
      NOTIFICATION_EVENTS.map((k, i) => [k, i % 2 === 0]),
    ) as Record<NotificationEventKey, boolean>;
    const input = { enabled: false, events };
    expect(mergePrefsWithDefaults(input)).toEqual(input);
  });

  it("fills missing event keys from defaults + ignoruje unknown klíče", () => {
    const merged = mergePrefsWithDefaults({
      enabled: true,
      events: { mention: false, bogus_key: true },
    });
    expect(merged.events.mention).toBe(false);
    expect(Object.keys(merged.events).sort()).toEqual(
      [...NOTIFICATION_EVENTS].sort(),
    );
  });

  it("wrong-type enabled / event → default", () => {
    const merged = mergePrefsWithDefaults({
      enabled: "yes",
      events: { mention: "on", assigned: 1 },
    });
    expect(merged.enabled).toBe(true);
    expect(merged.events.mention).toBe(true);
    expect(merged.events.assigned).toBe(true);
  });

  it("non-object raw → defaults", () => {
    expect(mergePrefsWithDefaults(null)).toEqual(DEFAULT_PREFS);
    expect(mergePrefsWithDefaults("garbage")).toEqual(DEFAULT_PREFS);
    expect(mergePrefsWithDefaults(42)).toEqual(DEFAULT_PREFS);
  });
});
