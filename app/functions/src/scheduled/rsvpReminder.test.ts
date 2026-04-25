import { describe, it, expect } from "vitest";
import {
  findEventsNeedingReminder,
  type ReminderEvent,
} from "./rsvpReminder";

/**
 * V18-S13 — unit testy pro pure helper. "now" bereme fix ať testy jsou
 * deterministické.
 */

const NOW = Date.parse("2026-05-01T12:00:00Z");
const H = 60 * 60 * 1000;

function ev(p: Partial<ReminderEvent> & { id: string }): ReminderEvent {
  return {
    id: p.id,
    startAt: p.startAt ?? new Date(NOW + 24 * H).toISOString(),
    status: p.status ?? "UPCOMING",
    reminderSentAt: p.reminderSentAt ?? null,
  };
}

describe("findEventsNeedingReminder", () => {
  it("chytí UPCOMING event přesně 24h před startem", () => {
    const events = [ev({ id: "a", startAt: new Date(NOW + 24 * H).toISOString() })];
    expect(findEventsNeedingReminder(events, NOW).map((e) => e.id)).toEqual(["a"]);
  });

  it("chytí event 23h před startem (dolní hranice okna)", () => {
    const events = [ev({ id: "a", startAt: new Date(NOW + 23 * H).toISOString() })];
    expect(findEventsNeedingReminder(events, NOW).map((e) => e.id)).toEqual(["a"]);
  });

  it("chytí event 25h před startem (horní hranice okna)", () => {
    const events = [ev({ id: "a", startAt: new Date(NOW + 25 * H).toISOString() })];
    expect(findEventsNeedingReminder(events, NOW).map((e) => e.id)).toEqual(["a"]);
  });

  it("NEchytí event 22h před startem (příliš blízko)", () => {
    const events = [ev({ id: "a", startAt: new Date(NOW + 22 * H).toISOString() })];
    expect(findEventsNeedingReminder(events, NOW)).toEqual([]);
  });

  it("NEchytí event 26h před startem (příliš daleko)", () => {
    const events = [ev({ id: "a", startAt: new Date(NOW + 26 * H).toISOString() })];
    expect(findEventsNeedingReminder(events, NOW)).toEqual([]);
  });

  it("skipne event s reminderSentAt nastaveným (dedupe)", () => {
    const events = [
      ev({
        id: "a",
        startAt: new Date(NOW + 24 * H).toISOString(),
        reminderSentAt: "2026-04-30T13:00:00Z",
      }),
    ];
    expect(findEventsNeedingReminder(events, NOW)).toEqual([]);
  });

  it("skipne AWAITING_CONFIRMATION (už prošel)", () => {
    const events = [
      ev({
        id: "a",
        startAt: new Date(NOW + 24 * H).toISOString(),
        status: "AWAITING_CONFIRMATION",
      }),
    ];
    expect(findEventsNeedingReminder(events, NOW)).toEqual([]);
  });

  it("skipne CANCELLED", () => {
    const events = [
      ev({
        id: "a",
        startAt: new Date(NOW + 24 * H).toISOString(),
        status: "CANCELLED",
      }),
    ];
    expect(findEventsNeedingReminder(events, NOW)).toEqual([]);
  });

  it("skipne HAPPENED", () => {
    const events = [
      ev({
        id: "a",
        startAt: new Date(NOW + 24 * H).toISOString(),
        status: "HAPPENED",
      }),
    ];
    expect(findEventsNeedingReminder(events, NOW)).toEqual([]);
  });

  it("skipne past event (startAt v minulosti)", () => {
    const events = [
      ev({ id: "a", startAt: new Date(NOW - 24 * H).toISOString() }),
    ];
    expect(findEventsNeedingReminder(events, NOW)).toEqual([]);
  });

  it("skipne event s invalid startAt", () => {
    const events = [ev({ id: "a", startAt: "not a date" })];
    expect(findEventsNeedingReminder(events, NOW)).toEqual([]);
  });

  it("mixed array vrátí jen eligible", () => {
    const events = [
      ev({ id: "match", startAt: new Date(NOW + 24 * H).toISOString() }),
      ev({
        id: "already-sent",
        startAt: new Date(NOW + 24 * H).toISOString(),
        reminderSentAt: "2026-04-30T13:00:00Z",
      }),
      ev({
        id: "too-close",
        startAt: new Date(NOW + 2 * H).toISOString(),
      }),
      ev({
        id: "cancelled",
        startAt: new Date(NOW + 24 * H).toISOString(),
        status: "CANCELLED",
      }),
    ];
    expect(findEventsNeedingReminder(events, NOW).map((e) => e.id)).toEqual([
      "match",
    ]);
  });

  it("prázdný vstup → prázdný výstup", () => {
    expect(findEventsNeedingReminder([], NOW)).toEqual([]);
  });
});
