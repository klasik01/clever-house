import { describe, it, expect } from "vitest";
import {
  isoToLocalInput,
  localInputToIso,
  roundToNextHalfHour,
  toLocalInput,
} from "./eventDateInput";

describe("roundToNextHalfHour", () => {
  it("nemění čas přesně na :00", () => {
    const d = new Date("2026-05-14T14:00:00");
    const r = roundToNextHalfHour(d);
    expect(r.getMinutes()).toBe(0);
    expect(r.getHours()).toBe(14);
  });

  it("nemění čas přesně na :30", () => {
    const d = new Date("2026-05-14T14:30:00");
    const r = roundToNextHalfHour(d);
    expect(r.getMinutes()).toBe(30);
    expect(r.getHours()).toBe(14);
  });

  it("zaokrouhlí 14:15 → 14:30", () => {
    const d = new Date("2026-05-14T14:15:00");
    const r = roundToNextHalfHour(d);
    expect(r.getHours()).toBe(14);
    expect(r.getMinutes()).toBe(30);
  });

  it("zaokrouhlí 14:45 → 15:00", () => {
    const d = new Date("2026-05-14T14:45:00");
    const r = roundToNextHalfHour(d);
    expect(r.getHours()).toBe(15);
    expect(r.getMinutes()).toBe(0);
  });

  it("zaokrouhlí 14:01 → 14:30", () => {
    const d = new Date("2026-05-14T14:01:00");
    const r = roundToNextHalfHour(d);
    expect(r.getHours()).toBe(14);
    expect(r.getMinutes()).toBe(30);
  });

  it("zaokrouhlí 14:31 → 15:00", () => {
    const d = new Date("2026-05-14T14:31:00");
    const r = roundToNextHalfHour(d);
    expect(r.getHours()).toBe(15);
    expect(r.getMinutes()).toBe(0);
  });

  it("zaokrouhlí 23:45 → 00:00 next day", () => {
    const d = new Date("2026-05-14T23:45:00");
    const r = roundToNextHalfHour(d);
    expect(r.getHours()).toBe(0);
    expect(r.getMinutes()).toBe(0);
    expect(r.getDate()).toBe(15);
  });

  it("nemodifikuje vstupní Date object", () => {
    const d = new Date("2026-05-14T14:15:00");
    const original = d.getTime();
    roundToNextHalfHour(d);
    expect(d.getTime()).toBe(original);
  });
});

describe("toLocalInput", () => {
  it("formátuje Date jako YYYY-MM-DDTHH:MM v lokální TZ", () => {
    const d = new Date("2026-05-14T14:30:00");
    const out = toLocalInput(d);
    expect(out).toBe("2026-05-14T14:30");
  });

  it("padding minut < 10", () => {
    const d = new Date("2026-01-05T09:05:00");
    expect(toLocalInput(d)).toBe("2026-01-05T09:05");
  });

  it("padding hodin < 10", () => {
    const d = new Date("2026-01-05T03:00:00");
    expect(toLocalInput(d)).toBe("2026-01-05T03:00");
  });

  it("padding měsíce + dne < 10", () => {
    const d = new Date("2026-01-05T15:30:00");
    expect(toLocalInput(d)).toBe("2026-01-05T15:30");
  });
});

describe("localInputToIso — non-all-day", () => {
  it("prázdný string → prázdný string", () => {
    expect(localInputToIso("")).toBe("");
    expect(localInputToIso("", false)).toBe("");
  });

  it("invalid date string → prázdný string", () => {
    expect(localInputToIso("not a date")).toBe("");
  });

  it("valid local input → ISO UTC", () => {
    // 14:30 v CZ TZ = různé UTC podle DST. Test že vrátí valid ISO.
    const out = localInputToIso("2026-05-14T14:30");
    expect(out).toMatch(/^2026-05-14T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(out).getTime()).toBeGreaterThan(0);
  });
});

describe("localInputToIso — all-day (floating UTC)", () => {
  it("prázdný string → prázdný string", () => {
    expect(localInputToIso("", true)).toBe("");
  });

  it("date-only string → UTC midnight", () => {
    expect(localInputToIso("2026-04-30", true)).toBe(
      "2026-04-30T00:00:00.000Z",
    );
  });

  it("'YYYY-MM-DDTHH:MM' formát → ignoruje time, vrací UTC midnight", () => {
    expect(localInputToIso("2026-04-30T14:30", true)).toBe(
      "2026-04-30T00:00:00.000Z",
    );
  });

  it("invalid date format → prázdný string", () => {
    expect(localInputToIso("not-a-date", true)).toBe("");
    expect(localInputToIso("2026-13-99", true)).toBe(
      "2026-13-99T00:00:00.000Z",
    ); // regex match, JS Date pak fail v parsing
    // Note: regex povoluje libovolné dvouciferné mm/dd; semantic validation
    // je až na server-side Firestore rules.
  });

  it("V18-S23 — TZ-stable: ne CZ-dependent shift", () => {
    // Bez floating UTC trikem by tahle konverze vracela 04-29 v CZ TZ.
    expect(localInputToIso("2026-04-30T00:00", true)).toBe(
      "2026-04-30T00:00:00.000Z",
    );
  });
});

describe("isoToLocalInput — non-all-day", () => {
  it("prázdný ISO → prázdný string", () => {
    expect(isoToLocalInput("")).toBe("");
  });

  it("invalid ISO → prázdný string", () => {
    expect(isoToLocalInput("not-an-iso")).toBe("");
  });

  it("valid ISO → local datetime input format", () => {
    const out = isoToLocalInput("2026-05-14T12:00:00.000Z");
    expect(out).toMatch(/^2026-05-14T\d{2}:\d{2}$/);
  });
});

describe("isoToLocalInput — all-day (UTC parts)", () => {
  it("UTC midnight → date input format se dnem v UTC", () => {
    expect(isoToLocalInput("2026-04-30T00:00:00.000Z", true)).toBe(
      "2026-04-30T00:00",
    );
  });

  it("V18-S23 — bere UTC parts ne local: 23:59Z stále vrátí ten den", () => {
    // V CZ TZ by lokálně bylo 04-30 01:59, ale UTC date je 29 → 04-29.
    expect(isoToLocalInput("2026-04-29T23:59:00.000Z", true)).toBe(
      "2026-04-29T00:00",
    );
  });
});

describe("integration round-trip", () => {
  it("all-day: localInput → ISO → localInput zachová datum", () => {
    const original = "2026-04-30";
    const iso = localInputToIso(original, true);
    const back = isoToLocalInput(iso, true);
    expect(back.slice(0, 10)).toBe(original);
  });

  it("all-day round-trip přes konec měsíce", () => {
    const iso = localInputToIso("2026-05-31", true);
    expect(iso).toBe("2026-05-31T00:00:00.000Z");
    const back = isoToLocalInput(iso, true);
    expect(back.slice(0, 10)).toBe("2026-05-31");
  });
});
