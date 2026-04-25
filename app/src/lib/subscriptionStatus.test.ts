import { describe, it, expect } from "vitest";
import { subscriptionStatus } from "./subscriptionStatus";

const NOW = Date.parse("2026-05-01T12:00:00Z");
const M = 60 * 1000;
const H = 60 * M;

describe("subscriptionStatus", () => {
  it("undefined → unknown", () => {
    expect(subscriptionStatus(undefined, NOW)).toEqual({
      status: "unknown",
      lastFetchedAt: null,
      staleMinutes: null,
    });
  });

  it("null → unknown", () => {
    expect(subscriptionStatus(null, NOW).status).toBe("unknown");
  });

  it("invalid ISO → unknown", () => {
    expect(subscriptionStatus("not a date", NOW).status).toBe("unknown");
  });

  it("nedávný fetch (před 5 min) → active", () => {
    const last = new Date(NOW - 5 * M).toISOString();
    const info = subscriptionStatus(last, NOW);
    expect(info.status).toBe("active");
    expect(info.staleMinutes).toBe(5);
  });

  it("fetch před 1h → active", () => {
    const last = new Date(NOW - 1 * H).toISOString();
    expect(subscriptionStatus(last, NOW).status).toBe("active");
  });

  it("fetch před 24h → active (v okně)", () => {
    const last = new Date(NOW - 24 * H).toISOString();
    expect(subscriptionStatus(last, NOW).status).toBe("active");
  });

  it("fetch před 26h → stale (mimo okno 25h)", () => {
    const last = new Date(NOW - 26 * H).toISOString();
    expect(subscriptionStatus(last, NOW).status).toBe("stale");
  });

  it("fetch před týdnem → stale", () => {
    const last = new Date(NOW - 7 * 24 * H).toISOString();
    expect(subscriptionStatus(last, NOW).status).toBe("stale");
  });
});
