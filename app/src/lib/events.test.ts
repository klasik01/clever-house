import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import {
  cancelEvent,
  confirmEventHappened,
  createEvent,
  deleteEvent,
  getEvent,
  updateEvent,
} from "./events";

beforeEach(() => __firestoreState.reset());

describe("createEvent", () => {
  it("zapíše event doc s povinnými fieldy + authorRole snapshot", async () => {
    const id = await createEvent(
      {
        title: "Elektrikář — rozvaděč",
        startAt: "2026-05-14T12:00:00.000Z",
        endAt: "2026-05-14T14:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["spouse-uid", "pm-uid"],
      },
      "owner-uid",
      "OWNER",
    );
    expect(id).toMatch(/^auto-/);
    const stored = __firestoreState.store.get(`events/${id}`) as Record<string, unknown>;
    expect(stored).toMatchObject({
      title: "Elektrikář — rozvaděč",
      startAt: "2026-05-14T12:00:00.000Z",
      endAt: "2026-05-14T14:00:00.000Z",
      isAllDay: false,
      inviteeUids: ["spouse-uid", "pm-uid"],
      createdBy: "owner-uid",
      authorRole: "OWNER",
      status: "UPCOMING",
    });
    expect(stored.description).toBe("");
    expect(stored.address).toBe("");
    expect(stored.linkedTaskId).toBeNull();
    expect(stored.happenedConfirmedAt).toBeNull();
    expect(stored.cancelledAt).toBeNull();
    expect(stored.createdAt).toEqual({ __sentinel: "serverTimestamp" });
    expect(stored.updatedAt).toEqual({ __sentinel: "serverTimestamp" });
  });

  it("propíše volitelné fieldy když jsou poskytnuté", async () => {
    const id = await createEvent(
      {
        title: "T",
        description: "Nezapomenout přinést plány",
        startAt: "2026-05-14T08:00:00.000Z",
        endAt: "2026-05-14T16:00:00.000Z",
        isAllDay: false,
        address: "Truhlářská 12, Praha 1",
        inviteeUids: ["spouse"],
        linkedTaskId: "task-42",
      },
      "owner",
      "OWNER",
    );
    const stored = __firestoreState.store.get(`events/${id}`) as Record<string, unknown>;
    expect(stored.description).toBe("Nezapomenout přinést plány");
    expect(stored.address).toBe("Truhlářská 12, Praha 1");
    expect(stored.linkedTaskId).toBe("task-42");
  });

  it("PM-created event má authorRole=PROJECT_MANAGER", async () => {
    const id = await createEvent(
      {
        title: "PM meeting",
        startAt: "2026-05-14T08:00:00.000Z",
        endAt: "2026-05-14T09:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["owner"],
      },
      "pm-uid",
      "PROJECT_MANAGER",
    );
    const stored = __firestoreState.store.get(`events/${id}`) as Record<string, unknown>;
    expect(stored.authorRole).toBe("PROJECT_MANAGER");
  });

  it("all-day event — isAllDay flag prochází", async () => {
    const id = await createEvent(
      {
        title: "Kolaudace",
        startAt: "2026-06-01T00:00:00.000Z",
        endAt: "2026-06-01T23:59:59.000Z",
        isAllDay: true,
        inviteeUids: ["spouse", "pm"],
      },
      "owner",
      "OWNER",
    );
    const stored = __firestoreState.store.get(`events/${id}`) as Record<string, unknown>;
    expect(stored.isAllDay).toBe(true);
  });
});

describe("updateEvent", () => {
  it("merge patch + bumps updatedAt", async () => {
    __firestoreState.store.set("events/e1", {
      title: "old",
      status: "UPCOMING",
    });
    await updateEvent("e1", { title: "new" });
    const merged = __firestoreState.store.get("events/e1") as Record<string, unknown>;
    expect(merged.title).toBe("new");
    expect(merged.status).toBe("UPCOMING"); // nedotčeno
    expect(merged.updatedAt).toEqual({ __sentinel: "serverTimestamp" });
  });

  it("status transition UPCOMING → CANCELLED", async () => {
    __firestoreState.store.set("events/e1", {
      title: "Schůzka",
      status: "UPCOMING",
    });
    await updateEvent("e1", {
      status: "CANCELLED",
      cancelledAt: "2026-05-14T13:00:00.000Z",
    });
    const merged = __firestoreState.store.get("events/e1") as Record<string, unknown>;
    expect(merged.status).toBe("CANCELLED");
    expect(merged.cancelledAt).toBe("2026-05-14T13:00:00.000Z");
  });
});

