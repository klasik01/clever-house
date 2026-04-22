import { describe, it, expect, beforeEach } from "vitest";
import {
  applyOpenClosed,
  applyCategory,
  applyLocation,
  loadFilter,
  saveFilter,
  loadCategoryFilter,
  saveCategoryFilter,
  loadLocationFilter,
  saveLocationFilter,
  clearAllFilters,
} from "./filters";
import type { Task } from "@/types";

/** Minimal factory — fills only the fields the filter code reads. */
function mkTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    type: overrides.type ?? "napad",
    title: overrides.title ?? "",
    body: overrides.body ?? "",
    status: overrides.status ?? "Nápad",
    categoryId: overrides.categoryId ?? null,
    categoryIds: overrides.categoryIds,
    locationId: overrides.locationId ?? null,
    createdAt: "2026-04-22T10:00:00.000Z",
    updatedAt: "2026-04-22T10:00:00.000Z",
    createdBy: "owner",
    ...overrides,
  } as Task;
}

describe("applyOpenClosed", () => {
  const tasks = [
    mkTask({ id: "a", status: "Nápad" }),
    mkTask({ id: "b", status: "Hotovo" }),
    mkTask({ id: "c", status: "Rozhodnuto" }),
  ];

  it("all → returns input unchanged", () => {
    expect(applyOpenClosed(tasks, "all")).toHaveLength(3);
  });

  it("done → only Hotovo", () => {
    const r = applyOpenClosed(tasks, "done");
    expect(r.map((t) => t.id)).toEqual(["b"]);
  });

  it("open → everything except Hotovo (default)", () => {
    const r = applyOpenClosed(tasks, "open");
    expect(r.map((t) => t.id).sort()).toEqual(["a", "c"]);
  });
});

describe("applyCategory", () => {
  const tasks = [
    mkTask({ id: "x", categoryId: "kitchen" }),
    mkTask({ id: "y", categoryId: "bath" }),
    mkTask({ id: "z", categoryId: null }),
  ];

  it("null category → untouched", () => {
    expect(applyCategory(tasks, null)).toHaveLength(3);
  });

  it("matches exact categoryId", () => {
    const r = applyCategory(tasks, "kitchen");
    expect(r.map((t) => t.id)).toEqual(["x"]);
  });

  it("unknown category → empty result", () => {
    expect(applyCategory(tasks, "no-such")).toEqual([]);
  });
});

describe("applyLocation", () => {
  const tasks = [
    mkTask({ id: "p", locationId: "kuchyn" }),
    mkTask({ id: "q", locationId: null }),
  ];

  it("null → untouched", () => {
    expect(applyLocation(tasks, null)).toHaveLength(2);
  });

  it("matches exact locationId", () => {
    expect(applyLocation(tasks, "kuchyn").map((t) => t.id)).toEqual(["p"]);
  });
});

// ---------- Storage helpers (sessionStorage in jsdom) ----------

describe("sessionStorage-backed filters", () => {
  beforeEach(() => sessionStorage.clear());

  it("defaults to \"open\" when nothing stored", () => {
    expect(loadFilter("napady")).toBe("open");
  });

  it("ignores garbage values + falls back to open", () => {
    sessionStorage.setItem("filter:napady", "banana");
    expect(loadFilter("napady")).toBe("open");
  });

  it("save + load round-trips", () => {
    saveFilter("napady", "done");
    expect(loadFilter("napady")).toBe("done");
  });

  it("category filter loads null when unset or empty", () => {
    expect(loadCategoryFilter("napady")).toBeNull();
    sessionStorage.setItem("filter:napady:category", "");
    expect(loadCategoryFilter("napady")).toBeNull();
  });

  it("category save(null) clears the slot", () => {
    saveCategoryFilter("napady", "kitchen");
    expect(loadCategoryFilter("napady")).toBe("kitchen");
    saveCategoryFilter("napady", null);
    expect(loadCategoryFilter("napady")).toBeNull();
  });

  it("location filter mirrors the category behaviour", () => {
    expect(loadLocationFilter("napady")).toBeNull();
    saveLocationFilter("napady", "kuchyn");
    expect(loadLocationFilter("napady")).toBe("kuchyn");
    saveLocationFilter("napady", null);
    expect(loadLocationFilter("napady")).toBeNull();
  });

  it("clearAllFilters wipes all three slots for the given key", () => {
    saveFilter("napady", "done");
    saveCategoryFilter("napady", "kitchen");
    saveLocationFilter("napady", "kuchyn");
    clearAllFilters("napady");
    expect(loadFilter("napady")).toBe("open");
    expect(loadCategoryFilter("napady")).toBeNull();
    expect(loadLocationFilter("napady")).toBeNull();
  });

  it("namespacing: keys are per-list, not shared", () => {
    saveFilter("napady", "done");
    saveFilter("ukoly", "all");
    expect(loadFilter("napady")).toBe("done");
    expect(loadFilter("ukoly")).toBe("all");
  });
});
