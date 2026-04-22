import { describe, it, expect } from "vitest";
import { computePrehledGroups, isM2Ok, STUCK_DAYS, M2_TARGET } from "./prehled";
import type { Task } from "@/types";

const NOW = new Date(2026, 3, 22, 10, 0).getTime();
const msDay = 24 * 60 * 60 * 1000;

function mkOtazka(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t",
    type: "otazka",
    title: "",
    body: "",
    status: overrides.status ?? "Otázka",
    locationId: null,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? new Date(NOW).toISOString(),
    createdBy: overrides.createdBy ?? "owner-uid",
    ...overrides,
  } as Task;
}

describe("computePrehledGroups", () => {
  it("excludes non-otazka tasks from every bucket", () => {
    const napad = { ...mkOtazka({ id: "nap" }), type: "napad" } as Task;
    const g = computePrehledGroups([napad], "owner-uid", NOW);
    expect(g["waiting-me"]).toEqual([]);
    expect(g["waiting-others"]).toEqual([]);
    expect(g.overdue).toEqual([]);
    expect(g.stuck).toEqual([]);
  });

  it("waiting-me: assigneeUid (or creator) matches current uid", () => {
    const a = mkOtazka({ id: "a", createdBy: "me", status: "Otázka" });
    const b = mkOtazka({ id: "b", createdBy: "other", assigneeUid: "me", status: "Otázka" });
    const c = mkOtazka({ id: "c", createdBy: "other", status: "Otázka" });
    const g = computePrehledGroups([a, b, c], "me", NOW);
    expect(g["waiting-me"].map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("waiting-others: assigned to someone else (not me)", () => {
    const a = mkOtazka({ id: "a", createdBy: "me", status: "Otázka" });
    const b = mkOtazka({ id: "b", createdBy: "alice", status: "Otázka" });
    const g = computePrehledGroups([a, b], "me", NOW);
    expect(g["waiting-others"].map((t) => t.id)).toEqual(["b"]);
  });

  it("overdue: deadline < now and status != Hotovo", () => {
    const a = mkOtazka({
      id: "a",
      deadline: NOW - msDay,
      status: "Otázka",
    });
    const b = mkOtazka({
      id: "b",
      deadline: NOW - msDay,
      status: "Hotovo",
    });
    const c = mkOtazka({
      id: "c",
      deadline: NOW + msDay * 2,
      status: "Otázka",
    });
    const g = computePrehledGroups([a, b, c], "me", NOW);
    expect(g.overdue.map((t) => t.id)).toEqual(["a"]);
  });

  it("stuck: Čekám + updatedAt older than STUCK_DAYS", () => {
    const fresh = mkOtazka({
      id: "fresh",
      status: "Čekám",
      updatedAt: new Date(NOW - (STUCK_DAYS - 1) * msDay).toISOString(),
    });
    const old = mkOtazka({
      id: "old",
      status: "Čekám",
      updatedAt: new Date(NOW - (STUCK_DAYS + 1) * msDay).toISOString(),
    });
    const wrongStatus = mkOtazka({
      id: "wrong",
      status: "Otázka",
      updatedAt: new Date(NOW - (STUCK_DAYS + 1) * msDay).toISOString(),
    });
    const g = computePrehledGroups([fresh, old, wrongStatus], "me", NOW);
    expect(g.stuck.map((t) => t.id)).toEqual(["old"]);
  });

  it("stuck: ignores unparseable updatedAt", () => {
    const bad = mkOtazka({ id: "bad", status: "Čekám", updatedAt: "not-a-date" });
    const g = computePrehledGroups([bad], "me", NOW);
    expect(g.stuck).toEqual([]);
  });
});

describe("isM2Ok", () => {
  it("true when stuck count ≤ M2_TARGET", () => {
    expect(isM2Ok(0)).toBe(true);
    expect(isM2Ok(M2_TARGET)).toBe(true);
  });

  it("false above M2_TARGET", () => {
    expect(isM2Ok(M2_TARGET + 1)).toBe(false);
    expect(isM2Ok(99)).toBe(false);
  });
});
