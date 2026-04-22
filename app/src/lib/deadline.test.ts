import { describe, it, expect } from "vitest";
import {
  dateInputToEpochMs,
  epochMsToDateInput,
  deadlineState,
  formatCountdownKey,
} from "./deadline";

// Fixed "now" for deterministic tests: 2026-04-22 10:00:00 local.
const NOW = new Date(2026, 3, 22, 10, 0, 0, 0).getTime();

describe("dateInputToEpochMs", () => {
  it("returns null for empty input", () => {
    expect(dateInputToEpochMs("")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(dateInputToEpochMs("not-a-date")).toBeNull();
  });

  it("parses YYYY-MM-DD to end-of-day local", () => {
    const ms = dateInputToEpochMs("2026-04-22");
    expect(ms).not.toBeNull();
    const d = new Date(ms as number);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
  });
});

describe("epochMsToDateInput", () => {
  it("returns empty string for null / undefined", () => {
    expect(epochMsToDateInput(null)).toBe("");
    expect(epochMsToDateInput(undefined)).toBe("");
  });

  it("formats to YYYY-MM-DD preserving local date", () => {
    const ms = new Date(2026, 0, 5, 12, 0).getTime();
    expect(epochMsToDateInput(ms)).toBe("2026-01-05");
  });

  it("pads single-digit month + day", () => {
    const ms = new Date(2026, 2, 1, 1, 0).getTime(); // March 1
    expect(epochMsToDateInput(ms)).toBe("2026-03-01");
  });

  it("round-trips through dateInputToEpochMs / epochMsToDateInput", () => {
    const iso = "2026-07-15";
    const ms = dateInputToEpochMs(iso)!;
    expect(epochMsToDateInput(ms)).toBe(iso);
  });
});

describe("deadlineState", () => {
  it("returns null when deadline is missing", () => {
    expect(deadlineState(null, NOW)).toBeNull();
    expect(deadlineState(undefined, NOW)).toBeNull();
  });

  it("overdue when deadline is strictly in the past", () => {
    const yesterday = new Date(2026, 3, 21, 23, 59).getTime();
    expect(deadlineState(yesterday, NOW)).toBe("overdue");
  });

  it("soon when due today (same calendar day, end-of-day)", () => {
    const endOfToday = new Date(2026, 3, 22, 23, 59).getTime();
    expect(deadlineState(endOfToday, NOW)).toBe("soon");
  });

  it("soon when due tomorrow", () => {
    const tomorrow = new Date(2026, 3, 23, 23, 59).getTime();
    expect(deadlineState(tomorrow, NOW)).toBe("soon");
  });

  it("ok when ≥ 2 calendar days away", () => {
    const twoDays = new Date(2026, 3, 24, 23, 59).getTime();
    expect(deadlineState(twoDays, NOW)).toBe("ok");
    const aWeek = new Date(2026, 3, 29, 23, 59).getTime();
    expect(deadlineState(aWeek, NOW)).toBe("ok");
  });

  it("overdue wins over same-day when the instant already passed", () => {
    const threeHoursAgo = new Date(2026, 3, 22, 7, 0).getTime();
    expect(deadlineState(threeHoursAgo, NOW)).toBe("overdue");
  });
});

describe("formatCountdownKey", () => {
  it("returns today vs pastToday based on time of day", () => {
    const endOfToday = new Date(2026, 3, 22, 23, 59).getTime();
    expect(formatCountdownKey(endOfToday, NOW).key).toBe("deadline.today");

    const earlierToday = new Date(2026, 3, 22, 7, 0).getTime();
    expect(formatCountdownKey(earlierToday, NOW).key).toBe("deadline.pastToday");
  });

  it("returns tomorrow for 1-day diff", () => {
    const tomorrow = new Date(2026, 3, 23, 10, 0).getTime();
    expect(formatCountdownKey(tomorrow, NOW)).toEqual({ key: "deadline.tomorrow" });
  });

  it("returns inDays with n for 2+ days ahead", () => {
    const in5 = new Date(2026, 3, 27, 10, 0).getTime();
    expect(formatCountdownKey(in5, NOW)).toEqual({ key: "deadline.inDays", vars: { n: 5 } });
  });

  it("returns pastDays with positive n when 1+ calendar day late", () => {
    const threeDaysAgo = new Date(2026, 3, 19, 10, 0).getTime();
    expect(formatCountdownKey(threeDaysAgo, NOW)).toEqual({
      key: "deadline.pastDays",
      vars: { n: 3 },
    });
  });
});
