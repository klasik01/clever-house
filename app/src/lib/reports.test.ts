import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import {
  canViewReport,
  countUnreadReports,
  createReport,
  deleteReport,
  isReportUnread,
  markReportRead,
} from "./reports";
import type { SiteReport } from "@/types";
import { __firestoreState } from "@/test/firestoreMock";

beforeEach(() => __firestoreState.reset());

const baseReport = (over: Partial<SiteReport> = {}): SiteReport => ({
  id: "r1",
  message: "test",
  importance: "normal",
  createdBy: "owner-1",
  createdAt: "2026-04-29T12:00:00Z",
  updatedAt: "2026-04-29T12:00:00Z",
  readBy: [],
  authorRole: "OWNER",
  ...over,
});

describe("isReportUnread — V26", () => {
  it("true pokud uid není v readBy", () => {
    expect(isReportUnread(baseReport({ readBy: [] }), "me")).toBe(true);
    expect(isReportUnread(baseReport({ readBy: ["other"] }), "me")).toBe(true);
  });

  it("false pokud uid je v readBy", () => {
    expect(isReportUnread(baseReport({ readBy: ["me"] }), "me")).toBe(false);
    expect(isReportUnread(baseReport({ readBy: ["a", "me", "b"] }), "me")).toBe(false);
  });

  it("missing uid → false (anonymous nedořeší unread)", () => {
    expect(isReportUnread(baseReport({ readBy: [] }), undefined)).toBe(false);
  });

  it("missing readBy → fallback empty array → unread", () => {
    expect(isReportUnread(baseReport({ readBy: undefined }), "me")).toBe(true);
  });
});

describe("countUnreadReports — V26", () => {
  it("počítá jen reports kde uid není v readBy", () => {
    const reports: SiteReport[] = [
      baseReport({ id: "a", readBy: ["me"] }),
      baseReport({ id: "b", readBy: [] }),
      baseReport({ id: "c", readBy: ["other"] }),
      baseReport({ id: "d", readBy: ["me", "other"] }),
    ];
    expect(countUnreadReports(reports, "me")).toBe(2);
  });

  it("missing uid → 0", () => {
    const reports = [baseReport({ readBy: [] })];
    expect(countUnreadReports(reports, undefined)).toBe(0);
  });

  it("prázdný array → 0", () => {
    expect(countUnreadReports([], "me")).toBe(0);
  });
});

