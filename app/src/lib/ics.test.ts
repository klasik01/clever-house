import { describe, it, expect } from "vitest";
import {
  buildEventIcs,
  escapeIcsText,
  formatDateOnly,
  formatDateOnlyPlusOneDay,
  formatDateTimeUtc,
} from "./ics";
import type { Event, UserProfile } from "@/types";

function mkEvent(override: Partial<Event> = {}): Event {
  return {
    id: "evt-1",
    title: "Elektrikář — rozvaděč",
    description: "",
    startAt: "2026-05-14T12:00:00.000Z",
    endAt: "2026-05-14T14:00:00.000Z",
    isAllDay: false,
    address: "",
    inviteeUids: [],
    createdBy: "owner-uid",
    authorRole: "OWNER",
    status: "UPCOMING",
    linkedTaskId: null,
    happenedConfirmedAt: null,
    cancelledAt: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...override,
  };
}

function mkUser(uid: string, name: string, email?: string): UserProfile {
  return {
    uid,
    email: email ?? `${uid}@example.cz`,
    role: "OWNER",
    displayName: name,
  };
}

// ---------- Helpers ----------

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon, comma, newline", () => {
    expect(escapeIcsText("a;b,c")).toBe("a\\;b\\,c");
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2");
    expect(escapeIcsText("back\\slash")).toBe("back\\\\slash");
  });
  it("prázdný string prošně jak je", () => {
    expect(escapeIcsText("")).toBe("");
  });
  it("kombinované znaky", () => {
    expect(escapeIcsText("a;b,c\nd\\e")).toBe("a\\;b\\,c\\nd\\\\e");
  });
});

describe("formatDateOnly + formatDateOnlyPlusOneDay", () => {
  it("YYYYMMDD z ISO (všechny ve stejný den v libovolné TZ)", () => {
    // startAt "2026-05-14T12:00:00Z" je ve světě UTC 14.5., v
    // Europe/Prague také 14.5. (14:00 lokálního času).
    expect(formatDateOnly("2026-05-14T12:00:00.000Z")).toMatch(/^20260514$/);
  });
  it("plus one day (exclusive end)", () => {
    expect(formatDateOnlyPlusOneDay("2026-05-14T12:00:00.000Z")).toMatch(
      /^20260515$/,
    );
  });
  it("přes hranici měsíce/roku", () => {
    expect(formatDateOnlyPlusOneDay("2026-12-31T12:00:00.000Z")).toMatch(
      /^2027010[0-9]$/,
    );
  });
  it("invalid ISO → prázdný string (safe default)", () => {
    expect(formatDateOnly("not-a-date")).toBe("");
    expect(formatDateOnlyPlusOneDay("not-a-date")).toBe("");
  });
});

describe("formatDateTimeUtc (DTSTAMP format)", () => {
  it("YYYYMMDDTHHMMSSZ", () => {
    const d = new Date("2026-05-14T14:30:45.123Z");
    expect(formatDateTimeUtc(d)).toBe("20260514T143045Z");
  });
});

// ---------- buildEventIcs ----------

describe("buildEventIcs — základní struktura", () => {
  it("obsahuje VCALENDAR + VEVENT wrapper", () => {
    const ics = buildEventIcs({ event: mkEvent({ inviteeUids: ["x"] }) });
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("END:VEVENT\r\n");
  });

  it("VERSION 2.0 a PRODID ze stringu z katalogu", () => {
    const ics = buildEventIcs({ event: mkEvent() });
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Chytrý dům na vsi//Events//CS");
  });

  it("METHOD:PUBLISH (ne REQUEST) — R1 mitigation", () => {
    const ics = buildEventIcs({ event: mkEvent() });
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).not.toContain("METHOD:REQUEST");
  });

  it("CALSCALE:GREGORIAN + X-WR-CALNAME", () => {
    const ics = buildEventIcs({ event: mkEvent() });
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).toContain("X-WR-CALNAME:Chytrý dům");
  });

  it("UID = {eventId}@chytrydum", () => {
    const ics = buildEventIcs({ event: mkEvent({ id: "abc-123" }) });
    expect(ics).toContain("UID:abc-123@chytrydum");
  });

  it("SUMMARY s escaped title", () => {
    const ics = buildEventIcs({
      event: mkEvent({ title: "Test; s čárkou, a novým\nřádkem" }),
    });
    expect(ics).toContain("SUMMARY:Test\\; s čárkou\\, a novým\\nřádkem");
  });

  it("prázdný title fallback na 'Událost'", () => {
    const ics = buildEventIcs({ event: mkEvent({ title: "" }) });
    expect(ics).toContain("SUMMARY:Událost");
  });

  it("DESCRIPTION jen pokud je neprázdný", () => {
    const icsWithout = buildEventIcs({ event: mkEvent({ description: "" }) });
    expect(icsWithout).not.toContain("DESCRIPTION:");
    const icsWith = buildEventIcs({
      event: mkEvent({ description: "Nezapomenout" }),
    });
    expect(icsWith).toContain("DESCRIPTION:Nezapomenout");
  });

  it("LOCATION jen pokud je neprázdný", () => {
    const icsWithout = buildEventIcs({ event: mkEvent({ address: "" }) });
    expect(icsWithout).not.toContain("LOCATION:");
    const icsWith = buildEventIcs({
      event: mkEvent({ address: "Truhlářská 12" }),
    });
    expect(icsWith).toContain("LOCATION:Truhlářská 12");
  });
});

