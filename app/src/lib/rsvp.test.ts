import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import { clearRsvp, setRsvp } from "./rsvp";

beforeEach(() => __firestoreState.reset());

describe("setRsvp", () => {
  it("zapíše response yes + serverTimestamp", async () => {
    await setRsvp("event-1", "user-a", "yes");
    const stored = __firestoreState.store.get("events/event-1/rsvps/user-a") as Record<string, unknown>;
    expect(stored.response).toBe("yes");
    expect(stored.respondedAt).toEqual({ __sentinel: "serverTimestamp" });
  });

  it("zapíše response no", async () => {
    await setRsvp("event-1", "user-a", "no");
    const stored = __firestoreState.store.get("events/event-1/rsvps/user-a") as Record<string, unknown>;
    expect(stored.response).toBe("no");
  });

  it("doc id = uid (guarantuje 1 záznam per user)", async () => {
    await setRsvp("event-1", "user-a", "yes");
    await setRsvp("event-1", "user-a", "no"); // override
    const stored = __firestoreState.store.get("events/event-1/rsvps/user-a") as Record<string, unknown>;
    expect(stored.response).toBe("no");
    // Žádný "user-a-2" doc — id zůstává stejné
    const allKeys = Array.from(__firestoreState.store.keys()).filter((k) =>
      k.startsWith("events/event-1/rsvps/"),
    );
    expect(allKeys.length).toBe(1);
  });

  it("dva různí users → dvě docs", async () => {
    await setRsvp("event-1", "user-a", "yes");
    await setRsvp("event-1", "user-b", "no");
    const a = __firestoreState.store.get("events/event-1/rsvps/user-a") as Record<string, unknown>;
    const b = __firestoreState.store.get("events/event-1/rsvps/user-b") as Record<string, unknown>;
    expect(a.response).toBe("yes");
    expect(b.response).toBe("no");
  });
});

describe("clearRsvp", () => {
  it("smaže RSVP doc", async () => {
    await setRsvp("event-1", "user-a", "yes");
    expect(__firestoreState.store.has("events/event-1/rsvps/user-a")).toBe(true);
    await clearRsvp("event-1", "user-a");
    expect(__firestoreState.store.has("events/event-1/rsvps/user-a")).toBe(false);
  });

  it("idempotentní — clear bez existujícího docu nepropadne", async () => {
    await expect(clearRsvp("event-1", "ghost")).resolves.not.toThrow();
  });
});
