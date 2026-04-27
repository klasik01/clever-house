import { describe, it, expect } from "vitest";
import { applyOpenClosed, applyCategory, applyLocation } from "./filters";
import type { Task } from "@/types";

/**
 * V20 — testy filter helpers. Pure funkce, žádné mocky.
 */

function mkTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Test",
    body: "",
    type: "napad",
    status: "Nový nápad",
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    commentCount: 0,
    imageUrls: [],
    linkUrls: [],
    linkedDocIds: [],
    ...overrides,
  } as Task;
}

describe("applyOpenClosed", () => {
  const open1 = mkTask({ id: "o1", status: "Nový nápad" });
  const open2 = mkTask({ id: "o2", status: "Ve stavbě" });
  const done1 = mkTask({ id: "d1", status: "Hotovo" });
  const done2 = mkTask({ id: "d2", status: "Hotovo" });
  const all = [open1, open2, done1, done2];

  it("'all' vrátí vše", () => {
    expect(applyOpenClosed(all, "all")).toEqual(all);
  });

  it("'open' vyfiltruje Hotovo", () => {
    const result = applyOpenClosed(all, "open");
    expect(result).toEqual([open1, open2]);
  });

  it("'done' vrátí jen Hotovo", () => {
    const result = applyOpenClosed(all, "done");
    expect(result).toEqual([done1, done2]);
  });

  it("prázdný array → prázdný array", () => {
    expect(applyOpenClosed([], "open")).toEqual([]);
  });

  it("dokumentace task s libovolným statusem projde open filtrem", () => {
    const dok = mkTask({ id: "dok", type: "dokumentace", status: "Nový nápad" });
    expect(applyOpenClosed([dok], "open")).toEqual([dok]);
  });
});

describe("applyCategory", () => {
  const t1 = mkTask({ id: "t1", categoryId: "cat-a" });
  const t2 = mkTask({ id: "t2", categoryId: "cat-b" });
  const t3 = mkTask({ id: "t3", categoryId: undefined });

  it("null categoryId → vrátí vše (no filter)", () => {
    expect(applyCategory([t1, t2, t3], null)).toEqual([t1, t2, t3]);
  });

  it("filtruje na konkrétní kategorii", () => {
    expect(applyCategory([t1, t2, t3], "cat-a")).toEqual([t1]);
  });

  it("neexistující kategorie → prázdný", () => {
    expect(applyCategory([t1, t2], "cat-x")).toEqual([]);
  });
});

describe("applyLocation", () => {
  const t1 = mkTask({ id: "t1", locationId: "loc-1" });
  const t2 = mkTask({ id: "t2", locationId: "loc-2" });
  const t3 = mkTask({ id: "t3", locationId: undefined });

  it("null locationId → vrátí vše", () => {
    expect(applyLocation([t1, t2, t3], null)).toEqual([t1, t2, t3]);
  });

  it("filtruje na konkrétní lokaci", () => {
    expect(applyLocation([t1, t2, t3], "loc-1")).toEqual([t1]);
  });

  it("task bez lokace neprojde filtrem", () => {
    expect(applyLocation([t3], "loc-1")).toEqual([]);
  });
});
