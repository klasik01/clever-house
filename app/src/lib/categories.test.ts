import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import {
  createCategory,
  renameCategory,
  deleteCategory,
  seedCategoriesIfEmpty,
} from "./categories";

beforeEach(() => __firestoreState.reset());

describe("createCategory", () => {
  it("writes a new doc with the trimmed label + createdBy", async () => {
    const id = await createCategory("  Elektro  ", "owner");
    const doc = __firestoreState.store.get(`categories/${id}`) as Record<string, unknown>;
    expect(doc.label).toBe("Elektro");
    expect(doc.createdBy).toBe("owner");
    expect(doc.createdAt).toEqual({ __sentinel: "serverTimestamp" });
  });

  it("rejects empty label", async () => {
    await expect(createCategory("   ", "owner")).rejects.toThrow();
  });
});

describe("renameCategory", () => {
  it("updates only label, trimmed", async () => {
    __firestoreState.store.set("categories/c1", { label: "Old", createdBy: "u" });
    await renameCategory("c1", "  New  ");
    const doc = __firestoreState.store.get("categories/c1") as Record<string, unknown>;
    expect(doc.label).toBe("New");
    expect(doc.createdBy).toBe("u");
  });

  it("rejects empty label", async () => {
    await expect(renameCategory("c1", "  ")).rejects.toThrow();
  });
});

describe("deleteCategory", () => {
  it("removes the doc (no cascade on tasks — documented behaviour)", async () => {
    __firestoreState.store.set("categories/c1", { label: "X" });
    __firestoreState.store.set("tasks/t1", { categoryId: "c1", title: "dangling" });
    await deleteCategory("c1");
    expect(__firestoreState.store.has("categories/c1")).toBe(false);
    // Tasks keep their (now-dangling) pointer; UI resolves it to "unknown".
    expect(
      (__firestoreState.store.get("tasks/t1") as Record<string, unknown>).categoryId,
    ).toBe("c1");
  });
});

describe("seedCategoriesIfEmpty", () => {
  it("seeds defaults when the collection is empty", async () => {
    await seedCategoriesIfEmpty("owner");
    // Count the docs whose key starts with "categories/"
    const docs = Array.from(__firestoreState.store.keys()).filter((k) =>
      k.startsWith("categories/"),
    );
    expect(docs.length).toBeGreaterThanOrEqual(10);
  });

  it("is idempotent — no re-seed if the collection already has a doc", async () => {
    __firestoreState.store.set("categories/existing", { label: "Mine" });
    await seedCategoriesIfEmpty("owner");
    const docs = Array.from(__firestoreState.store.keys()).filter((k) =>
      k.startsWith("categories/"),
    );
    expect(docs).toEqual(["categories/existing"]);
  });
});
