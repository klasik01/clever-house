import { describe, it, expect } from "vitest";
import { canEditTask, isReadOnlyTask } from "./permissions";
import type { Task } from "@/types";

function task(override: Partial<Pick<Task, "createdBy" | "authorRole">> = {}) {
  return {
    createdBy: "owner-a",
    authorRole: "OWNER" as const,
    ...override,
  };
}

describe("canEditTask — V17.1 permissions model", () => {
  it("autor vždy edituje vlastní task", () => {
    expect(
      canEditTask({
        task: task({ createdBy: "me", authorRole: "OWNER" }),
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
    expect(
      canEditTask({
        task: task({ createdBy: "me", authorRole: "PROJECT_MANAGER" }),
        currentUserUid: "me",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(true);
  });

  it("OWNER edituje jiným OWNEREM vytvořený task (cross-OWNER)", () => {
    expect(
      canEditTask({
        task: task({ createdBy: "owner-spouse", authorRole: "OWNER" }),
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("OWNER NEMŮŽE editovat PM-vytvořený task", () => {
    expect(
      canEditTask({
        task: task({ createdBy: "pm-somebody", authorRole: "PROJECT_MANAGER" }),
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("PM NEMŮŽE editovat OWNER-vytvořený task (kromě vlastního)", () => {
    expect(
      canEditTask({
        task: task({ createdBy: "owner-a", authorRole: "OWNER" }),
        currentUserUid: "pm-x",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });

  it("PM NEMŮŽE editovat jiný PM task (ne-autor)", () => {
    expect(
      canEditTask({
        task: task({ createdBy: "pm-a", authorRole: "PROJECT_MANAGER" }),
        currentUserUid: "pm-b",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });

  it("legacy task bez authorRole → default OWNER", () => {
    expect(
      canEditTask({
        task: { createdBy: "owner-spouse" },
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
    expect(
      canEditTask({
        task: { createdBy: "someone-else" },
        currentUserUid: "pm-me",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });

  it("anonymous / nepřihlášený user nikdy nesmí", () => {
    expect(
      canEditTask({
        task: task(),
        currentUserUid: null,
        currentUserRole: null,
      }),
    ).toBe(false);
    expect(
      canEditTask({
        task: task(),
        currentUserUid: undefined,
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("role=null (např. profile ještě nenačtený) → jen autor", () => {
    // createdBy === me → true i bez role
    expect(
      canEditTask({
        task: task({ createdBy: "me" }),
        currentUserUid: "me",
        currentUserRole: null,
      }),
    ).toBe(true);
    // cross-OWNER check potřebuje role → false když role není známa
    expect(
      canEditTask({
        task: task({ createdBy: "other-owner" }),
        currentUserUid: "me",
        currentUserRole: null,
      }),
    ).toBe(false);
  });
});

describe("isReadOnlyTask — inverze", () => {
  it("OWNER na vlastním tasku není readonly", () => {
    expect(
      isReadOnlyTask({
        task: task({ createdBy: "me" }),
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });
  it("PM na OWNER napadu je readonly", () => {
    expect(
      isReadOnlyTask({
        task: task({ createdBy: "owner", authorRole: "OWNER" }),
        currentUserUid: "pm",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(true);
  });
});
