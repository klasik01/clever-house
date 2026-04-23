import { describe, it, expect } from "vitest";
import { DEFAULT_PREFS, normalisePrefs } from "./prefs";
import type { NotificationEventKey } from "./types";

const EVENT_KEYS: NotificationEventKey[] = [
  "mention",
  "assigned",
  "comment_on_mine",
  "comment_on_thread",
  "shared_with_pm",
];

describe("DEFAULT_PREFS", () => {
  it("has every event key set to true", () => {
    for (const key of EVENT_KEYS) {
      expect(DEFAULT_PREFS.events[key]).toBe(true);
    }
  });
  it("has master enabled true", () => {
    expect(DEFAULT_PREFS.enabled).toBe(true);
  });
});

describe("normalisePrefs", () => {
  it("returns a cloned default when input is undefined / null / non-object", () => {
    const a = normalisePrefs(undefined);
    const b = normalisePrefs(null);
    const c = normalisePrefs("garbage");
    expect(a).toEqual(DEFAULT_PREFS);
    expect(b).toEqual(DEFAULT_PREFS);
    expect(c).toEqual(DEFAULT_PREFS);
    // Ensure the default isn't mutated by a caller tweaking the result.
    a.events.mention = false;
    expect(DEFAULT_PREFS.events.mention).toBe(true);
  });

  it("preserves a fully specified shape", () => {
    const input = {
      enabled: false,
      events: {
        mention: false,
        assigned: true,
        comment_on_mine: true,
        comment_on_thread: false,
        shared_with_pm: false,
      },
    };
    expect(normalisePrefs(input)).toEqual(input);
  });

  it("fills missing event keys from defaults", () => {
    const merged = normalisePrefs({ enabled: true, events: { mention: false } });
    expect(merged.events.mention).toBe(false);
    expect(merged.events.assigned).toBe(true);
    expect(merged.events.comment_on_mine).toBe(true);
    expect(merged.events.comment_on_thread).toBe(true);
    expect(merged.events.shared_with_pm).toBe(true);
  });

  it("ignores unknown event keys", () => {
    const merged = normalisePrefs({
      enabled: true,
      events: { mention: false, ghost: true, unrelated: false },
    });
    expect(Object.keys(merged.events).sort()).toEqual([...EVENT_KEYS].sort());
  });

  it("treats wrong types as missing and falls back", () => {
    const merged = normalisePrefs({
      enabled: "yes please",
      events: { mention: 0, assigned: "on" },
    });
    expect(merged.enabled).toBe(true);
    expect(merged.events.mention).toBe(true);
    expect(merged.events.assigned).toBe(true);
  });
});
