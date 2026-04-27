import { describe, it, expect } from "vitest";
import { resolveUserName, type NameInput } from "./names";

describe("resolveUserName", () => {
  it("returns profileDisplayName when present", () => {
    const input: NameInput = {
      profileDisplayName: "Stáňa",
      authDisplayName: "Google Name",
      email: "stana@example.com",
      uid: "abc123",
    };
    expect(resolveUserName(input)).toBe("Stáňa");
  });

  it("falls back to authDisplayName when profile is empty", () => {
    expect(
      resolveUserName({
        profileDisplayName: "",
        authDisplayName: "Google Name",
        email: "x@y.com",
        uid: "abc123",
      }),
    ).toBe("Google Name");
  });

  it("falls back to authDisplayName when profile is null", () => {
    expect(
      resolveUserName({
        profileDisplayName: null,
        authDisplayName: "Auth",
        email: "x@y.com",
      }),
    ).toBe("Auth");
  });

  it("falls back to email local-part when auth is missing", () => {
    expect(
      resolveUserName({
        profileDisplayName: null,
        authDisplayName: null,
        email: "jan.novak@gmail.com",
        uid: "xyz789",
      }),
    ).toBe("jan.novak");
  });

  it("falls back to truncated uid when email is missing", () => {
    expect(
      resolveUserName({
        email: null,
        uid: "abcdef123456",
      }),
    ).toBe("abcdef");
  });

  it("returns dash when everything is missing", () => {
    expect(resolveUserName({})).toBe("—");
  });

  it("returns dash when all fields are null", () => {
    expect(
      resolveUserName({
        profileDisplayName: null,
        authDisplayName: null,
        email: null,
        uid: null,
      }),
    ).toBe("—");
  });

  it("trims whitespace from profileDisplayName", () => {
    expect(resolveUserName({ profileDisplayName: "  Stáňa  " })).toBe("Stáňa");
  });

  it("skips whitespace-only profileDisplayName", () => {
    expect(
      resolveUserName({ profileDisplayName: "   ", authDisplayName: "Auth" }),
    ).toBe("Auth");
  });

  it("handles email without local part (edge case)", () => {
    // "@domain.com" — local part is empty string
    expect(
      resolveUserName({ email: "@domain.com", uid: "abc123" }),
    ).toBe("abc123".slice(0, 6));
  });

  it("handles short uid (< 6 chars)", () => {
    expect(resolveUserName({ uid: "ab" })).toBe("ab");
  });
});
