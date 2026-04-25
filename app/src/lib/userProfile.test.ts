import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import {
  markOnboardingCompleted,
  updateUserContactEmail,
  updateUserDisplayName,
} from "./userProfile";

beforeEach(() => __firestoreState.reset());

describe("updateUserDisplayName", () => {
  it("zapíše trim()-nutý string", async () => {
    __firestoreState.store.set("users/u1", { uid: "u1", role: "OWNER" });
    await updateUserDisplayName("u1", "  Stáňa  ");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.displayName).toBe("Stáňa");
  });

  it("prázdný string → null (clear field)", async () => {
    __firestoreState.store.set("users/u1", {
      uid: "u1",
      role: "OWNER",
      displayName: "Old",
    });
    await updateUserDisplayName("u1", "");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.displayName).toBeNull();
  });

  it("whitespace-only → null", async () => {
    __firestoreState.store.set("users/u1", { uid: "u1", role: "OWNER" });
    await updateUserDisplayName("u1", "   ");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.displayName).toBeNull();
  });
});

describe("updateUserContactEmail", () => {
  it("zapíše trim()-nutý email", async () => {
    __firestoreState.store.set("users/u1", { uid: "u1", role: "OWNER" });
    await updateUserContactEmail("u1", "  stana@icloud.com  ");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.contactEmail).toBe("stana@icloud.com");
  });

  it("prázdný string → null (clear)", async () => {
    __firestoreState.store.set("users/u1", {
      uid: "u1",
      role: "OWNER",
      contactEmail: "old@x.cz",
    });
    await updateUserContactEmail("u1", "");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.contactEmail).toBeNull();
  });

  it("formát se nevaliduje na téhle vrstvě (caller hlídá)", async () => {
    __firestoreState.store.set("users/u1", { uid: "u1", role: "OWNER" });
    // Ne-validní email (žádný @) projde — UI vrstva je primary gate.
    await updateUserContactEmail("u1", "not-an-email");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.contactEmail).toBe("not-an-email");
  });
});

describe("markOnboardingCompleted", () => {
  it("zapíše ISO timestamp", async () => {
    __firestoreState.store.set("users/u1", { uid: "u1", role: "OWNER" });
    await markOnboardingCompleted("u1");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(typeof stored.onboardingCompletedAt).toBe("string");
    expect(stored.onboardingCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("idempotent — druhé volání jen aktualizuje timestamp", async () => {
    __firestoreState.store.set("users/u1", {
      uid: "u1",
      role: "OWNER",
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    });
    await markOnboardingCompleted("u1");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.onboardingCompletedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });
});