describe("canViewReport — V26-fix targetRoles gate", () => {
  it("autor vždy vidí svůj report (i když má targetRoles bez své role)", () => {
    const r = baseReport({
      createdBy: "cm-a",
      authorRole: "CONSTRUCTION_MANAGER",
      targetRoles: ["OWNER", "PROJECT_MANAGER"],
    });
    expect(canViewReport(r, "cm-a", "CONSTRUCTION_MANAGER")).toBe(true);
  });

  it("broadcast (targetRoles undefined / empty) → každý vidí", () => {
    const r1 = baseReport({ targetRoles: undefined });
    const r2 = baseReport({ targetRoles: [] });
    expect(canViewReport(r1, "owner-2", "OWNER")).toBe(true);
    expect(canViewReport(r1, "pm-1", "PROJECT_MANAGER")).toBe(true);
    expect(canViewReport(r1, "cm-1", "CONSTRUCTION_MANAGER")).toBe(true);
    expect(canViewReport(r2, "cm-1", "CONSTRUCTION_MANAGER")).toBe(true);
  });

  it("targetRoles=[OWNER] → jen OWNER vidí (autor + OWNER)", () => {
    const r = baseReport({
      createdBy: "owner-1",
      authorRole: "OWNER",
      targetRoles: ["OWNER"],
    });
    expect(canViewReport(r, "owner-2", "OWNER")).toBe(true);
    expect(canViewReport(r, "pm-1", "PROJECT_MANAGER")).toBe(false);
    expect(canViewReport(r, "cm-1", "CONSTRUCTION_MANAGER")).toBe(false);
  });

  it("targetRoles=[PM, CM] → OWNER nevidí (kromě autora)", () => {
    const r = baseReport({
      createdBy: "pm-1",
      authorRole: "PROJECT_MANAGER",
      targetRoles: ["PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    });
    expect(canViewReport(r, "owner-1", "OWNER")).toBe(false);
    expect(canViewReport(r, "pm-2", "PROJECT_MANAGER")).toBe(true);
    expect(canViewReport(r, "cm-1", "CONSTRUCTION_MANAGER")).toBe(true);
  });

  it("missing uid → false", () => {
    const r = baseReport({});
    expect(canViewReport(r, undefined, "OWNER")).toBe(false);
  });

  it("missing role + targetRoles set → false (autor projde, ostatní ne)", () => {
    const r = baseReport({
      createdBy: "pm-1",
      authorRole: "PROJECT_MANAGER",
      targetRoles: ["OWNER"],
    });
    expect(canViewReport(r, "ghost", null)).toBe(false);
  });
});

describe("createReport — V26 firestoreMock", () => {
  it("zapíše message, importance, createdBy, authorRole, readBy obsahuje autora", async () => {
    await createReport(
      { message: "  test  ", importance: "important", media: [] },
      "uid-1",
      "OWNER",
    );
    const calls = __firestoreState.calls.filter(
      (c) => c.op === "setDoc" && c.path.startsWith("reports"),
    );
    expect(calls).toHaveLength(1);
    const doc = calls[0].data!;
    expect(doc.message).toBe("test"); // trimmed
    expect(doc.importance).toBe("important");
    expect(doc.createdBy).toBe("uid-1");
    expect(doc.authorRole).toBe("OWNER");
    expect(doc.readBy).toEqual(["uid-1"]);
    expect(doc.media).toEqual([]);
  });

  it("targetRoles se zapíše JEN pokud je explicitně nastaven (broadcast = no field)", async () => {
    await createReport(
      { message: "broadcast", importance: "normal", targetRoles: undefined },
      "uid-1",
      "OWNER",
    );
    const broadcastCall = __firestoreState.calls.find(
      (c) => c.op === "setDoc" && c.path.startsWith("reports"),
    );
    expect("targetRoles" in (broadcastCall?.data ?? {})).toBe(false);

    __firestoreState.reset();

    await createReport(
      {
        message: "targeted",
        importance: "normal",
        targetRoles: ["PROJECT_MANAGER"],
      },
      "uid-1",
      "OWNER",
    );
    const targetedCall = __firestoreState.calls.find(
      (c) => c.op === "setDoc" && c.path.startsWith("reports"),
    );
    expect(targetedCall?.data?.targetRoles).toEqual(["PROJECT_MANAGER"]);
  });

  it("prázdný targetRoles array → field nezapsán (broadcast equivalent)", async () => {
    await createReport(
      { message: "x", importance: "normal", targetRoles: [] },
      "uid-1",
      "OWNER",
    );
    const call = __firestoreState.calls.find(
      (c) => c.op === "setDoc" && c.path.startsWith("reports"),
    );
    expect("targetRoles" in (call?.data ?? {})).toBe(false);
  });
});

describe("markReportRead — V26", () => {
  it("zavolá update s arrayUnion(uid) na readBy", async () => {
    __firestoreState.store.set("reports/r1", {
      message: "test",
      readBy: ["other"],
    });
    await markReportRead("r1", "me");
    const call = __firestoreState.calls.find(
      (c) => c.op === "updateDoc" && c.path === "reports/r1",
    );
    expect(call).toBeDefined();
    // arrayUnion is sentinel — verify shape
    const readBySent = (call?.data as Record<string, unknown>)?.readBy as {
      __sentinel?: string;
      values?: unknown[];
    };
    expect(readBySent?.__sentinel).toBe("arrayUnion");
    expect(readBySent?.values).toEqual(["me"]);
  });
});

describe("deleteReport — V26", () => {
  it("zavolá deleteDoc na reports/{id}", async () => {
    __firestoreState.store.set("reports/r1", { message: "test" });
    await deleteReport("r1");
    const call = __firestoreState.calls.find(
      (c) => c.op === "deleteDoc" && c.path === "reports/r1",
    );
    expect(call).toBeDefined();
  });
});
