import { describe, it, expect } from "vitest";
import { parseDomain, normalizeUrl } from "./links";

describe("parseDomain", () => {
  it("strips leading www.", () => {
    expect(parseDomain("https://www.example.com/x")).toBe("example.com");
  });

  it("returns hostname verbatim when no www.", () => {
    expect(parseDomain("https://api.example.com/v1")).toBe("api.example.com");
  });

  it("returns null for non-URL input", () => {
    expect(parseDomain("not a url")).toBeNull();
    expect(parseDomain("")).toBeNull();
  });
});

describe("normalizeUrl", () => {
  it("prepends https:// when no scheme", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });

  it("keeps existing http:// scheme", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("keeps existing https:// scheme", () => {
    expect(normalizeUrl("https://example.com/a/b")).toBe("https://example.com/a/b");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com/");
  });

  it("rejects empty / whitespace-only input", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
  });

  it("rejects hostnames without a dot (no TLD)", () => {
    expect(normalizeUrl("localhost")).toBeNull();
    expect(normalizeUrl("intranet")).toBeNull();
  });

  it("preserves query + hash", () => {
    expect(normalizeUrl("example.com/page?x=1#top"))
      .toBe("https://example.com/page?x=1#top");
  });
});
