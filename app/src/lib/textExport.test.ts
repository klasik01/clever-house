import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock locations.getLocation — vrátíme null pro defaults a controlled hodnotu
// pro konkrétní id v jednotlivých testech.
vi.mock("./locations", () => ({
  getLocation: vi.fn(() => undefined),
}));

import { tasksToPlainText } from "./textExport";
import * as locationsModule from "./locations";
import type { Category, Task } from "@/types";

const getLocationMock = vi.mocked(locationsModule.getLocation);

beforeEach(() => {
  getLocationMock.mockReset();
  getLocationMock.mockReturnValue(undefined);
});

function mkTask(p: Partial<Task> & { id: string }): Task {
  return {
    id: p.id,
    type: p.type ?? "ukol",
    title: p.title ?? "",
    body: p.body ?? "",
    status: p.status ?? "OPEN",
    createdBy: p.createdBy ?? "user-1",
    createdAt: p.createdAt ?? "2026-05-01T12:00:00.000Z",
    updatedAt: p.updatedAt ?? "2026-05-01T12:00:00.000Z",
    categoryId: p.categoryId ?? null,
    categoryIds: p.categoryIds ?? [],
    locationId: p.locationId ?? null,
    sharedWithRoles: p.sharedWithRoles ?? [],
    assigneeUid: p.assigneeUid ?? null,
    priority: p.priority ?? null,
    deadline: p.deadline ?? null,
    commentCount: p.commentCount ?? 0,
    attachmentImageUrl: p.attachmentImageUrl,
    attachmentImagePath: p.attachmentImagePath,
    attachmentLinkUrl: p.attachmentLinkUrl,
    attachmentImages: p.attachmentImages ?? [],
    attachmentLinks: p.attachmentLinks ?? [],
    linkedTaskId: p.linkedTaskId ?? null,
    linkedTaskIds: p.linkedTaskIds ?? [],
    dependencyText: p.dependencyText,
    vystup: p.vystup,
    projektantAnswer: p.projektantAnswer,
  } as Task;
}

describe("tasksToPlainText", () => {
  it("prázdný seznam → '(žádné záznamy)'", () => {
    const out = tasksToPlainText([], [], "Test export");
    expect(out).toContain("Test export");
    expect(out).toContain("(žádné záznamy)");
  });

  it("hlavička obsahuje title + datum 'Vygenerováno:'", () => {
    const out = tasksToPlainText([], [], "Můj export");
    expect(out).toMatch(/^Můj export\n=+\nVygenerováno:/);
  });

  it("renderuje task title jako body fallback", () => {
    const out = tasksToPlainText(
      [mkTask({ id: "t1", title: "Zajistit elektriku", body: "" })],
      [],
      "x",
    );
    expect(out).toContain("Zajistit elektriku");
  });

  it("preferuje body před title", () => {
    const out = tasksToPlainText(
      [mkTask({ id: "t1", title: "Title", body: "Detailní popis" })],
      [],
      "x",
    );
    expect(out).toContain("Detailní popis");
    // Title se nezobrazí (body má priority)
    expect(out).not.toContain("   Title");
  });

  it("'(bez textu)' pokud body i title prázdné", () => {
    const out = tasksToPlainText(
      [mkTask({ id: "t1", title: "", body: "" })],
      [],
      "x",
    );
    expect(out).toContain("(bez textu)");
  });

  it("render kategorie pokud je task.categoryId", () => {
    const cat: Category = {
      id: "elektro",
      label: "Elektro",
      createdBy: "u",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const out = tasksToPlainText(
      [mkTask({ id: "t1", body: "test", categoryId: "elektro" })],
      [cat],
      "x",
    );
    expect(out).toContain("Kategorie: Elektro");
  });

  it("kategorie se neukáže pro task bez categoryId", () => {
    const out = tasksToPlainText([mkTask({ id: "t1", body: "test" })], [], "x");
    expect(out).not.toContain("Kategorie:");
  });

  it("render lokace přes getLocation mock", () => {
    getLocationMock.mockReturnValue({
      id: "kuchyn",
      label: "Kuchyň",
      group: "dum",
    });
    const out = tasksToPlainText(
      [mkTask({ id: "t1", body: "test", locationId: "kuchyn" })],
      [],
      "x",
    );
    expect(out).toContain("Lokace: Kuchyň");
  });

  it("render attachmentLinks (pole)", () => {
    const out = tasksToPlainText(
      [
        mkTask({
          id: "t1",
          body: "x",
          attachmentLinks: ["https://a.cz", "https://b.cz"],
        }),
      ],
      [],
      "x",
    );
    expect(out).toContain("Odkaz: https://a.cz");
    expect(out).toContain("Odkaz: https://b.cz");
  });

  it("legacy attachmentLinkUrl (single string) fallback", () => {
    const out = tasksToPlainText(
      [
        mkTask({
          id: "t1",
          body: "x",
          attachmentLinks: [],
          attachmentLinkUrl: "https://legacy.cz",
        }),
      ],
      [],
      "x",
    );
    expect(out).toContain("Odkaz: https://legacy.cz");
  });

  it("render attachmentImages url", () => {
    const out = tasksToPlainText(
      [
        mkTask({
          id: "t1",
          body: "x",
          attachmentImages: [{ id: "i1", url: "https://img.cz/1.jpg", path: "p" }],
        }),
      ],
      [],
      "x",
    );
    expect(out).toContain("Obrázek: https://img.cz/1.jpg");
  });

  it("render projektantAnswer (V13 legacy field)", () => {
    const out = tasksToPlainText(
      [
        mkTask({
          id: "t1",
          body: "Otázka",
          projektantAnswer: "Odpověď řádek 1\nŘádek 2",
        }),
      ],
      [],
      "x",
    );
    expect(out).toContain("Odpověď Projektanta:");
    expect(out).toContain("Odpověď řádek 1");
    expect(out).toContain("Řádek 2");
  });

  it("multi-line body se renderuje s indentací", () => {
    const out = tasksToPlainText(
      [mkTask({ id: "t1", body: "Řádek 1\nŘádek 2\nŘádek 3" })],
      [],
      "x",
    );
    expect(out).toContain("   Řádek 1");
    expect(out).toContain("   Řádek 2");
    expect(out).toContain("   Řádek 3");
  });

  it("multiple tasks — separator mezi nimi", () => {
    const out = tasksToPlainText(
      [
        mkTask({ id: "t1", body: "First" }),
        mkTask({ id: "t2", body: "Second" }),
      ],
      [],
      "x",
    );
    expect(out).toMatch(/1\. \[OPEN\]/);
    expect(out).toMatch(/2\. \[OPEN\]/);
    expect(out).toContain("First");
    expect(out).toContain("Second");
  });
});
