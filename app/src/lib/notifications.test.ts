import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import {
  DEFAULT_PREFS,
  NOTIFICATION_EVENTS,
  getOrCreateDeviceId,
  mergePrefsWithDefaults,
} from "./notifications";
import type { NotificationPrefs } from "@/types";

describe("mergePrefsWithDefaults", () => {
  it("returns a cloned default set for undefined/null input", () => {
    const a = mergePrefsWithDefaults(undefined);
    const b = mergePrefsWithDefaults(null);
    expect(a).toEqual(DEFAULT_PREFS);
    expect(b).toEqual(DEFAULT_PREFS);
    // Must be a clone — mutating the result shouldn't leak into defaults.
    a.events.mention = false;
    expect(DEFAULT_PREFS.events.mention).toBe(true);
  });

  it("keeps a fully-specified value intact", () => {
    const input: NotificationPrefs = {
      enabled: false,
      events: {
        mention: false,
        assigned: true,
        comment_on_mine: false,
        comment_on_thread: true,
        shared_with_pm: false,
      },
    };
    expect(mergePrefsWithDefaults(input)).toEqual(input);
  });

  it("fills missing event keys from defaults", () => {
    const input = { enabled: true, events: { mention: false } };
    const merged = mergePrefsWithDefaults(input);
    expect(merged.enabled).toBe(true);
    expect(merged.events.mention).toBe(false);
    // Unmentioned keys stay at default (true).
    expect(merged.events.assigned).toBe(true);
    expect(merged.events.comment_on_mine).toBe(true);
  });

  it("ignores unknown event keys in the input", () => {
    const merged = mergePrefsWithDefaults({
      enabled: true,
      events: { mention: false, ghost_event: true, lunar_eclipse: false },
    });
    for (const key of NOTIFICATION_EVENTS) {
      expect(merged.events).toHaveProperty(key);
    }
    // No extra keys leaked.
    expect(Object.keys(merged.events).sort()).toEqual([...NOTIFICATION_EVENTS].sort());
  });

  it("falls back on missing enabled → default", () => {
    const merged = mergePrefsWithDefaults({ events: { mention: false } });
    expect(merged.enabled).toBe(DEFAULT_PREFS.enabled);
  });

  it("falls back when a per-event value has wrong type", () => {
    const merged = mergePrefsWithDefaults({
      enabled: true,
      events: { mention: "yes please", assigned: 0 },
    });
    expect(merged.events.mention).toBe(true); // default
    expect(merged.events.assigned).toBe(true); // default
  });
});

describe("getOrCreateDeviceId", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* jsdom */ }
  });

  it("mints a new id the first time, then returns the same id on subsequent calls", () => {
    const first = getOrCreateDeviceId();
    expect(first.length).toBeGreaterThanOrEqual(8);
    const second = getOrCreateDeviceId();
    expect(second).toBe(first);
  });

  it("returns a fresh id after localStorage clear", () => {
    const a = getOrCreateDeviceId();
    localStorage.clear();
    const b = getOrCreateDeviceId();
    expect(b).not.toBe(a);
  });
});
