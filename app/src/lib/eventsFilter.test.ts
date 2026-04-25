import { describe, it, expect } from "vitest";
import {
  countAwaitingMine,
  countUpcomingForUser,
  filterEventsForUser,
  filterMyEvents,
  isPastEvent,
} from "./eventsFilter";
import type { Event } from "@/types";

const NOW = Date.parse("2026-05-01T12:00:00Z");
const H = 60 * 60 * 1000;

function ev(p: Partial<Event> & { id: string }): Event {
  return {
    id: p.id,
    title: p.title ?? "Test",
    description: p.description ?? "",
    startAt: p.startAt ?? new Date(NOW + 24 * H).toISOString(),
    endAt: p.endAt ?? new Date(NOW + 25 * H).toISOString(),
    isAllDay: p.isAllDay ?? false,
    address: p.address ?? "",
    inviteeUids: p.inviteeUids ?? [],
    createdBy: p.createdBy ?? "owner-uid",
    authorRole: p.authorRole ?? "OWNER",
    status: p.status ?? "UPCOMING",
    linkedTaskId: p.linkedTaskId ?? null,
    happenedConfirmedAt: p.happenedConfirmedAt ?? null,
    cancelledAt: p.cancelledAt ?? null,
    createdAt: p.createdAt ?? "2026-04-01T00:00:00.000Z",
    updatedAt: p.updatedAt ?? "2026-04-01T00:00:00.000Z",
    reminderSentAt: p.reminderSentAt ?? null,
  };
}

describe("filterMyEvents", () => {
  it("vrátí events kde jsem autor", () => {
    const events = [
      ev({ id: "a", createdBy: "me" }),
      ev({ id: "b", createdBy: "other" }),
    ];
    expect(filterMyEvents(events, "me").map((e) => e.id)).toEqual(["a"]);
  });

  it("vrátí events kde jsem invitee", () => {
    const events = [
      ev({ id: "a", createdBy: "other", inviteeUids: ["me", "x"] }),
      ev({ id: "b", createdBy: "other", inviteeUids: ["x"] }),
    ];
    expect(filterMyEvents(events, "me").map((e) => e.id)).toEqual(["a"]);
  });

  it("vrátí events kde jsem autor I invitee (deduplicated by id)", () => {
    const events = [ev({ id: "a", createdBy: "me", inviteeUids: ["me"] })];
    expect(filterMyEvents(events, "me")).toHaveLength(1);
  });

  it("prázdný array → []", () => {
    expect(filterMyEvents([], "me")).toEqual([]);
  });

  it("nezahrne events kde nejsem ani autor ani invitee", () => {
    const events = [
      ev({ id: "a", createdBy: "x", inviteeUids: ["y", "z"] }),
    ];
    expect(filterMyEvents(events, "me")).toEqual([]);
  });
});

describe("isPastEvent", () => {
  it("UPCOMING není past", () => {
    expect(isPastEvent(ev({ id: "a", status: "UPCOMING" }))).toBe(false);
  });

  it("AWAITING_CONFIRMATION není past (čeká na akci)", () => {
    expect(isPastEvent(ev({ id: "a", status: "AWAITING_CONFIRMATION" }))).toBe(
      false,
    );
  });

  it("HAPPENED je past", () => {
    expect(isPastEvent(ev({ id: "a", status: "HAPPENED" }))).toBe(true);
  });

  it("CANCELLED je past", () => {
    expect(isPastEvent(ev({ id: "a", status: "CANCELLED" }))).toBe(true);
  });
});

describe("filterEventsForUser", () => {
  const all = [
    ev({ id: "upcoming-mine", createdBy: "me", status: "UPCOMING" }),
    ev({ id: "awaiting-mine", createdBy: "me", status: "AWAITING_CONFIRMATION" }),
    ev({ id: "happened-mine", createdBy: "me", status: "HAPPENED" }),
    ev({ id: "cancelled-mine", createdBy: "me", status: "CANCELLED" }),
    ev({ id: "upcoming-other", createdBy: "x" }),
  ];

  it("default filter = upcoming → vrátí UPCOMING + AWAITING (mine)", () => {
    const out = filterEventsForUser(all, "me");
    expect(out.map((e) => e.id).sort()).toEqual(
      ["awaiting-mine", "upcoming-mine"],
    );
  });

  it("filter past → vrátí HAPPENED + CANCELLED (mine)", () => {
    const out = filterEventsForUser(all, "me", "past");
    expect(out.map((e) => e.id).sort()).toEqual(
      ["cancelled-mine", "happened-mine"],
    );
  });

  it("nezahrne events jiných uživatelů", () => {
    const out = filterEventsForUser(all, "me");
    expect(out.find((e) => e.id === "upcoming-other")).toBeUndefined();
  });
});

describe("countUpcomingForUser", () => {
  it("počítá UPCOMING + endAt v budoucnu", () => {
    const events = [
      ev({
        id: "a",
        createdBy: "me",
        status: "UPCOMING",
        endAt: new Date(NOW + H).toISOString(),
      }),
      ev({
        id: "b",
        createdBy: "me",
        status: "UPCOMING",
        endAt: new Date(NOW + 24 * H).toISOString(),
      }),
    ];
    expect(countUpcomingForUser(events, "me", NOW)).toBe(2);
  });

  it("nepočítá UPCOMING s prošlým endAt", () => {
    const events = [
      ev({
        id: "a",
        createdBy: "me",
        status: "UPCOMING",
        endAt: new Date(NOW - H).toISOString(),
      }),
    ];
    expect(countUpcomingForUser(events, "me", NOW)).toBe(0);
  });

  it("nepočítá AWAITING / HAPPENED / CANCELLED", () => {
    const events = [
      ev({ id: "a", createdBy: "me", status: "AWAITING_CONFIRMATION" }),
      ev({ id: "b", createdBy: "me", status: "HAPPENED" }),
      ev({ id: "c", createdBy: "me", status: "CANCELLED" }),
    ];
    expect(countUpcomingForUser(events, "me", NOW)).toBe(0);
  });

  it("nepočítá events jiných users", () => {
    const events = [
      ev({
        id: "a",
        createdBy: "x",
        status: "UPCOMING",
        endAt: new Date(NOW + H).toISOString(),
      }),
    ];
    expect(countUpcomingForUser(events, "me", NOW)).toBe(0);
  });
});

describe("countAwaitingMine", () => {
  it("počítá AWAITING_CONFIRMATION kde jsem autor", () => {
    const events = [
      ev({ id: "a", createdBy: "me", status: "AWAITING_CONFIRMATION" }),
      ev({ id: "b", createdBy: "me", status: "AWAITING_CONFIRMATION" }),
    ];
    expect(countAwaitingMine(events, "me")).toBe(2);
  });

  it("nepočítá AWAITING jiných autorů (i kdybych byl invitee)", () => {
    const events = [
      ev({
        id: "a",
        createdBy: "other",
        status: "AWAITING_CONFIRMATION",
        inviteeUids: ["me"],
      }),
    ];
    expect(countAwaitingMine(events, "me")).toBe(0);
  });

  it("nepočítá UPCOMING / HAPPENED / CANCELLED", () => {
    const events = [
      ev({ id: "a", createdBy: "me", status: "UPCOMING" }),
      ev({ id: "b", createdBy: "me", status: "HAPPENED" }),
      ev({ id: "c", createdBy: "me", status: "CANCELLED" }),
    ];
    expect(countAwaitingMine(events, "me")).toBe(0);
  });
});
