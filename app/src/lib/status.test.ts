import { describe, it, expect } from "vitest";
import {
  mapLegacyOtazkaStatus,
  canonicalStatus,
  isOtazkaCanonical,
  isBallOnMe,
  statusLabel,
  OTAZKA_STATUSES,
} from "./status";
import type { Task, TaskStatus } from "@/types";

const identT = ((key: string) => key) as (k: string) => string;

describe("mapLegacyOtazkaStatus (V10)", () => {
  it("passes V10 canonical otazka statuses through", () => {
    for (const s of OTAZKA_STATUSES) expect(mapLegacyOtazkaStatus(s)).toBe(s);
  });

  it("collapses V5 role-based values → OPEN", () => {
    expect(mapLegacyOtazkaStatus("ON_PM_SITE")).toBe("OPEN");
    expect(mapLegacyOtazkaStatus("ON_CLIENT_SITE")).toBe("OPEN");
  });

  it("collapses pre-V5 values → OPEN (active) or DONE (closed)", () => {
    expect(mapLegacyOtazkaStatus("Otázka")).toBe("OPEN");
    expect(mapLegacyOtazkaStatus("Čekám")).toBe("OPEN");
    expect(mapLegacyOtazkaStatus("Rozhodnuto")).toBe("DONE");
    expect(mapLegacyOtazkaStatus("Ve stavbě")).toBe("OPEN"); // V25 — Codequ remap
    expect(mapLegacyOtazkaStatus("Hotovo")).toBe("DONE");
  });

  it("defaults Nápad → OPEN so úkol never disappears", () => {
    expect(mapLegacyOtazkaStatus("Nápad")).toBe("OPEN");
  });
});

describe("canonicalStatus", () => {
  it("normalises legacy otazka values when type is otazka", () => {
    expect(canonicalStatus("otazka", "Otázka")).toBe("OPEN");
    expect(canonicalStatus("otazka", "ON_PM_SITE")).toBe("OPEN");
    expect(canonicalStatus("otazka", "Hotovo")).toBe("DONE");
  });

  it("V23 — maps napad (téma) values through legacy mapper like otázka", () => {
    expect(canonicalStatus("napad", "Nápad")).toBe("OPEN");
    expect(canonicalStatus("napad", "Rozhodnuto")).toBe("DONE");
    expect(canonicalStatus("napad", "Ve stavbě")).toBe("OPEN"); // V25
    expect(canonicalStatus("napad", "Hotovo")).toBe("DONE");
    expect(canonicalStatus("napad", "OPEN")).toBe("OPEN");
    expect(canonicalStatus("napad", "BLOCKED")).toBe("BLOCKED");
    expect(canonicalStatus("napad", "DONE")).toBe("DONE");
  });
});

describe("isOtazkaCanonical", () => {
  it("recognises every V10 canonical otazka status", () => {
    for (const s of OTAZKA_STATUSES) expect(isOtazkaCanonical(s)).toBe(true);
  });

  it("rejects nápad + legacy statuses", () => {
    for (const s of ["Nápad", "Otázka", "Čekám", "Rozhodnuto", "Ve stavbě", "Hotovo", "ON_PM_SITE", "ON_CLIENT_SITE"] as TaskStatus[]) {
      expect(isOtazkaCanonical(s)).toBe(false);
    }
  });
});

describe("statusLabel (V10 — role-agnostic)", () => {
  it("OPEN maps to statusOtazka.OPEN", () => {
    expect(statusLabel(identT, "OPEN", { type: "otazka" })).toBe("statusOtazka.OPEN");
  });

  it("BLOCKED / CANCELED / DONE labels are terminal + same for every viewer", () => {
    for (const s of ["BLOCKED", "CANCELED", "DONE"] as const) {
      expect(statusLabel(identT, s, { type: "otazka", isPm: false }))
        .toBe(`statusOtazka.${s}`);
      expect(statusLabel(identT, s, { type: "otazka", isPm: true }))
        .toBe(`statusOtazka.${s}`);
    }
  });

  it("maps legacy otazka values via mapper first", () => {
    expect(statusLabel(identT, "Otázka", { type: "otazka" })).toBe("statusOtazka.OPEN");
    expect(statusLabel(identT, "ON_PM_SITE", { type: "otazka" })).toBe("statusOtazka.OPEN");
    expect(statusLabel(identT, "Hotovo", { type: "otazka" })).toBe("statusOtazka.DONE");
  });

  it("V23 — napad uses statusOtazka.* keys like otázka/úkol", () => {
    expect(statusLabel(identT, "OPEN", { type: "napad" })).toBe("statusOtazka.OPEN");
    expect(statusLabel(identT, "DONE", { type: "napad" })).toBe("statusOtazka.DONE");
    expect(statusLabel(identT, "BLOCKED", { type: "napad" })).toBe("statusOtazka.BLOCKED");
  });
});

