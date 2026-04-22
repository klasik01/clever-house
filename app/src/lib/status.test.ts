import { describe, it, expect } from "vitest";
import {
  mapLegacyOtazkaStatus,
  canonicalStatus,
  isOtazkaCanonical,
  statusLabel,
  OTAZKA_STATUSES,
  NAPAD_STATUSES,
} from "./status";
import type { TaskStatus } from "@/types";

/**
 * A tiny stand-in for the useT() TFn. Every i18n key we ask for is echoed
 * back verbatim so assertions stay readable — the production resolver is
 * tested elsewhere. The second arg (vars) is unused for these keys.
 */
const identT = ((key: string) => key) as (k: string) => string;

describe("mapLegacyOtazkaStatus", () => {
  it("passes canonical otazka statuses through", () => {
    for (const s of OTAZKA_STATUSES) {
      expect(mapLegacyOtazkaStatus(s)).toBe(s);
    }
  });

  it("maps legacy \"Otázka\" → ON_PM_SITE (ball on PM)", () => {
    expect(mapLegacyOtazkaStatus("Otázka")).toBe("ON_PM_SITE");
  });

  it("maps legacy \"Čekám\" → ON_CLIENT_SITE (ball on owner)", () => {
    expect(mapLegacyOtazkaStatus("Čekám")).toBe("ON_CLIENT_SITE");
  });

  it("rolls up legacy resolved-ish statuses to DONE", () => {
    expect(mapLegacyOtazkaStatus("Rozhodnuto")).toBe("DONE");
    expect(mapLegacyOtazkaStatus("Ve stavbě")).toBe("DONE");
    expect(mapLegacyOtazkaStatus("Hotovo")).toBe("DONE");
  });

  it("defaults Nápad → ON_PM_SITE so task never disappears", () => {
    expect(mapLegacyOtazkaStatus("Nápad")).toBe("ON_PM_SITE");
  });
});

describe("canonicalStatus", () => {
  it("normalises legacy otazka values when type is otazka", () => {
    expect(canonicalStatus("otazka", "Otázka")).toBe("ON_PM_SITE");
    expect(canonicalStatus("otazka", "Čekám")).toBe("ON_CLIENT_SITE");
    expect(canonicalStatus("otazka", "Hotovo")).toBe("DONE");
  });

  it("leaves nápad values untouched", () => {
    for (const s of NAPAD_STATUSES) {
      expect(canonicalStatus("napad", s)).toBe(s);
    }
  });

  it("does not mutate already-canonical otazka values", () => {
    expect(canonicalStatus("otazka", "BLOCKED")).toBe("BLOCKED");
    expect(canonicalStatus("otazka", "CANCELED")).toBe("CANCELED");
  });
});

describe("isOtazkaCanonical", () => {
  it("recognises every canonical otazka status", () => {
    for (const s of OTAZKA_STATUSES) expect(isOtazkaCanonical(s)).toBe(true);
  });

  it("rejects nápad + legacy statuses", () => {
    for (const s of ["Nápad", "Otázka", "Čekám", "Rozhodnuto", "Ve stavbě", "Hotovo"] as TaskStatus[]) {
      expect(isOtazkaCanonical(s)).toBe(false);
    }
  });
});

describe("statusLabel — per-role + per-type keys", () => {
  it("ON_CLIENT_SITE picks owner vs pm key", () => {
    expect(statusLabel(identT, "ON_CLIENT_SITE", { isPm: false }))
      .toBe("statusOtazka.ON_CLIENT_SITE.owner");
    expect(statusLabel(identT, "ON_CLIENT_SITE", { isPm: true }))
      .toBe("statusOtazka.ON_CLIENT_SITE.pm");
  });

  it("ON_PM_SITE picks owner vs pm key", () => {
    expect(statusLabel(identT, "ON_PM_SITE", { isPm: false }))
      .toBe("statusOtazka.ON_PM_SITE.owner");
    expect(statusLabel(identT, "ON_PM_SITE", { isPm: true }))
      .toBe("statusOtazka.ON_PM_SITE.pm");
  });

  it("BLOCKED / CANCELED / DONE are role-agnostic", () => {
    for (const s of ["BLOCKED", "CANCELED", "DONE"] as const) {
      const ownerLabel = statusLabel(identT, s, { isPm: false });
      const pmLabel = statusLabel(identT, s, { isPm: true });
      expect(ownerLabel).toBe(pmLabel);
      expect(ownerLabel).toBe(`statusOtazka.${s}`);
    }
  });

  it("maps legacy otazka values before labelling when type=otazka", () => {
    // "Otázka" → ON_PM_SITE → owner-variant when !isPm
    expect(statusLabel(identT, "Otázka", { isPm: false, type: "otazka" }))
      .toBe("statusOtazka.ON_PM_SITE.owner");
    expect(statusLabel(identT, "Čekám", { isPm: true, type: "otazka" }))
      .toBe("statusOtazka.ON_CLIENT_SITE.pm");
  });

  it("falls back to flat status.* keys for nápad statuses", () => {
    expect(statusLabel(identT, "Nápad", { isPm: false })).toBe("status.Nápad");
    expect(statusLabel(identT, "Rozhodnuto", { isPm: false })).toBe("status.Rozhodnuto");
    expect(statusLabel(identT, "Ve stavbě", { isPm: false })).toBe("status.Ve stavbě");
    expect(statusLabel(identT, "Hotovo", { isPm: false })).toBe("status.Hotovo");
  });
});
