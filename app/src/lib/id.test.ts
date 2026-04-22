import { describe, it, expect } from "vitest";
import { newId } from "./id";

describe("newId", () => {
  it("returns a non-empty string", () => {
    expect(newId().length).toBeGreaterThan(0);
  });

  it("generates unique ids across many calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(newId());
    expect(set.size).toBe(1000);
  });

  it("ids are base36 only (letters a-z + digits)", () => {
    for (let i = 0; i < 50; i++) {
      expect(newId()).toMatch(/^[0-9a-z]+$/);
    }
  });
});
