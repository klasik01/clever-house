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
  convertNapadToUkol,
} from "./tasks";
import type { Task } from "@/types";

beforeEach(() => __firestoreState.reset());

describe("createTask", () => {
  it("writes a task doc with owner uid, defaults + server timestamps", async () => {
    const id = await createTask(
      { type: "napad", title: "Mám nápad", body: "tady", status: "Nápad" },
      "owner-1",
      "OWNER",
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
      "OWNER",
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

    const newId = await convertNapadToOtazka(source, "owner", "OWNER");

    // 1) new otazka doc exists, with the source id as parent link.
    //    V12.1: title/body start empty — user fills the ask fresh.
    const newDoc = __firestoreState.store.get(`tasks/${newId}`) as Record<string, unknown>;
    expect(newDoc.type).toBe("otazka");
    expect(newDoc.title).toBe("");
    expect(newDoc.body).toBe("");
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

describe("createTask — V10 assigneeUid defaults", () => {
  it("new otazka gets the creator as assigneeUid (first solver)", async () => {
    const id = await createTask(
      { type: "otazka", title: "Kde umístit rozvaděč?", body: "", status: "OPEN" },
      "owner-1",
      "OWNER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.assigneeUid).toBe("owner-1");
  });

  it("new napad has no assignee (concept doesn't apply)", async () => {
    const id = await createTask(
      { type: "napad", title: "Rekonstrukce", body: "", status: "Nápad" },
      "owner-1",
      "OWNER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.assigneeUid).toBeNull();
  });
});

describe("convertNapadToOtazka — V10 defaults", () => {
  it("new úkol opens with status=OPEN and assigneeUid=creator", async () => {
    const source = {
      id: "n1",
      type: "napad" as const,
      title: "Zahrada",
      body: "",
      status: "Nápad" as const,
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
      createdBy: "someone",
    };
    __firestoreState.store.set("tasks/n1", { linkedTaskIds: [] });
    const newId = await convertNapadToOtazka(source, "converter", "OWNER");
    const doc = __firestoreState.store.get(`tasks/${newId}`) as Record<string, unknown>;
    expect(doc.status).toBe("OPEN");
    expect(doc.assigneeUid).toBe("converter");
  });
});

// ---------- V14 — ukol type + dependencyText + vystup + convertNapadToUkol ----------

describe("V14 — createTask ukol", () => {
  it("seeds ukol with creator as assignee (parallels otazka)", async () => {
    const id = await createTask(
      { type: "ukol", title: "Vyrobit kuchyň", body: "", status: "OPEN" },
      "owner-1",
      "OWNER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.type).toBe("ukol");
    expect(stored.assigneeUid).toBe("owner-1");
    expect(stored.status).toBe("OPEN");
  });

  it("napad still leaves assigneeUid null", async () => {
    const id = await createTask(
      { type: "napad", title: "N", body: "", status: "Nápad" },
      "owner-1",
      "OWNER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.assigneeUid).toBeNull();
  });
});

describe("V14 — updateTask whitelist allows dependencyText + vystup", () => {
  it("persists dependencyText patch", async () => {
    __firestoreState.store.set("tasks/u1", { title: "t", body: "b" });
    await updateTask("u1", { dependencyText: "před omítkami" });
    const merged = __firestoreState.store.get("tasks/u1") as Record<string, unknown>;
    expect(merged.dependencyText).toBe("před omítkami");
  });

  it("persists vystup patch (nápad resolution summary)", async () => {
    __firestoreState.store.set("tasks/n1", { title: "t", body: "b" });
    await updateTask("n1", { vystup: "Dohodnuto: Stiebel WPL 17" });
    const merged = __firestoreState.store.get("tasks/n1") as Record<string, unknown>;
    expect(merged.vystup).toBe("Dohodnuto: Stiebel WPL 17");
  });
});

describe("V14 — convertNapadToUkol", () => {
  it("creates type=ukol linked back to source, creator assigned", async () => {
    const src: Task = {
      id: "napad-1",
      type: "napad",
      title: "Topení",
      body: "myslim na TČ",
      status: "Nápad",
      categoryId: "c1",
      locationId: "l1",
      createdBy: "owner",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    __firestoreState.store.set("tasks/napad-1", { ...src });
    const newId = await convertNapadToUkol(src, "owner", "OWNER");
    const stored = __firestoreState.store.get(`tasks/${newId}`) as Record<string, unknown>;
    expect(stored.type).toBe("ukol");
    expect(stored.status).toBe("OPEN");
    expect(stored.assigneeUid).toBe("owner");
    expect(stored.linkedTaskId).toBe("napad-1");
    expect(stored.title).toBe("");
    expect(stored.body).toBe("");
    const parent = __firestoreState.store.get("tasks/napad-1") as Record<string, unknown>;
    expect(parent.linkedTaskIds).toContain(newId);
  });
});


// ---------- V17.1 — authorRole snapshot + role-aware assigneeUid defaults ----------

describe("createTask — V17.1 authorRole snapshot", () => {
  it("zapíše authorRole=OWNER při OWNER-create", async () => {
    const id = await createTask(
      { type: "otazka", title: "Q", body: "", status: "OPEN" },
      "owner-1",
      "OWNER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.authorRole).toBe("OWNER");
  });

  it("zapíše authorRole=PROJECT_MANAGER při PM-create", async () => {
    const id = await createTask(
      { type: "ukol", title: "Úkol", body: "", status: "OPEN" },
      "pm-1",
      "PROJECT_MANAGER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.authorRole).toBe("PROJECT_MANAGER");
  });

  it("V17.2 — PM vytvoří úkol unassigned (žádný self-assign)", async () => {
    const id = await createTask(
      { type: "ukol", title: "Úkol PM", body: "", status: "OPEN" },
      "pm-1",
      "PROJECT_MANAGER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.assigneeUid).toBeNull();
  });

  it("V17.2 — PM vytvoří otázku unassigned", async () => {
    const id = await createTask(
      { type: "otazka", title: "Q?", body: "", status: "OPEN" },
      "pm-1",
      "PROJECT_MANAGER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.assigneeUid).toBeNull();
  });

  it("OWNER vytvoří úkol self-assigned (beze změny od V10)", async () => {
    const id = await createTask(
      { type: "ukol", title: "Úkol OWNER", body: "", status: "OPEN" },
      "owner-1",
      "OWNER",
    );
    const stored = __firestoreState.store.get(`tasks/${id}`) as Record<string, unknown>;
    expect(stored.assigneeUid).toBe("owner-1");
  });
});

describe("convertNapadToOtazka / convertNapadToUkol — V17.1 authorRole + V17.2 assignee", () => {
  const source = {
    id: "n1",
    type: "napad" as const,
    title: "Zahrada",
    body: "",
    status: "Nápad" as const,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
    createdBy: "owner-orig",
  };

  it("OWNER převede napad na otazku → authorRole=OWNER, assignee=converter", async () => {
    __firestoreState.store.set("tasks/n1", { linkedTaskIds: [] });
    const newId = await convertNapadToOtazka(source, "owner-2", "OWNER");
    const doc = __firestoreState.store.get(`tasks/${newId}`) as Record<string, unknown>;
    expect(doc.authorRole).toBe("OWNER");
    expect(doc.assigneeUid).toBe("owner-2");
  });

  it("PM převede napad na otázku → authorRole=PM, assignee=null", async () => {
    __firestoreState.store.set("tasks/n1", { linkedTaskIds: [] });
    const newId = await convertNapadToOtazka(source, "pm-a", "PROJECT_MANAGER");
    const doc = __firestoreState.store.get(`tasks/${newId}`) as Record<string, unknown>;
    expect(doc.authorRole).toBe("PROJECT_MANAGER");
    expect(doc.assigneeUid).toBeNull();
  });

  it("PM převede napad na úkol → authorRole=PM, assignee=null", async () => {
    __firestoreState.store.set("tasks/n1", { linkedTaskIds: [] });
    const newId = await convertNapadToUkol(source, "pm-a", "PROJECT_MANAGER");
    const doc = __firestoreState.store.get(`tasks/${newId}`) as Record<string, unknown>;
    expect(doc.type).toBe("ukol");
    expect(doc.authorRole).toBe("PROJECT_MANAGER");
    expect(doc.assigneeUid).toBeNull();
  });
});

describe("fromDocSnap — V17.1 legacy authorRole fallback", () => {
  it("V17.8 — legacy task bez authorRole → field zůstává undefined (resolve je volající práce)", async () => {
    __firestoreState.store.set("tasks/legacy", {
      type: "napad",
      title: "Starý záznam",
      body: "",
      status: "Nápad",
      createdBy: "ancient",
      createdAt: "2025-06-01T00:00:00Z",
      updatedAt: "2025-06-01T00:00:00Z",
      // žádný authorRole field
    });
    const out = await getTask("legacy");
    expect(out?.authorRole).toBeUndefined();
  });

  it("task s explicitním authorRole=PROJECT_MANAGER se zachová", async () => {
    __firestoreState.store.set("tasks/pm-made", {
      type: "ukol",
      title: "PM úkol",
      body: "",
      status: "OPEN",
      createdBy: "pm-x",
      authorRole: "PROJECT_MANAGER",
      createdAt: "2026-04-20T00:00:00Z",
      updatedAt: "2026-04-20T00:00:00Z",
    });
    const out = await getTask("pm-made");
    expect(out?.authorRole).toBe("PROJECT_MANAGER");
  });

  it("V17.8 — unknown authorRole value (data corruption) → undefined (resolve job)", async () => {
    __firestoreState.store.set("tasks/bogus", {
      type: "napad",
      title: "T",
      body: "",
      status: "Nápad",
      createdBy: "u",
      authorRole: "ROBOT", // garbage
      createdAt: "2026-04-20T00:00:00Z",
      updatedAt: "2026-04-20T00:00:00Z",
    });
    const out = await getTask("bogus");
    expect(out?.authorRole).toBeUndefined();
  });
});
