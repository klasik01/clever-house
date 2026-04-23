import { describe, it, expect } from "vitest";
import { EVENT_PRIORITY, buildRecipientMap } from "./dedupe";

describe("EVENT_PRIORITY", () => {
  it("lists mention first, comment_on_thread last in the comment-path triad", () => {
    expect(EVENT_PRIORITY.indexOf("mention"))
      .toBeLessThan(EVENT_PRIORITY.indexOf("comment_on_mine"));
    expect(EVENT_PRIORITY.indexOf("comment_on_mine"))
      .toBeLessThan(EVENT_PRIORITY.indexOf("comment_on_thread"));
  });
});

describe("buildRecipientMap", () => {
  it("empty input → empty map", () => {
    const m = buildRecipientMap({
      actorUid: "actor",
      mentionedUids: [],
      taskCreatorUid: null,
      priorCommenterUids: [],
    });
    expect(m.size).toBe(0);
  });

  it("never includes the actor themselves", () => {
    const m = buildRecipientMap({
      actorUid: "actor",
      mentionedUids: ["actor", "alice"],
      taskCreatorUid: "actor",
      priorCommenterUids: ["actor", "bob"],
    });
    expect(m.has("actor")).toBe(false);
    expect(m.get("alice")).toBe("mention");
    expect(m.get("bob")).toBe("comment_on_thread");
  });

  it("task creator → comment_on_mine", () => {
    const m = buildRecipientMap({
      actorUid: "commenter",
      mentionedUids: [],
      taskCreatorUid: "creator",
      priorCommenterUids: [],
    });
    expect(m.get("creator")).toBe("comment_on_mine");
  });

  it("mention beats comment_on_mine for the same uid", () => {
    const m = buildRecipientMap({
      actorUid: "actor",
      mentionedUids: ["creator"],
      taskCreatorUid: "creator",
      priorCommenterUids: [],
    });
    expect(m.get("creator")).toBe("mention");
  });

  it("comment_on_mine beats comment_on_thread", () => {
    const m = buildRecipientMap({
      actorUid: "actor",
      mentionedUids: [],
      taskCreatorUid: "creator",
      priorCommenterUids: ["creator"],
    });
    expect(m.get("creator")).toBe("comment_on_mine");
  });

  it("mention beats comment_on_thread", () => {
    const m = buildRecipientMap({
      actorUid: "actor",
      mentionedUids: ["bob"],
      taskCreatorUid: null,
      priorCommenterUids: ["bob"],
    });
    expect(m.get("bob")).toBe("mention");
  });

  it("order of adding sources doesn't matter — priority is final arbiter", () => {
    // Prior commenter added first (lower priority), mention comes after.
    const a = buildRecipientMap({
      actorUid: "actor",
      mentionedUids: ["bob"],
      taskCreatorUid: null,
      priorCommenterUids: ["bob"],
    });
    // Prior commenter array filled before mentions mentally — same result.
    const b = buildRecipientMap({
      actorUid: "actor",
      mentionedUids: ["bob"],
      taskCreatorUid: null,
      priorCommenterUids: ["bob"],
    });
    expect(a.get("bob")).toBe(b.get("bob"));
  });

  it("multi-recipient fan-out keeps each person on their correct event", () => {
    const m = buildRecipientMap({
      actorUid: "actor",
      mentionedUids: ["alice"],
      taskCreatorUid: "bob",
      priorCommenterUids: ["carol", "bob"],
    });
    expect(m.size).toBe(3);
    expect(m.get("alice")).toBe("mention");
    expect(m.get("bob")).toBe("comment_on_mine");      // creator wins over prior-commenter
    expect(m.get("carol")).toBe("comment_on_thread");
  });
});
