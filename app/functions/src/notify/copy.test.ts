import { describe, it, expect } from "vitest";
import {
  commentPreview,
  renderPayload,
  taskTitleOrFallback,
  truncate,
} from "./copy";
import type { NotifyInput } from "./types";

function baseInput(override: Partial<NotifyInput> = {}): NotifyInput {
  return {
    eventType: "assigned",
    actorUid: "actor",
    actorName: "Stanislav",
    recipientUid: "recipient",
    taskId: "task-1",
    task: { type: "otazka", title: "Topení", body: "", createdBy: "actor" },
    ...override,
  };
}

describe("truncate", () => {
  it("returns the string untouched when under the limit", () => {
    expect(truncate("ahoj", 10)).toBe("ahoj");
  });
  it("adds ellipsis when over the limit", () => {
    expect(truncate("ahoj světe", 5)).toBe("ahoj…");
  });
  it("trims trailing whitespace before the ellipsis", () => {
    expect(truncate("a b c   ", 5)).toBe("a b…");
  });
});

describe("taskTitleOrFallback", () => {
  it("uses title when present", () => {
    expect(taskTitleOrFallback("Kuchyň", "body")).toBe("Kuchyň");
  });
  it("falls back to first line of body when title is blank", () => {
    expect(taskTitleOrFallback("", "první řádek\ndruhý")).toBe("první řádek");
  });
  it("truncates long body-fallback to 60 chars", () => {
    const longLine = "x".repeat(100);
    const out = taskTitleOrFallback("", longLine);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("…")).toBe(true);
  });
  it("returns a localized placeholder when both are empty", () => {
    expect(taskTitleOrFallback("", "")).toBe("[bez názvu]");
    expect(taskTitleOrFallback(null, null)).toBe("[bez názvu]");
  });
});

describe("commentPreview", () => {
  it("takes first sentence when multiple exist", () => {
    expect(commentPreview("Ahoj. Co říkáš?")).toBe("Ahoj");
  });
  it("splits on newlines too", () => {
    expect(commentPreview("první\ndruhý")).toBe("první");
  });
  it("truncates long sentences", () => {
    const long = "a".repeat(200);
    const out = commentPreview(long);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("renderPayload — per-event copy", () => {
  it("assigned — mentions actor + task title in title", () => {
    const { title, body } = renderPayload(baseInput({ eventType: "assigned" }));
    expect(title).toContain("Stanislav");
    expect(title).toContain("přiřadil");
    expect(body).toContain("Topení");
  });

  it("comment_on_mine — actor + truncated title in title, comment body in body", () => {
    const { title, body } = renderPayload(
      baseInput({
        eventType: "comment_on_mine",
        comment: { authorUid: "actor", body: "Tohle by chtělo vyřešit dnes." },
      }),
    );
    expect(title.startsWith("Stanislav komentoval")).toBe(true);
    // commentPreview only splits on ". " (with trailing space) / "? " / "! ";
    // a lone terminal period at end-of-string stays. Fine — it reads natural.
    expect(body).toBe("Tohle by chtělo vyřešit dnes.");
  });

  it("comment_on_thread — title says 'v diskuzi'", () => {
    const { title } = renderPayload(
      baseInput({
        eventType: "comment_on_thread",
        comment: { authorUid: "actor", body: "ok" },
      }),
    );
    expect(title).toContain("v diskuzi");
  });

  it("mention — title says 'zmínil'", () => {
    const { title, body } = renderPayload(
      baseInput({
        eventType: "mention",
        comment: { authorUid: "actor", body: "co na to říkáš?" },
      }),
    );
    expect(title).toContain("zmínil");
    expect(body).toBe("co na to říkáš?");
  });

  it("shared_with_pm — uses task body as preview", () => {
    const { title, body } = renderPayload(
      baseInput({
        eventType: "shared_with_pm",
        task: {
          type: "napad",
          title: "Topení",
          body: "Rozhoduji se mezi TČ a plynem.",
          createdBy: "actor",
        },
      }),
    );
    expect(title).toContain("sdílený nápad");
    expect(body).toContain("TČ");
  });

  it("falls back to [bez názvu] when task has neither title nor body", () => {
    // "assigned" payload puts the task title in the body ("{title} — otevři
    // a pojď do toho"), not in the title (which is actor-only).
    const { body } = renderPayload(
      baseInput({
        eventType: "assigned",
        task: { type: "otazka", title: "", body: "", createdBy: "actor" },
      }),
    );
    expect(body).toContain("[bez názvu]");
  });
});
