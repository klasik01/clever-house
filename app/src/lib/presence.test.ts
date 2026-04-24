import { describe, it, expect } from "vitest";
import { taskIdFromPath, shouldAutoReadOnPath } from "./presence";

describe("taskIdFromPath", () => {
  it("extracts id ze základního /t/{id}", () => {
    expect(taskIdFromPath("/t/abc123")).toBe("abc123");
  });
  it("extracts id i s trailing slashem", () => {
    expect(taskIdFromPath("/t/abc123/")).toBe("abc123");
  });
  it("extracts id i s #comment- fragmentem", () => {
    expect(taskIdFromPath("/t/abc123#comment-xyz")).toBe("abc123");
  });
  it("extracts id i s query stringem", () => {
    expect(taskIdFromPath("/t/abc123?foo=bar")).toBe("abc123");
  });
  it("funguje i pro base-path prefix (GitHub Pages /clever-house/t/abc123)", () => {
    expect(taskIdFromPath("/clever-house/t/abc123")).toBe("abc123");
  });
  it("null pro ne-detail routes", () => {
    expect(taskIdFromPath("/zaznamy")).toBeNull();
    expect(taskIdFromPath("/ukoly")).toBeNull();
    expect(taskIdFromPath("/nastaveni")).toBeNull();
    expect(taskIdFromPath("/")).toBeNull();
  });
  it("null pro malformed path /t/", () => {
    expect(taskIdFromPath("/t/")).toBeNull();
  });
});

describe("shouldAutoReadOnPath", () => {
  it("true když jsem na detailu matching tasku", () => {
    expect(shouldAutoReadOnPath("/t/abc", "abc")).toBe(true);
  });
  it("false když jsem na detailu jiného tasku", () => {
    expect(shouldAutoReadOnPath("/t/abc", "xyz")).toBe(false);
  });
  it("false na listing stránce", () => {
    expect(shouldAutoReadOnPath("/zaznamy", "abc")).toBe(false);
  });
  it("true i s comment-fragmentem", () => {
    expect(shouldAutoReadOnPath("/t/abc#comment-42", "abc")).toBe(true);
  });
});
