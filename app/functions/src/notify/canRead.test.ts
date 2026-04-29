import { describe, expect, it } from "vitest";
import { canReadTaskForRecipient } from "./canRead";
import type { TaskDoc } from "./types";

describe("canReadTaskForRecipient — V24 recipient read-scope gate", () => {
  const owner = { role: "OWNER" as const, uid: "owner-1" };
  const pm = { role: "PROJECT_MANAGER" as const, uid: "pm-1" };
  const cmA = { role: "CONSTRUCTION_MANAGER" as const, uid: "cm-a" };
  const cmB = { role: "CONSTRUCTION_MANAGER" as const, uid: "cm-b" };

  it("event-scope (no task) — vždy projde", () => {
    expect(canReadTaskForRecipient(undefined, owner)).toBe(true);
    expect(canReadTaskForRecipient(undefined, pm)).toBe(true);
    expect(canReadTaskForRecipient(undefined, cmA)).toBe(true);
  });

  it("OWNER má broad access nezávisle na task scope", () => {
    const napad: TaskDoc = { type: "napad", createdBy: "owner-1", authorRole: "OWNER" };
    expect(canReadTaskForRecipient(napad, owner)).toBe(true);
  });

  it("PM má broad access (V15.2)", () => {
    const napad: TaskDoc = { type: "napad", createdBy: "owner-1", authorRole: "OWNER" };
    expect(canReadTaskForRecipient(napad, pm)).toBe(true);
  });

  it("CM napad → vždy false (NDA hranice)", () => {
    const napad: TaskDoc = {
      type: "napad",
      createdBy: "owner-1",
      authorRole: "OWNER",
      assigneeUid: "cm-a",
      sharedWithRoles: ["CONSTRUCTION_MANAGER"], // i kdyby
    };
    expect(canReadTaskForRecipient(napad, cmA)).toBe(false);
  });

  it("CM dokumentace bez sharedWithRoles → false", () => {
    const doc: TaskDoc = { type: "dokumentace", createdBy: "owner-1", authorRole: "OWNER" };
    expect(canReadTaskForRecipient(doc, cmA)).toBe(false);
  });

  it("CM dokumentace se sharedWithRoles=[CM] → true", () => {
    const doc: TaskDoc = {
      type: "dokumentace",
      createdBy: "owner-1",
      authorRole: "OWNER",
      sharedWithRoles: ["PROJECT_MANAGER", "CONSTRUCTION_MANAGER"],
    };
    expect(canReadTaskForRecipient(doc, cmA)).toBe(true);
  });

  it("CM otazka kde je assignee → true", () => {
    const t: TaskDoc = {
      type: "otazka",
      createdBy: "owner-1",
      authorRole: "OWNER",
      assigneeUid: "cm-a",
    };
    expect(canReadTaskForRecipient(t, cmA)).toBe(true);
  });

  it("CM otazka kde je creator → true", () => {
    const t: TaskDoc = {
      type: "otazka",
      createdBy: "cm-a",
      authorRole: "CONSTRUCTION_MANAGER",
      assigneeUid: "owner-1",
    };
    expect(canReadTaskForRecipient(t, cmA)).toBe(true);
  });

  it("CM ukol s authorRole=CM (cross-CM team) → true i pro druhého CM", () => {
    const t: TaskDoc = {
      type: "ukol",
      createdBy: "cm-a",
      authorRole: "CONSTRUCTION_MANAGER",
      assigneeUid: "owner-1",
    };
    expect(canReadTaskForRecipient(t, cmB)).toBe(true);
  });

  it("CM-B nedostane push o tasku assigned-to-CM-A bez cross-CM authoring (známé V1 omezení)", () => {
    const t: TaskDoc = {
      type: "ukol",
      createdBy: "owner-1",
      authorRole: "OWNER",
      assigneeUid: "cm-a",
    };
    expect(canReadTaskForRecipient(t, cmB)).toBe(false);
  });

  it("CM ukol kde není ani vlastní ani cross-CM → false", () => {
    const t: TaskDoc = {
      type: "ukol",
      createdBy: "pm-1",
      authorRole: "PROJECT_MANAGER",
      assigneeUid: "owner-1",
    };
    expect(canReadTaskForRecipient(t, cmA)).toBe(false);
  });

  it("undefined role recipient (chybějící user doc) → false", () => {
    const t: TaskDoc = {
      type: "ukol",
      createdBy: "cm-a",
      authorRole: "CONSTRUCTION_MANAGER",
    };
    expect(
      canReadTaskForRecipient(t, { role: undefined, uid: "ghost" }),
    ).toBe(false);
  });
});
