import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import { computeReactionDelta, createComment } from "./comments";

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

// ---------- V17.3/V17.5 — priorAssigneeUid + assigneeAfter v comment docu ----------

describe("createComment — V17.3 priorAssigneeUid snapshot", () => {
  it("obyčejný komentář (no flip) → priorAssigneeUid == assigneeAfter (current)", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "OPEN",
      assigneeUid: "alice",
    });

    const id = await createComment("t1", {
      authorUid: "me",
      body: "jen komentuju",
      priorAssigneeUid: "alice",
    });

    const stored = __firestoreState.store.get(`tasks/t1/comments/${id}`) as Record<
      string,
      unknown
    >;
    expect(stored.workflowAction).toBeNull();
    expect(stored.priorAssigneeUid).toBe("alice");
    // Fallback: bez workflow, assigneeAfter = priorAssigneeUid (stejný).
    expect(stored.assigneeAfter).toBe("alice");
  });

  it("flip komentář → priorAssigneeUid = starý, assigneeAfter = nový", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "OPEN",
      assigneeUid: "alice",
    });

    const id = await createComment("t1", {
      authorUid: "me",
      body: "předávám",
      priorAssigneeUid: "alice",
      workflow: { action: "flip", assigneeAfter: "bob" },
    });

    const stored = __firestoreState.store.get(`tasks/t1/comments/${id}`) as Record<
      string,
      unknown
    >;
    expect(stored.workflowAction).toBe("flip");
    expect(stored.priorAssigneeUid).toBe("alice");
    expect(stored.assigneeAfter).toBe("bob");

    // Zároveň updatnul task assigneeUid
    const parent = __firestoreState.store.get("tasks/t1") as Record<string, unknown>;
    expect(parent.assigneeUid).toBe("bob");
  });

  it("pokud task nemá assignee (null), prior je taky null a bez workflow i after null", async () => {
    __firestoreState.store.set("tasks/t1", {
      commentCount: 0,
      status: "OPEN",
      assigneeUid: null,
    });

    const id = await createComment("t1", {
      authorUid: "me",
      body: "komentář",
      priorAssigneeUid: null,
    });

    const stored = __firestoreState.store.get(`tasks/t1/comments/${id}`) as Record<
      string,
      unknown
    >;
    expect(stored.priorAssigneeUid).toBeNull();
    expect(stored.assigneeAfter).toBeNull();
  });

  it("bez priorAssigneeUid (legacy call, pole chybí) → null fallback", async () => {
    __firestoreState.store.set("tasks/t1", { commentCount: 0, status: "OPEN" });

    const id = await createComment("t1", {
      authorUid: "me",
      body: "x",
    });

    const stored = __firestoreState.store.get(`tasks/t1/comments/${id}`) as Record<
      string,
      unknown
    >;
    expect(stored.priorAssigneeUid).toBeNull();
  });
});


// V18-S32 — pure helper testy pro reaction toggle logiku.
describe("computeReactionDelta (pure)", () => {
  it("přidá uid pokud reactionu ještě nemá", () => {
    const next = computeReactionDelta({}, "👍", "alice");
    expect(next).toEqual({ "👍": ["alice"] });
  });

  it("přidá uid na konec existujícího listu", () => {
    const next = computeReactionDelta({ "👍": ["bob"] }, "👍", "alice");
    expect(next).toEqual({ "👍": ["bob", "alice"] });
  });

  it("odebere uid pokud už reactionu má (toggle off)", () => {
    const next = computeReactionDelta({ "👍": ["bob", "alice"] }, "👍", "alice");
    expect(next).toEqual({ "👍": ["bob"] });
  });

  it("smaže klíč emoji když je list prázdný", () => {
    const next = computeReactionDelta({ "👍": ["alice"] }, "👍", "alice");
    expect(next).not.toHaveProperty("👍");
    expect(next).toEqual({});
  });

  it("nezasahuje do jiných emoji", () => {
    const next = computeReactionDelta(
      { "👍": ["alice"], "❤️": ["bob"] },
      "👍",
      "alice",
    );
    expect(next).toEqual({ "❤️": ["bob"] });
  });

  it("undefined input → empty + add", () => {
    expect(computeReactionDelta(undefined, "🎉", "alice")).toEqual({
      "🎉": ["alice"],
    });
  });

  it("null input → empty + add", () => {
    expect(computeReactionDelta(null, "🎉", "alice")).toEqual({
      "🎉": ["alice"],
    });
  });

  it("idempotent — toggle 2× vrátí original", () => {
    const initial = { "👍": ["bob"] };
    const after1 = computeReactionDelta(initial, "👍", "alice");
    expect(after1).toEqual({ "👍": ["bob", "alice"] });
    const after2 = computeReactionDelta(after1, "👍", "alice");
    expect(after2).toEqual({ "👍": ["bob"] });
  });

  it("nemodifikuje vstupní objekt (immutable)", () => {
    const input = { "👍": ["bob"] };
    computeReactionDelta(input, "👍", "alice");
    expect(input).toEqual({ "👍": ["bob"] });
  });
});
