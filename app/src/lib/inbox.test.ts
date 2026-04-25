import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import { markAllRead, markRead } from "./inbox";
import type { NotificationItem } from "@/types";

beforeEach(() => __firestoreState.reset());

function mkItem(p: Partial<NotificationItem> & { id: string }): NotificationItem {
  return {
    id: p.id,
    eventType: p.eventType ?? "comment_on_thread",
    taskId: p.taskId ?? "task-1",
    commentId: p.commentId ?? null,
    actorUid: p.actorUid ?? "actor-uid",
    actorName: p.actorName ?? "Actor",
    title: p.title ?? "title",
    body: p.body ?? "body",
    createdAt: p.createdAt ?? "2026-05-01T12:00:00.000Z",
    readAt: p.readAt ?? null,
  };
}

describe("markRead", () => {
  it("zapíše readAt ISO timestamp", async () => {
    __firestoreState.store.set("users/u1/notifications/n1", { title: "x" });
    await markRead("u1", "n1");
    const stored = __firestoreState.store.get(
      "users/u1/notifications/n1",
    ) as Record<string, unknown>;
    expect(typeof stored.readAt).toBe("string");
    expect(stored.readAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("idempotent — overwrite existing readAt", async () => {
    __firestoreState.store.set("users/u1/notifications/n1", {
      title: "x",
      readAt: "2026-04-01T00:00:00.000Z",
    });
    await markRead("u1", "n1");
    const stored = __firestoreState.store.get(
      "users/u1/notifications/n1",
    ) as Record<string, unknown>;
    expect(stored.readAt).not.toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("markAllRead", () => {
  it("označí všechny unread items přes batch", async () => {
    const items = [
      mkItem({ id: "n1" }),
      mkItem({ id: "n2", readAt: "2026-04-01T00:00:00.000Z" }), // already read
      mkItem({ id: "n3" }),
    ];
    __firestoreState.store.set("users/u1/notifications/n1", { title: "1" });
    __firestoreState.store.set("users/u1/notifications/n2", {
      title: "2",
      readAt: "2026-04-01T00:00:00.000Z",
    });
    __firestoreState.store.set("users/u1/notifications/n3", { title: "3" });

    await markAllRead("u1", items);

    const n1 = __firestoreState.store.get("users/u1/notifications/n1") as Record<
      string,
      unknown
    >;
    const n2 = __firestoreState.store.get("users/u1/notifications/n2") as Record<
      string,
      unknown
    >;
    const n3 = __firestoreState.store.get("users/u1/notifications/n3") as Record<
      string,
      unknown
    >;

    expect(n1.readAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // n2 byl already read — neměl by se přepsat (markAllRead filtruje !readAt
    // před batchem, takže v batch.update vůbec neproběhl)
    expect(n2.readAt).toBe("2026-04-01T00:00:00.000Z");
    expect(n3.readAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("noop pokud žádný item není unread", async () => {
    const items = [
      mkItem({ id: "n1", readAt: "2026-04-01T00:00:00.000Z" }),
      mkItem({ id: "n2", readAt: "2026-04-02T00:00:00.000Z" }),
    ];
    await expect(markAllRead("u1", items)).resolves.not.toThrow();
    // Žádný write neměl proběhnout
    const calls = __firestoreState.calls.filter((c) => c.op.startsWith("batch"));
    expect(calls.length).toBe(0);
  });

  it("noop pro prázdný array", async () => {
    await expect(markAllRead("u1", [])).resolves.not.toThrow();
    expect(__firestoreState.calls.length).toBe(0);
  });
});