describe("deleteEvent", () => {
  it("odstraní doc ze store", async () => {
    __firestoreState.store.set("events/e1", { title: "T" });
    await deleteEvent("e1");
    expect(__firestoreState.store.has("events/e1")).toBe(false);
  });
});

describe("getEvent + fromDocSnap", () => {
  it("vrátí null když doc neexistuje", async () => {
    const out = await getEvent("missing");
    expect(out).toBeNull();
  });

  it("vrátí Event shape když doc existuje", async () => {
    __firestoreState.store.set("events/e1", {
      title: "Elektrikář",
      description: "Poznámka",
      startAt: "2026-05-14T12:00:00.000Z",
      endAt: "2026-05-14T14:00:00.000Z",
      isAllDay: false,
      address: "Stavba",
      inviteeUids: ["u1", "u2"],
      createdBy: "owner",
      authorRole: "OWNER",
      status: "UPCOMING",
      linkedTaskId: null,
      happenedConfirmedAt: null,
      cancelledAt: null,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });
    const ev = await getEvent("e1");
    expect(ev).not.toBeNull();
    expect(ev!.id).toBe("e1");
    expect(ev!.title).toBe("Elektrikář");
    expect(ev!.inviteeUids).toEqual(["u1", "u2"]);
    expect(ev!.authorRole).toBe("OWNER");
    expect(ev!.status).toBe("UPCOMING");
  });

  it("legacy / corrupted data — graceful defaults", async () => {
    __firestoreState.store.set("events/bogus", {
      // missing většiny fieldů, corrupted status
      status: "WHATEVER",
      inviteeUids: "not-an-array",
      authorRole: "ROBOT",
    });
    const ev = await getEvent("bogus");
    expect(ev).not.toBeNull();
    expect(ev!.title).toBe("");
    expect(ev!.description).toBe("");
    expect(ev!.inviteeUids).toEqual([]); // filter
    expect(ev!.status).toBe("UPCOMING"); // fallback
    expect(ev!.authorRole).toBeUndefined(); // garbage → undefined
  });

  it("filtruje non-string invitee uids", async () => {
    __firestoreState.store.set("events/e1", {
      inviteeUids: ["u1", 42, null, "u2", undefined],
    });
    const ev = await getEvent("e1");
    expect(ev!.inviteeUids).toEqual(["u1", "u2"]);
  });
});


describe("cancelEvent", () => {
  it("nastaví status CANCELLED + cancelledAt + bumps updatedAt", async () => {
    const id = await createEvent(
      {
        title: "Cancellable",
        startAt: "2026-05-14T12:00:00.000Z",
        endAt: "2026-05-14T13:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["x"],
      },
      "owner",
      "OWNER",
    );
    await cancelEvent(id);
    const stored = __firestoreState.store.get(`events/${id}`) as Record<string, unknown>;
    expect(stored.status).toBe("CANCELLED");
    expect(typeof stored.cancelledAt).toBe("string");
    // ISO format check
    expect(stored.cancelledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(stored.updatedAt).toEqual({ __sentinel: "serverTimestamp" });
  });
});

describe("confirmEventHappened", () => {
  it("nastaví status HAPPENED + happenedConfirmedAt + bumps updatedAt", async () => {
    const id = await createEvent(
      {
        title: "Happenable",
        startAt: "2026-05-14T12:00:00.000Z",
        endAt: "2026-05-14T13:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["x"],
      },
      "owner",
      "OWNER",
    );
    await confirmEventHappened(id);
    const stored = __firestoreState.store.get(`events/${id}`) as Record<string, unknown>;
    expect(stored.status).toBe("HAPPENED");
    expect(typeof stored.happenedConfirmedAt).toBe("string");
    expect(stored.happenedConfirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Cancelled fields se nedotýkají
    expect(stored.cancelledAt).toBeNull();
    expect(stored.updatedAt).toEqual({ __sentinel: "serverTimestamp" });
  });
});
