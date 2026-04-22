import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import { createComment } from "./comments";

beforeEach(() => __firestoreState.reset());

describe("createComment — no workflow", () => {
  it("writes a comment doc + bumps commentCount atomically", async () => {
    __firestoreState.store.set("tasks/t1", { commentCount: 2, status: "OPEN" });

    const id = await createComment("t1", {
      authorUid: "owner",
      body: "hi",
      attachmentImages: [],
      attachmentLinks: [],
      mentionedUids: [],
    });

    const stored = __firestoreState.store.get(`tasks/t1/comments/${id}`);
    expect(stored).toMatchObject({
      authorUid: "owner",
      body: "hi",
      workflowAction: null,
      statusAfter: null,
      assigneeAfter: null,
    });

    const parent = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(parent.commentCount).toBe(3);
    expect(parent.status).toBe("OPEN");
  });
});

describe("createComment — V10 workflow: flip (assignee only)", () => {
  it("updates task.assigneeUid without touching status", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "OPEN",
      assigneeUid: "me",
    });

    await createComment("t1", {
      authorUid: "me",
      body: "handing off",
      workflow: { action: "flip", assigneeAfter: "peer" },
    });

    const t = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(t.status).toBe("OPEN");
    expect(t.assigneeUid).toBe("peer");
    expect(t.commentCount).toBe(1);
  });

  it("flip without assigneeAfter leaves assignee untouched", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "OPEN",
      assigneeUid: "me",
    });
    await createComment("t1", {
      authorUid: "me",
      body: "nothing really",
      workflow: { action: "flip" },
    });
    const t = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(t.assigneeUid).toBe("me");
  });
});

describe("createComment — workflow: close", () => {
  it("sets statusAfter to DONE and does not touch assigneeUid", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "OPEN",
      assigneeUid: "me",
    });
    await createComment("t1", {
      authorUid: "owner",
      body: "resolved, thanks",
      workflow: { action: "close", statusAfter: "DONE" },
    });
    const t = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(t.status).toBe("DONE");
    expect(t.assigneeUid).toBe("me");
  });
});
