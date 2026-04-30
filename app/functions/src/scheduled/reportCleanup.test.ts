import { describe, expect, it } from "vitest";
import { findExpiredReports } from "./reportCleanup";

describe("findExpiredReports — V26 24h TTL", () => {
  const nowMs = Date.parse("2026-04-29T12:00:00Z");

  it("vrátí reports starší 24h", () => {
    const reports = [
      { id: "r1", createdAt: "2026-04-28T11:00:00Z" }, // 25h — expired
      { id: "r2", createdAt: "2026-04-29T08:00:00Z" }, // 4h — fresh
      { id: "r3", createdAt: "2026-04-27T12:00:00Z" }, // 48h — expired
    ];
    const expired = findExpiredReports(reports, nowMs);
    expect(expired.map((r) => r.id).sort()).toEqual(["r1", "r3"]);
  });

  it("hraniční hodnota 24h přesně — NEexpiruje (cutoff je striktní <)", () => {
    const exactly24h = "2026-04-28T12:00:00Z";
    const expired = findExpiredReports(
      [{ id: "edge", createdAt: exactly24h }],
      nowMs,
    );
    expect(expired).toEqual([]);
  });

  it("invalid createdAt → safe skip", () => {
    const reports = [
      { id: "valid", createdAt: "2026-04-27T12:00:00Z" },
      { id: "garbage", createdAt: "not-a-date" },
      { id: "empty", createdAt: "" },
    ];
    const expired = findExpiredReports(reports, nowMs);
    expect(expired.map((r) => r.id)).toEqual(["valid"]);
  });

  it("custom TTL — 1h", () => {
    const reports = [
      { id: "30min", createdAt: "2026-04-29T11:30:00Z" },
      { id: "2h", createdAt: "2026-04-29T10:00:00Z" },
    ];
    const expired = findExpiredReports(reports, nowMs, 1);
    expect(expired.map((r) => r.id)).toEqual(["2h"]);
  });

  it("prázdný array → prázdný", () => {
    expect(findExpiredReports([], nowMs)).toEqual([]);
  });

  it("media field se zachovává v output (pro storage cleanup)", () => {
    const reports = [
      {
        id: "r1",
        createdAt: "2026-04-27T12:00:00Z",
        media: [{ path: "reports/u1/r1/foo.webp" }],
      },
    ];
    const expired = findExpiredReports(reports, nowMs);
    expect(expired[0]?.media).toEqual([{ path: "reports/u1/r1/foo.webp" }]);
  });
});
