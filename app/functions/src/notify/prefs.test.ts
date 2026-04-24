import { describe, it, expect } from "vitest";
import { DEFAULT_PREFS, normalisePrefs } from "./prefs";
import { NOTIFICATION_EVENT_KEYS } from "./catalog";

/**
 * V16.7 — seznam klíčů odvozujeme z katalogu, ať test automaticky chytne
 * přidání nového event typu a donutí autora aktualizovat defaults.
 */
const EVENT_KEYS = NOTIFICATION_EVENT_KEYS;

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
    // Zkomponuj full-shape z katalogu — žádný hardcode, aby se test
    // automaticky přizpůsobil novým event typům.
    const events = Object.fromEntries(
      EVENT_KEYS.map((k, i) => [k, i % 2 === 0]),
    ) as Record<string, boolean>;
    const input = { enabled: false, events };
    expect(normalisePrefs(input)).toEqual(input);
  });

  it("fills missing event keys from defaults", () => {
    const merged = normalisePrefs({ enabled: true, events: { mention: false } });
    expect(merged.events.mention).toBe(false);
    // Každý další klíč by měl mít default hodnotu z katalogu.
    for (const key of EVENT_KEYS) {
      if (key === "mention") continue;
      expect(merged.events[key]).toBe(DEFAULT_PREFS.events[key]);
    }
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
