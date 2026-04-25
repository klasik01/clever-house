import { describe, it, expect } from "vitest";
import { findAwaitingEvents, type LifecycleEvent } from "./eventLifecycle";

/**
 * V18-S09 — unit testy pro pure helper co najde UPCOMING eventy
 * s uplynulým endAt.
 */

const NOW = Date.parse("2026-05-01T12:00:00Z"); // referenční "teď"

function ev(partial: Partial<LifecycleEvent> & { id: string }): LifecycleEvent {
  return {
    id: partial.id,
    endAt: partial.endAt ?? "2026-05-01T10:00:00Z",
    status: partial.status ?? "UPCOMING",
  };
}

describe("findAwaitingEvents", () => {
  it("vrátí UPCOMING event jehož endAt je v minulosti", () => {
    const events = [ev({ id: "a", endAt: "2026-05-01T10:00:00Z" })];
    const out = findAwaitingEvents(events, NOW);
    expect(out.map((e) => e.id)).toEqual(["a"]);
  });

  it("přeskočí UPCOMING event jehož endAt je v budoucnu", () => {
    const events = [ev({ id: "future", endAt: "2026-05-01T14:00:00Z" })];
    const out = findAwaitingEvents(events, NOW);
    expect(out).toEqual([]);
  });

  it("přeskočí AWAITING_CONFIRMATION (už flipnutý)", () => {
    const events = [
      ev({
        id: "already",
        endAt: "2026-05-01T10:00:00Z",
        status: "AWAITING_CONFIRMATION",
      }),
    ];
    const out = findAwaitingEvents(events, NOW);
    expect(out).toEqual([]);
  });

  it("přeskočí HAPPENED (autor už potvrdil)", () => {
    const events = [
      ev({
        id: "done",
        endAt: "2026-05-01T10:00:00Z",
        status: "HAPPENED",
      }),
    ];
    const out = findAwaitingEvents(events, NOW);
    expect(out).toEqual([]);
  });

  it("přeskočí CANCELLED (autor zrušil)", () => {
    const events = [
      ev({
        id: "canceled",
        endAt: "2026-05-01T10:00:00Z",
        status: "CANCELLED",
      }),
    ];
    const out = findAwaitingEvents(events, NOW);
    expect(out).toEqual([]);
  });

  it("bezpečně přeskočí event s invalid endAt (ne ISO)", () => {
    const events = [ev({ id: "bad", endAt: "not a date" })];
    const out = findAwaitingEvents(events, NOW);
    expect(out).toEqual([]);
  });

  it("kombinace — vrátí jen UPCOMING+past subset", () => {
    const events = [
      ev({ id: "a", endAt: "2026-05-01T09:00:00Z" }), // past UPCOMING
      ev({ id: "b", endAt: "2026-05-01T10:00:00Z" }), // past UPCOMING
      ev({ id: "c", endAt: "2026-05-01T13:00:00Z" }), // future UPCOMING
      ev({
        id: "d",
        endAt: "2026-05-01T08:00:00Z",
        status: "HAPPENED",
      }),
      ev({
        id: "e",
        endAt: "2026-05-01T08:00:00Z",
        status: "AWAITING_CONFIRMATION",
      }),
    ];
    const out = findAwaitingEvents(events, NOW);
    expect(out.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("prázdný vstup → prázdný výstup", () => {
    expect(findAwaitingEvents([], NOW)).toEqual([]);
  });

  it("endAt přesně na now — NE (strict less than)", () => {
    // Záměrně `<` ne `<=`: event co právě skončil má ještě minutku
    // klidu než ho flipneme.
    const events = [ev({ id: "edge", endAt: "2026-05-01T12:00:00Z" })];
    const out = findAwaitingEvents(events, NOW);
    expect(out).toEqual([]);
  });
});
