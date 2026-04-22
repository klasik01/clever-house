import { describe, it, expect } from "vitest";
import { matchTaskQuery, applySearch, normaliseForSearch } from "./search";
import type { Task } from "@/types";

function mk(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t",
    type: "otazka",
    title: "",
    body: "",
    status: "OPEN",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    createdBy: "author",
    ...overrides,
  } as Task;
}

describe("normaliseForSearch", () => {
  it("lowercases + strips diacritics", () => {
    expect(normaliseForSearch("Kuchyň")).toBe("kuchyn");
    expect(normaliseForSearch("ČÁRKY + háčky")).toBe("carky + hacky");
  });

  it("keeps whitespace intact (token-splitter reads it later)", () => {
    expect(normaliseForSearch("Dvě slova")).toBe("dve slova");
  });
});

describe("matchTaskQuery", () => {
  it("empty query matches every task", () => {
    expect(matchTaskQuery(mk({ title: "anything" }), "")).toBe(true);
    expect(matchTaskQuery(mk(), "   ")).toBe(true);
  });

  it("matches a whole word in title (case-insensitive)", () => {
    expect(matchTaskQuery(mk({ title: "Kuchyňská linka" }), "kuchyň")).toBe(true);
    expect(matchTaskQuery(mk({ title: "Kuchyňská linka" }), "LINKA")).toBe(true);
  });

  it("diacritic-insensitive match", () => {
    expect(matchTaskQuery(mk({ title: "Kuchyň" }), "kuchyn")).toBe(true);
    expect(matchTaskQuery(mk({ title: "kuchyn" }), "Kuchyň")).toBe(true);
  });

  it("matches substring inside body", () => {
    expect(matchTaskQuery(mk({ body: "Potřebujeme rozvaděč v technické místnosti" }), "rozvadec"))
      .toBe(true);
  });

  it("multi-word query = AND match across title + body", () => {
    const task = mk({ title: "Elektroinstalace", body: "Pozice rozvaděče v kuchyni" });
    expect(matchTaskQuery(task, "elektro kuchyn")).toBe(true);
    // Missing token → no match
    expect(matchTaskQuery(task, "elektro zahrada")).toBe(false);
  });

  it("no match when query doesn\'t appear", () => {
    expect(matchTaskQuery(mk({ title: "Kuchyň", body: "" }), "zahrada")).toBe(false);
  });
});

describe("applySearch", () => {
  const tasks = [
    mk({ id: "a", title: "Kuchyň — rozvaděč", body: "" }),
    mk({ id: "b", title: "Zahrada", body: "zavlažování" }),
    mk({ id: "c", title: "Střecha", body: "tepelná izolace" }),
  ];

  it("empty query returns input untouched", () => {
    expect(applySearch(tasks, "")).toHaveLength(3);
  });

  it("filters to the matching subset", () => {
    expect(applySearch(tasks, "zahrada").map((t) => t.id)).toEqual(["b"]);
    expect(applySearch(tasks, "kuchyn").map((t) => t.id)).toEqual(["a"]);
    expect(applySearch(tasks, "izolace").map((t) => t.id)).toEqual(["c"]);
  });

  it("multi-token AND works across list", () => {
    // "kuchyň" + "rozvaděč" both need to appear somewhere
    expect(applySearch(tasks, "kuchyn rozvadec").map((t) => t.id)).toEqual(["a"]);
    // Impossible combination
    expect(applySearch(tasks, "kuchyn zahrada")).toEqual([]);
  });
});
