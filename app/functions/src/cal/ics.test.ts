import { describe, it, expect } from "vitest";
import {
  buildCalendarIcs,
  escapeIcsText,
  formatDateOnly,
  formatDateOnlyPlusOneDay,
  type IcsEvent,
  type IcsUser,
} from "./ics";

/**
 * V18-S11 — multi-event ICS builder unit testy.
 */

function ev(partial: Partial<IcsEvent> & { id: string }): IcsEvent {
  return {
    id: partial.id,
    title: partial.title ?? "Schůzka",
    description: partial.description,
    startAt: partial.startAt ?? "2026-05-14T12:00:00Z",
    endAt: partial.endAt ?? "2026-05-14T13:00:00Z",
    isAllDay: partial.isAllDay ?? false,
    address: partial.address,
    inviteeUids: partial.inviteeUids ?? [],
    createdBy: partial.createdBy ?? "owner-1",
    status: partial.status ?? "UPCOMING",
  };
}

function users(entries: IcsUser[]): Map<string, IcsUser> {
  const m = new Map<string, IcsUser>();
  for (const u of entries) m.set(u.uid, u);
  return m;
}

describe("buildCalendarIcs", () => {
  it("začíná BEGIN:VCALENDAR a končí END:VCALENDAR + trailing CRLF", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a" })],
      usersByUid: users([]),
    });
    expect(out).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(out).toMatch(/END:VCALENDAR\r\n$/);
  });

  it("obsahuje správné VCALENDAR hlavičky", () => {
    const out = buildCalendarIcs({
      events: [],
      usersByUid: users([]),
    });
    expect(out).toContain("VERSION:2.0");
    expect(out).toContain("PRODID:-//Chytrý dům na vsi//Events//CS");
    expect(out).toContain("METHOD:PUBLISH");
    expect(out).toContain("CALSCALE:GREGORIAN");
    expect(out).toContain("X-WR-CALNAME:Chytrý dům");
  });

  it("vlastní calendarName override", () => {
    const out = buildCalendarIcs({
      events: [],
      usersByUid: users([]),
      calendarName: "Můj kalendář",
    });
    expect(out).toContain("X-WR-CALNAME:Můj kalendář");
  });

  it("prázdný events array → jen wrapper, žádný VEVENT", () => {
    const out = buildCalendarIcs({ events: [], usersByUid: users([]) });
    expect(out).not.toContain("BEGIN:VEVENT");
    expect(out).not.toContain("END:VEVENT");
  });

  it("renderuje multiple VEVENT bloky pro N events", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a" }), ev({ id: "b" }), ev({ id: "c" })],
      usersByUid: users([]),
    });
    const beginCount = (out.match(/BEGIN:VEVENT/g) ?? []).length;
    const endCount = (out.match(/END:VEVENT/g) ?? []).length;
    expect(beginCount).toBe(3);
    expect(endCount).toBe(3);
    expect(out).toContain("UID:a@chytrydum");
    expect(out).toContain("UID:b@chytrydum");
    expect(out).toContain("UID:c@chytrydum");
  });

  it("V18-S42 — používá UTC s Z suffixem pro ne-all-day events", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a", isAllDay: false })],
      usersByUid: users([]),
    });
    expect(out).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(out).toMatch(/DTEND:\d{8}T\d{6}Z/);
    expect(out).not.toContain("TZID=Europe/Prague");
  });

  it("používá VALUE=DATE pro all-day events", () => {
    const out = buildCalendarIcs({
      events: [
        ev({
          id: "a",
          isAllDay: true,
          startAt: "2026-05-14T00:00:00Z",
          endAt: "2026-05-14T23:59:59Z",
        }),
      ],
      usersByUid: users([]),
    });
    expect(out).toContain("DTSTART;VALUE=DATE:");
    expect(out).toContain("DTEND;VALUE=DATE:");
    expect(out).not.toContain("TZID=Europe/Prague");
  });

  it("escapuje title se středníkem/čárkou/backslashem", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a", title: "A; B, C \\ D" })],
      usersByUid: users([]),
    });
    expect(out).toContain("SUMMARY:A\\; B\\, C \\\\ D");
  });

  it("STATUS:CONFIRMED pro UPCOMING / AWAITING / HAPPENED", () => {
    for (const status of [
      "UPCOMING",
      "AWAITING_CONFIRMATION",
      "HAPPENED",
    ] as const) {
      const out = buildCalendarIcs({
        events: [ev({ id: "x", status })],
        usersByUid: users([]),
      });
      expect(out).toContain("STATUS:CONFIRMED");
      expect(out).not.toContain("STATUS:CANCELLED");
    }
  });

  it("ORGANIZER chybí pokud creator není v usersByUid", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a", createdBy: "ghost" })],
      usersByUid: users([]),
    });
    expect(out).not.toContain("ORGANIZER");
  });

  it("V18-S45 — ORGANIZER s profile name a email", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a", createdBy: "owner-1" })],
      usersByUid: users([
        { uid: "owner-1", displayName: "Stáňa", email: "st@example.com" },
      ]),
    });
    // V18-S45 — autor je v ORGANIZER, NE v ATTENDEE listu.
    expect(out).toContain("ORGANIZER;CN=Stáňa:mailto:st@example.com");
    expect(out).not.toContain("ATTENDEE;CN=Stáňa:");
  });

  it("ATTENDEE line per invitee, s fallbackem na placeholder email", () => {
    const out = buildCalendarIcs({
      events: [
        ev({
          id: "a",
          inviteeUids: ["u1", "u2-ghost"],
        }),
      ],
      usersByUid: users([
        { uid: "u1", displayName: "Marie", email: "marie@x.cz" },
      ]),
    });
    expect(out).toContain("ATTENDEE;CN=Marie:mailto:marie@x.cz");
    // ghost (bez user docu): CN fallback na placeholder uid + synth email
    expect(out).toContain("ATTENDEE;CN=u2-gho:mailto:u2-ghost@chytrydum.local");
  });

  it("V18-S24 — contactEmail (iCloud) má přednost před auth email v mailto", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a", inviteeUids: ["u1"], createdBy: "u1" })],
      usersByUid: users([
        {
          uid: "u1",
          displayName: "Stáňa",
          email: "stana.work@gmail.com",
          contactEmail: "stana@icloud.com",
        },
      ]),
    });
    // ORGANIZER + ATTENDEE oba berou contactEmail jako mailto
    expect(out).toContain("ORGANIZER;CN=Stáňa:mailto:stana@icloud.com");
    expect(out).toContain("ORGANIZER;CN=Stáňa:mailto:stana@icloud.com");
    expect(out).not.toContain("stana.work@gmail.com");
  });

  it("V18-S24 — bez contactEmail: mailto = auth email (fallback)", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a", inviteeUids: ["u1"], createdBy: "u1" })],
      usersByUid: users([
        { uid: "u1", displayName: "Marie", email: "marie@gmail.com" },
        // contactEmail nezadáno
      ]),
    });
    expect(out).toContain("ORGANIZER;CN=Marie:mailto:marie@gmail.com");
    expect(out).toContain("ORGANIZER;CN=Marie:mailto:marie@gmail.com");
  });

  it("DTSTAMP je UTC Z-suffix (generated at build time)", () => {
    const out = buildCalendarIcs({
      events: [ev({ id: "a" })],
      usersByUid: users([]),
    });
    expect(out).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });
});

