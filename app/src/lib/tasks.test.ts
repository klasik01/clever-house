import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import {
  createTask,
  updateTask,
  deleteTask,
  getTask,
  convertNapadToOtazka,
} from "./tasks";
import type { Task } from "@/types";

beforeEach(() => __firestoreState.reset());

describe("createTask", () => {
  it("writes a task doc with owner uid, defaults + server timestamps", async () => {
    const id = await createTask(
      { type: "napad", title: "Mám nápad", body: "tady", status: "Nápad" },
      "owner-1",
    );
    expect(id).toMatch(/^auto-/);
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored).toMatchObject({
      type: "napad",
      title: "Mám nápad",
      body: "tady",
      status: "Nápad",
      createdBy: "owner-1",
      categoryId: null,
      locationId: null,
      linkedTaskIds: [],
      attachmentImages: [],
      attachmentLinks: [],
    });
    expect(stored.createdAt).toEqual({ __sentinel: "serverTimestamp" });
    expect(stored.updatedAt).toEqual({ __sentinel: "serverTimestamp" });
  });

  it("logs a single setDoc call", async () => {
    await createTask(
      { type: "otazka", title: "Otázka", body: "", status: "Otázka" },
      "owner",
    );
    const ops = __firestoreState.calls.map((c) => c.op);
    expect(ops).toContain("setDoc");
  });
});

describe("updateTask", () => {
  it("merges patch + stamps updatedAt", async () => {
    __firestoreState.store.set("tasks/t1", { title: "old", body: "b" });
    await updateTask("t1", { title: "new", status: "Rozhodnuto" });
    const merged = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(merged.title).toBe("new");
    expect(merged.body).toBe("b");
    expect(merged.status).toBe("Rozhodnuto");
    expect(merged.updatedAt).toEqual({ __sentinel: "serverTimestamp" });
  });
});

describe("deleteTask", () => {
  it("removes the doc from the store", async () => {
    __firestoreState.store.set("tasks/t1", { x: 1 });
    await deleteTask("t1");
    expect(__firestoreState.store.has("tasks/t1")).toBe(false);
    expect(__firestoreState.calls.map((c) => c.op)).toContain("deleteDoc");
  });
});

describe("getTask", () => {
  it("returns null when the doc is missing", async () => {
    const out = await getTask("missing");
    expect(out).toBeNull();
  });

  it("returns a Task shape when the doc exists", async () => {
    __firestoreState.store.set("tasks/t1", {
      type: "napad",
      title: "T",
      body: "",
      status: "Nápad",
      createdBy: "u1",
      createdAt: new Date("2026-04-01T00:00:00Z").toISOString(),
      updatedAt: new Date("2026-04-02T00:00:00Z").toISOString(),
    });
    const out = await getTask("t1");
    expect(out).not.toBeNull();
    expect(out!.id).toBe("t1");
    expect(out!.title).toBe("T");
  });
});

describe("convertNapadToOtazka", () => {
  it("batch-creates otazka + links it back on the source nápad", async () => {
    const source: Task = {
      id: "n1",
      type: "napad",
      title: "Renovace",
      body: "kuchyně",
      status: "Nápad",
      categoryId: "kitchen",
      locationId: "kuchyn",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      createdBy: "owner",
    } as Task;
    // Ensure the source doc exists in the store so the batch update lands on it.
    __firestoreState.store.set("tasks/n1", {
      title: source.title,
      body: source.body,
      linkedTaskIds: [],
    });

    const newId = await convertNapadToOtazka(source, "owner");

    // 1) new otazka doc exists, with the source id as parent link
    const newDoc = __firestoreState.store.get(`tasks/${newId}`) as Record<string, unknown>;
    expect(newDoc.type).toBe("otazka");
    expect(newDoc.title).toBe(source.title);
    expect(newDoc.linkedTaskId).toBe("n1");
    expect(newDoc.status).toBe("OPEN");

    // 2) source nápad was patched with linkedTaskIds + legacy linkedTaskId
    const src = __firestoreState.store.get("tasks/n1") as Record<string, unknown>;
    expect(src.linkedTaskIds).toEqual([newId]);
    expect(src.linkedTaskId).toBe(newId);

    // 3) both writes came through batch.*
    const ops = __firestoreState.calls.filter((c) => c.op.startsWith("batch."));
    expect(ops.length).toBe(2);
  });
});
