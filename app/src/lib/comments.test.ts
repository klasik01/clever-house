import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import { createComment } from "./comments";

beforeEach(() => __firestoreState.reset());

describe("createComment — no workflow", () => {
  it("writes a comment doc + increments parent commentCount atomically via batch", async () => {
    __firestoreState.store.set("tasks/t1", { commentCount: 2, status: "Otázka" });

    const commentId = await createComment("t1", {
      authorUid: "owner",
      body: "hi",
      attachmentImages: [],
      attachmentLinks: [],
      mentionedUids: [],
    });

    // Comment doc written under subcollection
    const commentPath = `tasks/t1/comments/${commentId}`;
    const stored = __firestoreState.store.get(commentPath);
    expect(stored).toMatchObject({
      authorUid: "owner",
      body: "hi",
      workflowAction: null,
      statusAfter: null,
      assigneeAfter: null,
    });

    // Parent task: commentCount++ via increment sentinel applied by mock
    const parent = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(parent.commentCount).toBe(3);
    // Status untouched when no workflow
    expect(parent.status).toBe("Otázka");

    // Both writes happened inside a single batch
    const batchCalls = __firestoreState.calls.filter((c) => c.op.startsWith("batch."));
    expect(batchCalls.length).toBe(2);
  });
});

describe("createComment — workflow: flip", () => {
  it("updates task.status to the flip target + commentCount++", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "ON_PM_SITE",
      assigneeUid: "pm-1",
    });

    const id = await createComment("t1", {
      authorUid: "pm-1",
      body: "done thinking",
      workflow: {
        action: "flip",
        statusAfter: "ON_CLIENT_SITE",
      },
    });

    const c = __firestoreState.store.get(`tasks/t1/comments/${id}`) as Record<string, unknown>;
    expect(c.workflowAction).toBe("flip");
    expect(c.statusAfter).toBe("ON_CLIENT_SITE");

    const t = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(t.status).toBe("ON_CLIENT_SITE");
    expect(t.commentCount).toBe(1);
    // assigneeUid untouched when assigneeAfter not provided (V5 behaviour)
    expect(t.assigneeUid).toBe("pm-1");
  });

  it("explicit assigneeAfter overrides the preserved assignee", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "Otázka",
      assigneeUid: "pm-1",
    });
    await createComment("t1", {
      authorUid: "owner",
      body: "handing off",
      workflow: {
        action: "flip",
        statusAfter: "ON_PM_SITE",
        assigneeAfter: "pm-2",
      },
    });
    const t = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(t.assigneeUid).toBe("pm-2");
  });

  it("passing assigneeAfter=null explicitly clears the assignee", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "Otázka",
      assigneeUid: "pm-1",
    });
    await createComment("t1", {
      authorUid: "owner",
      body: "unclaimed",
      workflow: {
        action: "flip",
        statusAfter: "ON_PM_SITE",
        assigneeAfter: null,
      },
    });
    const t = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(t.assigneeUid).toBeNull();
  });
});

describe("createComment — workflow: close", () => {
  it("sets statusAfter to DONE and does not touch assigneeUid", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "ON_PM_SITE",
      assigneeUid: "pm-1",
    });
    await createComment("t1", {
      authorUid: "owner",
      body: "resolved, thanks",
      workflow: { action: "close", statusAfter: "DONE" },
    });
    const t = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(t.status).toBe("DONE");
    expect(t.assigneeUid).toBe("pm-1"); // untouched on close
  });
});