describe("escapeIcsText", () => {
  it("backslash → \\\\", () => {
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
  });
  it("semicolon → \\;", () => {
    expect(escapeIcsText("a;b")).toBe("a\\;b");
  });
  it("comma → \\,", () => {
    expect(escapeIcsText("a,b")).toBe("a\\,b");
  });
  it("newline → \\n literal", () => {
    expect(escapeIcsText("a\nb")).toBe("a\\nb");
  });
});

describe("formatDateOnly", () => {
  it("vrátí YYYYMMDD z ISO", () => {
    expect(formatDateOnly("2026-05-14T12:00:00Z")).toMatch(/^20260514$/);
  });
});

describe("formatDateOnlyPlusOneDay", () => {
  it("přidá 1 den k datu (exclusive end pro all-day) — UTC stable", () => {
    // 2026-05-14 v UTC + 1 = 2026-05-15. Helper teď používá UTC parts,
    // takže výsledek je deterministický bez ohledu na lokální TZ.
    expect(formatDateOnlyPlusOneDay("2026-05-14T12:00:00Z")).toBe("20260515");
  });

  it("rollover přes konec měsíce", () => {
    expect(formatDateOnlyPlusOneDay("2026-05-31T12:00:00Z")).toBe("20260601");
  });

  it("rollover přes konec roku", () => {
    expect(formatDateOnlyPlusOneDay("2026-12-31T12:00:00Z")).toBe("20270101");
  });
});
