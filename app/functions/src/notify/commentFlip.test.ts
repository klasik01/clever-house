import { describe, it, expect } from "vitest";
import {
  applyAssignedWithCommentOverride,
  isCommentBatchUpdate,
} from "./commentFlip";
import type { NotificationEventKey } from "./types";

describe("applyAssignedWithCommentOverride — V17.5", () => {
  function mkMap(entries: Array<[string, NotificationEventKey]>) {
    return new Map<string, NotificationEventKey>(entries);
  }

  it("přepíše event nového assignee na assigned_with_comment", () => {
    const m = mkMap([
      ["bob", "comment_on_mine"],
      ["alice", "comment_on_thread"],
    ]);
    const changed = applyAssignedWithCommentOverride(m, {
      priorAssigneeUid: "alice",
      assigneeAfter: "bob",
      actorUid: "me",
    });
    expect(changed).toBe("bob");
    expect(m.get("bob")).toBe("assigned_with_comment");
    // Alice (prior assignee) zůstává jak byla.
    expect(m.get("alice")).toBe("comment_on_thread");
  });

  it("přidá nového assignee do mapy i když v ní nebyl", () => {
    const m = mkMap([]);
    const changed = applyAssignedWithCommentOverride(m, {
      priorAssigneeUid: null,
      assigneeAfter: "bob",
      actorUid: "me",
    });
    expect(changed).toBe("bob");
    expect(m.get("bob")).toBe("assigned_with_comment");
  });

  it("vyhraje i nad @mention (nejvyšší dedupe priorita)", () => {
    const m = mkMap([["bob", "mention"]]);
    applyAssignedWithCommentOverride(m, {
      priorAssigneeUid: null,
      assigneeAfter: "bob",
      actorUid: "me",
    });
    expect(m.get("bob")).toBe("assigned_with_comment");
  });

  it("no-op když prior === after (žádný flip)", () => {
    const m = mkMap([["bob", "comment_on_mine"]]);
    const changed = applyAssignedWithCommentOverride(m, {
      priorAssigneeUid: "bob",
      assigneeAfter: "bob",
      actorUid: "me",
    });
    expect(changed).toBeNull();
    expect(m.get("bob")).toBe("comment_on_mine");
  });

  it("no-op když se assignee unassignuje (after=null)", () => {
    const m = mkMap([["bob", "comment_on_mine"]]);
    const changed = applyAssignedWithCommentOverride(m, {
      priorAssigneeUid: "bob",
      assigneeAfter: null,
      actorUid: "me",
    });
    expect(changed).toBeNull();
    expect(m.get("bob")).toBe("comment_on_mine");
  });

  it("no-op když actor přiřadí sám sobě (self-assign nedostane push)", () => {
    const m = mkMap([]);
    const changed = applyAssignedWithCommentOverride(m, {
      priorAssigneeUid: null,
      assigneeAfter: "me",
      actorUid: "me",
    });
    expect(changed).toBeNull();
    expect(m.has("me")).toBe(false);
  });

  it("funguje s undefined prior (legacy comments bez pole)", () => {
    const m = mkMap([["bob", "comment_on_thread"]]);
    const changed = applyAssignedWithCommentOverride(m, {
      priorAssigneeUid: undefined,
      assigneeAfter: "bob",
      actorUid: "me",
    });
    // null !== "bob" → flip
    expect(changed).toBe("bob");
    expect(m.get("bob")).toBe("assigned_with_comment");
  });
});

describe("isCommentBatchUpdate — V17.5 skip detection", () => {
  it("true když commentCount po > před", () => {
    expect(isCommentBatchUpdate({ beforeCommentCount: 3, afterCommentCount: 4 })).toBe(true);
  });
  it("false když commentCount se nemění (normální task update)", () => {
    expect(isCommentBatchUpdate({ beforeCommentCount: 3, afterCommentCount: 3 })).toBe(false);
  });
  it("false když commentCount klesá (delete komentu)", () => {
    expect(isCommentBatchUpdate({ beforeCommentCount: 3, afterCommentCount: 2 })).toBe(false);
  });
  it("funguje s missing/undefined fieldy", () => {
    // legacy task bez commentCount → before=0; new comment → after=1
    expect(isCommentBatchUpdate({ beforeCommentCount: undefined, afterCommentCount: 1 })).toBe(true);
    expect(isCommentBatchUpdate({ beforeCommentCount: 0, afterCommentCount: 0 })).toBe(false);
    expect(isCommentBatchUpdate({ beforeCommentCount: null, afterCommentCount: null })).toBe(false);
  });
});
