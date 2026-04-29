import { describe, it, expect } from "vitest";
import {
  parseMentions,
  extractMentionedUids,
  detectActiveMention,
  insertMention,
  filterUsersForMention,
  splitBodyByMentions,
} from "./mentions";
import type { UserProfile } from "@/types";

const u = (uid: string, name?: string, email?: string): UserProfile => ({
  uid,
  email: email ?? `${uid}@example.com`,
  role: "OWNER",
  displayName: name ?? null,
});

describe("parseMentions", () => {
  it("parses zero mentions from plain text", () => {
    expect(parseMentions("just some text")).toEqual([]);
  });

  it("extracts one mention with exact indices", () => {
    const body = "hello @[Klasik](abc-123) there";
    const [m] = parseMentions(body);
    expect(m).toMatchObject({
      displayName: "Klasik",
      uid: "abc-123",
      start: 6,
    });
    expect(m.fullMatch).toBe("@[Klasik](abc-123)");
    expect(body.slice(m.start, m.end)).toBe(m.fullMatch);
  });

  it("parses multiple mentions and keeps order", () => {
    const body = "@[A](a) and @[B](b)";
    const ms = parseMentions(body);
    expect(ms.map((m) => m.uid)).toEqual(["a", "b"]);
  });
});

describe("extractMentionedUids", () => {
  it("returns a de-duplicated list", () => {
    const body = "@[Foo](u1) hi @[Foo](u1) and @[Bar](u2)";
    expect(extractMentionedUids(body)).toEqual(["u1", "u2"]);
  });

  it("empty on plain body", () => {
    expect(extractMentionedUids("nothing here")).toEqual([]);
  });
});

describe("detectActiveMention", () => {
  it("detects @ at start of body", () => {
    expect(detectActiveMention("@", 1)).toEqual({ text: "", start: 0, end: 1 });
    expect(detectActiveMention("@jo", 3)).toEqual({ text: "jo", start: 0, end: 3 });
  });

  it("detects @ preceded by whitespace", () => {
    const body = "hi @kl";
    expect(detectActiveMention(body, body.length)).toEqual({
      text: "kl",
      start: 3,
      end: 6,
    });
  });

  it("does NOT detect @ preceded by a word character (email-like)", () => {
    expect(detectActiveMention("foo@ja", 6)).toBeNull();
  });

  it("null when caret has already passed a space", () => {
    expect(detectActiveMention("@john ", 6)).toBeNull();
  });

  it("null for non-word chars in the query", () => {
    expect(detectActiveMention("@j!", 3)).toBeNull();
  });

  it("null when caret is out of range", () => {
    expect(detectActiveMention("@j", -1)).toBeNull();
    expect(detectActiveMention("@j", 99)).toBeNull();
  });
});

describe("insertMention", () => {
  it("replaces the active query with a full mention token + trailing space", () => {
    const body = "hi @kl";
    const q = { start: 3, end: 6 };
    const { body: next, cursor } = insertMention(body, q, u("u-1", "Klasik"));
    // V25-fix — clean storage `@Name ` (uid se neposílá v body, jen v
    //   `mentionedUids` field na komentu).
    expect(next).toBe("hi @Klasik ");
    expect(cursor).toBe(next.length);
  });

  it("falls back to email local part when displayName is blank", () => {
    const { body } = insertMention("@", { start: 0, end: 1 }, u("u-2", "", "alice@x.com"));
    expect(body).toBe("@alice ");
  });

  it("final fallback \"user\" when both name + email are empty", () => {
    const { body } = insertMention(
      "@",
      { start: 0, end: 1 },
      { uid: "u-3", email: "", role: "OWNER", displayName: null },
    );
    expect(body).toBe("@user ");
  });
});

describe("filterUsersForMention", () => {
  const users = [
    u("1", "Alice Smith", "alice@example.com"),
    u("2", "Bob Jones", "bob@example.com"),
    u("3", "", "carol@example.com"),
  ];

  it("empty query returns all (up to limit)", () => {
    expect(filterUsersForMention(users, "")).toHaveLength(3);
    expect(filterUsersForMention(users, "  ")).toHaveLength(3);
  });

  it("matches against displayName case-insensitively", () => {
    expect(filterUsersForMention(users, "alice").map((x) => x.uid)).toEqual(["1"]);
    expect(filterUsersForMention(users, "ALICE").map((x) => x.uid)).toEqual(["1"]);
  });

  it("matches against email local part", () => {
    expect(filterUsersForMention(users, "carol").map((x) => x.uid)).toEqual(["3"]);
  });

  it("applies limit", () => {
    expect(filterUsersForMention(users, "", 2)).toHaveLength(2);
  });
});

describe("splitBodyByMentions", () => {
  it("returns a single text part for plain body", () => {
    expect(splitBodyByMentions("plain")).toEqual([{ kind: "text", text: "plain" }]);
  });

  it("interleaves text + mention nodes in document order", () => {
    const parts = splitBodyByMentions("hi @[A](a) there @[B](b)!");
    expect(parts).toEqual([
      { kind: "text", text: "hi " },
      { kind: "mention", uid: "a", displayName: "A" },
      { kind: "text", text: " there " },
      { kind: "mention", uid: "b", displayName: "B" },
      { kind: "text", text: "!" },
    ]);
  });

  it("handles mention at start + end of body", () => {
    expect(splitBodyByMentions("@[A](a)end")).toEqual([
      { kind: "mention", uid: "a", displayName: "A" },
      { kind: "text", text: "end" },
    ]);
    expect(splitBodyByMentions("start@[A](a)")).toEqual([
      { kind: "text", text: "start" },
      { kind: "mention", uid: "a", displayName: "A" },
    ]);
  });
});
