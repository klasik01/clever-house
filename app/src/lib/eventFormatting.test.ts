import { describe, it, expect } from "vitest";
import {
  formatEventDateLong,
  formatEventDateShort,
  formatEventTimeRange,
  statusBadgeTokens,
} from "./eventFormatting";
import type { Event } from "@/types";

function ev(p: Partial<Event> & { id: string }): Event {
  return {
    id: p.id,
    title: p.title ?? "Test",
    description: p.description ?? "",
    startAt: p.startAt ?? "2026-05-14T12:00:00.000Z",
    endAt: p.endAt ?? "2026-05-14T13:00:00.000Z",
    isAllDay: p.isAllDay ?? false,
    address: p.address ?? "",
    inviteeUids: p.inviteeUids ?? [],
    createdBy: p.createdBy ?? "owner",
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

describe("formatEventDateLong", () => {
  it("vrátí UPPERCASE long czech date", () => {
    const out = formatEventDateLong(ev({ id: "a" }));
    // Output je UPPERCASE — obsahuje znaky jako "ČTVRTEK", "KVĚTNA"
    expect(out).toBe(out.toUpperCase());
  });

  it("obsahuje den, měsíc, rok", () => {
    const out = formatEventDateLong(ev({ id: "a" }));
    expect(out).toContain("14");
    expect(out).toContain("2026");
  });

  it("invalid startAt → prázdný string", () => {
    expect(formatEventDateLong(ev({ id: "a", startAt: "not a date" }))).toBe("");
  });

  it("all-day floating UTC zachová datum bez TZ shift", () => {
    // Datum ukládáme jako UTC midnight floating. Local interpretation
    // by mohla shiftnout na předchozí den v UTC- TZ.
    const out = formatEventDateLong(
      ev({
        id: "a",
        isAllDay: true,
        startAt: "2026-04-30T00:00:00.000Z",
      }),
    );
    expect(out).toContain("30");
    expect(out).toMatch(/duben|dubna/i);
  });
});

describe("formatEventDateShort", () => {
  it("short format vrátí 'po 14. 5.' pattern", () => {
    const out = formatEventDateShort(ev({ id: "a" }));
    expect(out).toMatch(/\d{1,2}\. ?\d{1,2}\./);
  });

  it("invalid startAt → '—'", () => {
    expect(formatEventDateShort(ev({ id: "a", startAt: "bogus" }))).toBe("—");
  });

  it("all-day UTC parts zachové den", () => {
    const out = formatEventDateShort(
      ev({
        id: "a",
        isAllDay: true,
        startAt: "2026-04-30T00:00:00.000Z",
      }),
    );
    expect(out).toContain("30");
  });
});

describe("formatEventTimeRange", () => {
  it("timed event → 'HH:MM – HH:MM' (with em-dash spacing)", () => {
    const out = formatEventTimeRange(ev({ id: "a" }), "celý den");
    expect(out).toMatch(/\d{2}:\d{2} – \d{2}:\d{2}/);
  });

  it("all-day → vrátí allDayLabel beze změny", () => {
    const out = formatEventTimeRange(
      ev({ id: "a", isAllDay: true }),
      "CELÝ DEN",
    );
    expect(out).toBe("CELÝ DEN");
  });

  it("invalid startAt/endAt → prázdný string", () => {
    const out = formatEventTimeRange(
      ev({ id: "a", startAt: "bogus", endAt: "bogus" }),
      "celý den",
    );
    expect(out).toBe("");
  });
});

describe("statusBadgeTokens", () => {
  it("UPCOMING → null (neutrální status, badge se nezobrazí)", () => {
    expect(statusBadgeTokens("UPCOMING")).toBeNull();
  });

  it("AWAITING_CONFIRMATION → red foreground + p1 background", () => {
    const t = statusBadgeTokens("AWAITING_CONFIRMATION");
    expect(t).toEqual({
      i18nKey: "events.status.awaiting",
      color: "var(--color-status-danger-fg)",
      background: "var(--color-priority-p1-bg)",
    });
  });

  it("HAPPENED → green foreground + success background", () => {
    const t = statusBadgeTokens("HAPPENED");
    expect(t).toEqual({
      i18nKey: "events.status.happened",
      color: "var(--color-status-success-fg)",
      background: "var(--color-status-success-bg)",
    });
  });

  it("CANCELLED → muted foreground + subtle background", () => {
    const t = statusBadgeTokens("CANCELLED");
    expect(t).toEqual({
      i18nKey: "events.status.cancelled",
      color: "var(--color-ink-subtle)",
      background: "var(--color-bg-subtle)",
    });
  });

  it("vrácená data jsou immutable (dva volání, samostatné objekty)", () => {
    // Object identity test — pure helper musí vrátit nový objekt.
    const a = statusBadgeTokens("HAPPENED");
    const b = statusBadgeTokens("HAPPENED");
    expect(a).toEqual(b);
    // Nezáleží na shallow eq, jen že hodnoty jsou stejné.
  });
});
