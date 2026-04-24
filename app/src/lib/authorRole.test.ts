import { describe, it, expect } from "vitest";
import { resolveAuthorRole } from "./authorRole";
import type { UserProfile } from "@/types";

function users(
  entries: Array<[string, Pick<UserProfile, "role">]>,
): Map<string, Pick<UserProfile, "role">> {
  return new Map(entries);
}

describe("resolveAuthorRole — V17.8", () => {
  it("task.authorRole má vždy přednost", () => {
    const r = resolveAuthorRole({
      task: { createdBy: "pm-1", authorRole: "PROJECT_MANAGER" },
      usersByUid: users([["pm-1", { role: "OWNER" }]]), // úmyslně rozporné
    });
    // Task říká PM → věříme snapshotu, ignorujeme current role.
    expect(r).toBe("PROJECT_MANAGER");
  });

  it("pokud chybí task.authorRole, lookne se user.role", () => {
    const r = resolveAuthorRole({
      task: { createdBy: "pm-1" },
      usersByUid: users([["pm-1", { role: "PROJECT_MANAGER" }]]),
    });
    expect(r).toBe("PROJECT_MANAGER");
  });

  it("chybí task.authorRole a user neznámý → undefined", () => {
    const r = resolveAuthorRole({
      task: { createdBy: "ghost" },
      usersByUid: users([]),
    });
    expect(r).toBeUndefined();
  });

  it("chybí task.authorRole a user.role = garbage → undefined", () => {
    const r = resolveAuthorRole({
      task: { createdBy: "uid-x" },
      usersByUid: users([["uid-x", { role: "ROBOT" as unknown as UserProfile["role"] }]]),
    });
    expect(r).toBeUndefined();
  });

  it("task.authorRole = garbage → spadne na user lookup", () => {
    const r = resolveAuthorRole({
      task: {
        createdBy: "owner-1",
        authorRole: "BANANA" as unknown as UserProfile["role"],
      },
      usersByUid: users([["owner-1", { role: "OWNER" }]]),
    });
    expect(r).toBe("OWNER");
  });

  it("legacy task OWNER-created bez field → resolve přes users", () => {
    const r = resolveAuthorRole({
      task: { createdBy: "owner-spouse" },
      usersByUid: users([["owner-spouse", { role: "OWNER" }]]),
    });
    expect(r).toBe("OWNER");
  });
});
