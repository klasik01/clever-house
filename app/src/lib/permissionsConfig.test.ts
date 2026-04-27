import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  canActOn,
  canActOnResource,
  listActions,
  roleHas,
  type ActionKey,
} from "./permissionsConfig";
import type { UserRole } from "@/types";

/**
 * V18-S38 — testy permission configu.
 *
 * Strategie:
 *   - Invariant testy nad katalogem (každý PermissionRule má rulesAt + popis,
 *     žádný prázdný roles[]).
 *   - Per-action role × ownership permutace pro `roleHas` a `canActOnResource`.
 *   - Smoke test pro `canActOn` sugar wrapper.
 */

const ALL_ROLES: UserRole[] = ["OWNER", "PROJECT_MANAGER"];

// ---------- Invariants ----------

describe("PERMISSIONS catalog invariants", () => {
  it("každý record má neprázdný roles + description + rulesAt", () => {
    for (const key of listActions()) {
      const rule = PERMISSIONS[key];
      expect(rule.roles.length, `${key}: roles is empty`).toBeGreaterThan(0);
      expect(rule.description.length, `${key}: empty description`).toBeGreaterThan(0);
      expect(rule.rulesAt.length, `${key}: empty rulesAt`).toBeGreaterThan(0);
    }
  });

  it("ownership values jsou validní enum", () => {
    const allowed = new Set(["anyone", "author", "author-or-cross-owner"]);
    for (const key of listActions()) {
      const o = PERMISSIONS[key].ownership ?? "anyone";
      expect(allowed.has(o), `${key}: invalid ownership ${o}`).toBe(true);
    }
  });

  it("listActions vrací všechny klíče v PERMISSIONS", () => {
    const fromList = listActions().sort();
    const fromKeys = (Object.keys(PERMISSIONS) as ActionKey[]).sort();
    expect(fromList).toEqual(fromKeys);
  });
});

// ---------- roleHas ----------

describe("roleHas", () => {
  it("null/undefined role → false", () => {
    expect(roleHas("task.create.napad", null)).toBe(false);
    expect(roleHas("task.create.napad", undefined)).toBe(false);
  });

  it("OWNER má napad.create, PM ne", () => {
    expect(roleHas("task.create.napad", "OWNER")).toBe(true);
    expect(roleHas("task.create.napad", "PROJECT_MANAGER")).toBe(false);
  });

  it("oba role mají task.create.otazka a task.create.ukol", () => {
    for (const r of ALL_ROLES) {
      expect(roleHas("task.create.otazka", r)).toBe(true);
      expect(roleHas("task.create.ukol", r)).toBe(true);
    }
  });

  it("categories.manage + locations.manage jen pro OWNER", () => {
    expect(roleHas("categories.manage", "OWNER")).toBe(true);
    expect(roleHas("categories.manage", "PROJECT_MANAGER")).toBe(false);
    expect(roleHas("locations.manage", "OWNER")).toBe(true);
    expect(roleHas("locations.manage", "PROJECT_MANAGER")).toBe(false);
  });

  it("task.create.dokumentace pro OWNER i PM (V20)", () => {
    expect(roleHas("task.create.dokumentace", "OWNER")).toBe(true);
    expect(roleHas("task.create.dokumentace", "PROJECT_MANAGER")).toBe(true);
  });

  it("documentTypes.manage jen pro OWNER (V20)", () => {
    expect(roleHas("documentTypes.manage", "OWNER")).toBe(true);
    expect(roleHas("documentTypes.manage", "PROJECT_MANAGER")).toBe(false);
  });

  it("settings.profile + settings.calendarToken pro oba", () => {
    for (const r of ALL_ROLES) {
      expect(roleHas("settings.profile", r)).toBe(true);
      expect(roleHas("settings.calendarToken", r)).toBe(true);
    }
  });
});

// ---------- canActOnResource ----------

