import { describe, it, expect } from "vitest";
import {
  mapLegacyOtazkaStatus,
  canonicalStatus,
  isOtazkaCanonical,
  isBallOnMe,
  statusLabel,
  OTAZKA_STATUSES,
  NAPAD_STATUSES,
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
    expect(mapLegacyOtazkaStatus("Ve stavbě")).toBe("DONE");
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

  it("leaves nápad values untouched", () => {
    for (const s of NAPAD_STATUSES) expect(canonicalStatus("napad", s)).toBe(s);
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

  it("falls back to flat status.* keys for nápad statuses", () => {
    expect(statusLabel(identT, "Nápad")).toBe("status.Nápad");
    expect(statusLabel(identT, "Rozhodnuto")).toBe("status.Rozhodnuto");
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

  it("false for napad tasks (concept does not apply)", () => {
    expect(isBallOnMe(mk({ type: "napad", assigneeUid: "me" }), "me")).toBe(false);
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