describe("isBallOnMe (V10 — assignee-driven)", () => {
  function mk(overrides: Partial<Task> = {}): Task {
    return {
      id: overrides.id ?? "t",
      type: overrides.type ?? "otazka",
      title: "",
      body: "",
      status: overrides.status ?? "OPEN",
      createdBy: overrides.createdBy ?? "author",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      ...overrides,
    } as Task;
  }

  it("returns false when no uid given", () => {
    expect(isBallOnMe(mk(), undefined)).toBe(false);
  });

  it("true when assignee matches uid and úkol is OPEN", () => {
    expect(isBallOnMe(mk({ assigneeUid: "me" }), "me")).toBe(true);
  });

  it("false when úkol is DONE / BLOCKED / CANCELED even if assignee matches", () => {
    expect(isBallOnMe(mk({ assigneeUid: "me", status: "DONE" }), "me")).toBe(false);
    expect(isBallOnMe(mk({ assigneeUid: "me", status: "BLOCKED" }), "me")).toBe(false);
    expect(isBallOnMe(mk({ assigneeUid: "me", status: "CANCELED" }), "me")).toBe(false);
  });

  it("false for napad tasks (no assignee workflow)", () => {
    expect(isBallOnMe(mk({ type: "napad", assigneeUid: "me", status: "OPEN" }), "me")).toBe(false);
  });

  it("falls back to createdBy when assigneeUid is null (legacy record)", () => {
    expect(isBallOnMe(mk({ createdBy: "me" }), "me")).toBe(true);
    expect(isBallOnMe(mk({ createdBy: "other" }), "me")).toBe(false);
  });

  it("maps legacy Otázka / ON_PM_SITE statuses to OPEN before the check", () => {
    expect(isBallOnMe(mk({ assigneeUid: "me", status: "Otázka" }), "me")).toBe(true);
    expect(isBallOnMe(mk({ assigneeUid: "me", status: "ON_PM_SITE" }), "me")).toBe(true);
  });
});

// ---------- V14 — úkol shares canonical pipeline with otázka ----------

describe("V14 — canonicalStatus respects úkol", () => {
  it("normalises úkol statuses like otázka", () => {
    expect(canonicalStatus("ukol", "OPEN")).toBe("OPEN");
    expect(canonicalStatus("ukol", "Otázka")).toBe("OPEN");
    expect(canonicalStatus("ukol", "ON_PM_SITE")).toBe("OPEN");
    expect(canonicalStatus("ukol", "Hotovo")).toBe("DONE");
    expect(canonicalStatus("ukol", "BLOCKED")).toBe("BLOCKED");
  });
});

describe("V14 — statusLabel respects úkol", () => {
  it("úkol maps to statusOtazka.* like otázka", () => {
    expect(statusLabel(identT, "OPEN", { type: "ukol" })).toBe("statusOtazka.OPEN");
    expect(statusLabel(identT, "DONE", { type: "ukol" })).toBe("statusOtazka.DONE");
    expect(statusLabel(identT, "BLOCKED", { type: "ukol" })).toBe("statusOtazka.BLOCKED");
  });
});

describe("V14 — isBallOnMe extends to úkol", () => {
  function mk(overrides: Partial<Task> = {}): Task {
    return {
      id: overrides.id ?? "t",
      type: overrides.type ?? "ukol",
      title: "",
      body: "",
      status: overrides.status ?? "OPEN",
      createdBy: overrides.createdBy ?? "author",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      ...overrides,
    } as Task;
  }

  it("true for úkol OPEN assigned to me", () => {
    expect(isBallOnMe(mk({ assigneeUid: "me" }), "me")).toBe(true);
  });

  it("false for úkol DONE/BLOCKED/CANCELED even when assignee matches", () => {
    for (const s of ["DONE", "BLOCKED", "CANCELED"] as TaskStatus[]) {
      expect(isBallOnMe(mk({ assigneeUid: "me", status: s }), "me")).toBe(false);
    }
  });

  it("falls back to createdBy for legacy úkol without assigneeUid", () => {
    expect(isBallOnMe(mk({ createdBy: "me" }), "me")).toBe(true);
  });

  it("still false for napad even when assigneeUid matches (type gate)", () => {
    expect(isBallOnMe(mk({ type: "napad", assigneeUid: "me", status: "OPEN" }), "me")).toBe(false);
  });
});