describe("canActOnResource — ownership: anyone", () => {
  it("task.read: každý signed-in s rolí v allowlistu", () => {
    expect(
      canActOnResource("task.read", {
        role: "OWNER",
        uid: "u1",
        resourceCreatedBy: "u2",
        resourceAuthorRole: "PROJECT_MANAGER",
      }),
    ).toBe(true);
  });

  it("task.read: missing uid → false", () => {
    expect(
      canActOnResource("task.read", {
        role: "OWNER",
        uid: null,
        resourceCreatedBy: "u1",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("task.read: missing role → false", () => {
    expect(
      canActOnResource("task.read", {
        role: null,
        uid: "u1",
        resourceCreatedBy: "u1",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(false);
  });
});

describe("canActOnResource — ownership: author (task.delete)", () => {
  it("autor smí", () => {
    expect(
      canActOnResource("task.delete", {
        role: "OWNER",
        uid: "u1",
        resourceCreatedBy: "u1",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("ne-autor (i kdyby OWNER OWNER-created) NESMÍ — delete je striktní", () => {
    expect(
      canActOnResource("task.delete", {
        role: "OWNER",
        uid: "u-owner-2",
        resourceCreatedBy: "u-owner-1",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("PM ne-autor PM-vytvořeného → false", () => {
    expect(
      canActOnResource("task.delete", {
        role: "PROJECT_MANAGER",
        uid: "pm-2",
        resourceCreatedBy: "pm-1",
        resourceAuthorRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });
});

describe("canActOnResource — ownership: author-or-cross-owner (task.edit)", () => {
  it("autor (OWNER) edituje vlastní", () => {
    expect(
      canActOnResource("task.edit", {
        role: "OWNER",
        uid: "u1",
        resourceCreatedBy: "u1",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("druhý OWNER edituje OWNER-vytvořený task (cross-OWNER)", () => {
    expect(
      canActOnResource("task.edit", {
        role: "OWNER",
        uid: "u-owner-2",
        resourceCreatedBy: "u-owner-1",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("OWNER NESMÍ editovat PM-vytvořený task (PM = jednotlivec)", () => {
    expect(
      canActOnResource("task.edit", {
        role: "OWNER",
        uid: "u-owner-1",
        resourceCreatedBy: "pm-1",
        resourceAuthorRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });

  it("PM autor edituje vlastní PM-task", () => {
    expect(
      canActOnResource("task.edit", {
        role: "PROJECT_MANAGER",
        uid: "pm-1",
        resourceCreatedBy: "pm-1",
        resourceAuthorRole: "PROJECT_MANAGER",
      }),
    ).toBe(true);
  });

  it("PM ne-autor PM-vytvořeného → false (žádné cross-PM)", () => {
    expect(
      canActOnResource("task.edit", {
        role: "PROJECT_MANAGER",
        uid: "pm-2",
        resourceCreatedBy: "pm-1",
        resourceAuthorRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });

  it("PM NESMÍ editovat OWNER-vytvořený task pokud není autor", () => {
    expect(
      canActOnResource("task.edit", {
        role: "PROJECT_MANAGER",
        uid: "pm-1",
        resourceCreatedBy: "u-owner-1",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("missing authorRole + ne-autor → false (safe default)", () => {
    expect(
      canActOnResource("task.edit", {
        role: "OWNER",
        uid: "u-owner-2",
        resourceCreatedBy: "u-owner-1",
        resourceAuthorRole: undefined,
      }),
    ).toBe(false);
  });

  it("missing authorRole, ale jsem autor → true (autor větev neprochází ownership)", () => {
    expect(
      canActOnResource("task.edit", {
        role: "OWNER",
        uid: "u1",
        resourceCreatedBy: "u1",
        resourceAuthorRole: undefined,
      }),
    ).toBe(true);
  });
});

describe("canActOnResource — event.edit (mirror task.edit)", () => {
  it("cross-OWNER edits OWNER event", () => {
    expect(
      canActOnResource("event.edit", {
        role: "OWNER",
        uid: "u-owner-2",
        resourceCreatedBy: "u-owner-1",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("PM ne-autor PM-event → false", () => {
    expect(
      canActOnResource("event.edit", {
        role: "PROJECT_MANAGER",
        uid: "pm-2",
        resourceCreatedBy: "pm-1",
        resourceAuthorRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });
});

describe("canActOnResource — autor short-circuit (V18-S38)", () => {
  it("autor smí editovat i s null rolí (profil ještě neloadnutý)", () => {
    expect(
      canActOnResource("task.edit", {
        role: null,
        uid: "me",
        resourceCreatedBy: "me",
        resourceAuthorRole: undefined,
      }),
    ).toBe(true);
  });

  it("autor smí mazat i s null rolí", () => {
    expect(
      canActOnResource("task.delete", {
        role: null,
        uid: "me",
        resourceCreatedBy: "me",
        resourceAuthorRole: undefined,
      }),
    ).toBe(true);
  });

  it("ne-autor s null rolí NESMÍ (cross-OWNER vyžaduje role check)", () => {
    expect(
      canActOnResource("task.edit", {
        role: null,
        uid: "me",
        resourceCreatedBy: "other",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("autor s null rolí na anyone-action stále vyžaduje role (žádný short-circuit)", () => {
    // task.read má ownership=anyone — autor short-circuit neplatí.
    expect(
      canActOnResource("task.read", {
        role: null,
        uid: "me",
        resourceCreatedBy: "me",
        resourceAuthorRole: "OWNER",
      }),
    ).toBe(false);
  });
});

// ---------- canActOn sugar wrapper ----------

describe("canActOn", () => {
  it("delegate na canActOnResource s extracted createdBy + authorRole z resource", () => {
    const task = { createdBy: "u1", authorRole: "OWNER" as const };
    expect(canActOn("task.edit", task, undefined, "u1", "OWNER")).toBe(true);
    expect(canActOn("task.delete", task, undefined, "u1", "OWNER")).toBe(true);
    expect(canActOn("task.delete", task, undefined, "u-owner-2", "OWNER")).toBe(false);
  });

  it("resourceAuthorRoleResolved param přebíjí task.authorRole (V17.8 user lookup fallback)", () => {
    // Task má prázdný authorRole, ale resolver z user lookupu vrátil OWNER.
    const task = { createdBy: "u-owner-1", authorRole: undefined };
    expect(canActOn("task.edit", task, "OWNER", "u-owner-2", "OWNER")).toBe(true);
  });

  it("resolved=undefined + task.authorRole=undefined + ne-autor → false", () => {
    const task = { createdBy: "u-owner-1", authorRole: undefined };
    expect(canActOn("task.edit", task, undefined, "u-owner-2", "OWNER")).toBe(false);
  });
});