describe("buildEventIcs — datetime", () => {
  it("timed event má DTSTART/DTEND s TZID=Europe/Prague", () => {
    const ics = buildEventIcs({ event: mkEvent() });
    expect(ics).toMatch(/DTSTART;TZID=Europe\/Prague:\d{8}T\d{6}/);
    expect(ics).toMatch(/DTEND;TZID=Europe\/Prague:\d{8}T\d{6}/);
  });

  it("all-day event → VALUE=DATE, ne datetime", () => {
    const ics = buildEventIcs({
      event: mkEvent({
        isAllDay: true,
        startAt: "2026-06-01T00:00:00.000Z",
        endAt: "2026-06-01T23:59:00.000Z",
      }),
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260601");
    // DTEND je exclusive → +1 den
    expect(ics).toContain("DTEND;VALUE=DATE:20260602");
    expect(ics).not.toContain("TZID=Europe/Prague");
  });

  it("DTSTAMP obsahuje UTC timestamp v ICS formátu", () => {
    const ics = buildEventIcs({ event: mkEvent() });
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });
});

describe("buildEventIcs — ATTENDEE / ORGANIZER", () => {
  it("ORGANIZER pokud je creator dodán", () => {
    const ics = buildEventIcs({
      event: mkEvent(),
      creator: mkUser("owner-uid", "Stanislav", "stanislav@example.cz"),
    });
    expect(ics).toContain(
      "ORGANIZER;CN=stanislav@example.cz:mailto:stanislav@example.cz",
    );
  });

  it("žádný ORGANIZER pokud creator není dodán", () => {
    const ics = buildEventIcs({ event: mkEvent() });
    expect(ics).not.toContain("ORGANIZER");
  });

  it("ATTENDEE řádek per invitee", () => {
    const ics = buildEventIcs({
      event: mkEvent({ inviteeUids: ["u1", "u2"] }),
      inviteeUsers: new Map([
        ["u1", mkUser("u1", "Marie", "marie@example.cz")],
        ["u2", mkUser("u2", "Honza", "honza@example.cz")],
      ]),
    });
    expect(ics).toContain("ATTENDEE;CN=marie@example.cz:mailto:marie@example.cz");
    expect(ics).toContain("ATTENDEE;CN=honza@example.cz:mailto:honza@example.cz");
  });

  it("V18-S20 — CN=email (ne přezdívka) pro multi-account jednoznačnost", () => {
    const ics = buildEventIcs({
      event: mkEvent({ inviteeUids: ["u1"] }),
      inviteeUsers: new Map([
        ["u1", mkUser("u1", "Stáňa", "stanislav.kasika@gmail.com")],
      ]),
    });
    // CN MÁ být email, NE přezdívka
    expect(ics).toContain(
      "ATTENDEE;CN=stanislav.kasika@gmail.com:mailto:stanislav.kasika@gmail.com",
    );
    expect(ics).not.toContain("CN=Stáňa");
  });

  it("V18-S20 — fallback: bez emailu → CN=displayName (legacy data)", () => {
    const ics = buildEventIcs({
      event: mkEvent({ inviteeUids: ["legacy-uid"] }),
      inviteeUsers: new Map([
        ["legacy-uid", mkUser("legacy-uid", "OldUser", null)],
      ]),
    });
    // Email synthesized z uid → @chytrydum.local fallback
    expect(ics).toContain("CN=OldUser:mailto:legacy-uid@chytrydum.local");
  });
  it("ATTENDEE bez PARTSTAT (R1 mitigation — no Apple RSVP prompt)", () => {
    const ics = buildEventIcs({
      event: mkEvent({ inviteeUids: ["u1"] }),
      inviteeUsers: new Map([["u1", mkUser("u1", "M", "m@x.cz")]]),
    });
    expect(ics).not.toContain("PARTSTAT");
  });

  it("invitee bez profile → fallback uid@chytrydum.local email", () => {
    const ics = buildEventIcs({
      event: mkEvent({ inviteeUids: ["unknown-uid"] }),
      inviteeUsers: new Map(),
    });
    expect(ics).toContain("mailto:unknown-uid@chytrydum.local");
  });
});

describe("buildEventIcs — STATUS", () => {
  it("UPCOMING → CONFIRMED", () => {
    expect(buildEventIcs({ event: mkEvent({ status: "UPCOMING" }) })).toContain(
      "STATUS:CONFIRMED",
    );
  });
  it("HAPPENED → CONFIRMED", () => {
    expect(buildEventIcs({ event: mkEvent({ status: "HAPPENED" }) })).toContain(
      "STATUS:CONFIRMED",
    );
  });
  it("AWAITING_CONFIRMATION → CONFIRMED (kalendář to neví)", () => {
    expect(
      buildEventIcs({ event: mkEvent({ status: "AWAITING_CONFIRMATION" }) }),
    ).toContain("STATUS:CONFIRMED");
  });
  it("CANCELLED → CANCELLED", () => {
    expect(buildEventIcs({ event: mkEvent({ status: "CANCELLED" }) })).toContain(
      "STATUS:CANCELLED",
    );
  });
});

describe("buildEventIcs — line endings", () => {
  it("CRLF mezi řádky (RFC 5545 §3.1)", () => {
    const ics = buildEventIcs({ event: mkEvent() });
    const lines = ics.split("\r\n");
    // Poslední prvek bude prázdný (trailing CRLF); ostatní neprázdné.
    const nonEmpty = lines.filter((l) => l.length > 0);
    expect(nonEmpty.length).toBeGreaterThan(5); // VCALENDAR wrapper + VEVENT
    // Ani jeden řádek nesmí končit samotným LF (CRLF-only).
    expect(ics.split("\n").every((l, i, arr) =>
      i === arr.length - 1 || l.endsWith("\r")
    )).toBe(true);
  });
});
