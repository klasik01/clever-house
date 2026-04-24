import { describe, it, expect } from "vitest";
import { canEditTask, isReadOnlyTask } from "./permissions";

describe("canEditTask — V17.1/V17.8 permissions model", () => {
  it("autor vždy edituje vlastní task", () => {
    expect(
      canEditTask({
        task: { createdBy: "me" },
        taskAuthorRole: "OWNER",
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
    expect(
      canEditTask({
        task: { createdBy: "me" },
        taskAuthorRole: "PROJECT_MANAGER",
        currentUserUid: "me",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(true);
  });

  it("OWNER edituje jiným OWNEREM vytvořený task (cross-OWNER)", () => {
    expect(
      canEditTask({
        task: { createdBy: "owner-spouse" },
        taskAuthorRole: "OWNER",
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("OWNER NEMŮŽE editovat PM-vytvořený task", () => {
    expect(
      canEditTask({
        task: { createdBy: "pm-somebody" },
        taskAuthorRole: "PROJECT_MANAGER",
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("PM NEMŮŽE editovat OWNER-vytvořený task (kromě vlastního)", () => {
    expect(
      canEditTask({
        task: { createdBy: "owner-a" },
        taskAuthorRole: "OWNER",
        currentUserUid: "pm-x",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });

  it("PM NEMŮŽE editovat jiný PM task (ne-autor)", () => {
    expect(
      canEditTask({
        task: { createdBy: "pm-a" },
        taskAuthorRole: "PROJECT_MANAGER",
        currentUserUid: "pm-b",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });

  it("V17.8 — undefined taskAuthorRole → konzervativně NEDOVOLIT cross-OWNER", () => {
    // Legacy task před V17.1 deploy: authorRole není v Firestore, user
    // lookup taky selhal (smazaný PM účet). Safe default = read-only pro
    // každého kromě samotného autora. Předejde to situaci kdy OWNER
    // editoval PM-created legacy task před backfillem.
    expect(
      canEditTask({
        task: { createdBy: "unknown-pm" },
        taskAuthorRole: undefined,
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("V17.8 — autor stále edituje i bez resolved authorRole", () => {
    // Když je current user přímo autorem, nepotřebujeme znát jeho role.
    expect(
      canEditTask({
        task: { createdBy: "me" },
        taskAuthorRole: undefined,
        currentUserUid: "me",
        currentUserRole: null,
      }),
    ).toBe(true);
  });

  it("anonymous / nepřihlášený user nikdy nesmí", () => {
    expect(
      canEditTask({
        task: { createdBy: "x" },
        taskAuthorRole: "OWNER",
        currentUserUid: null,
        currentUserRole: null,
      }),
    ).toBe(false);
  });

  it("role=null (profile ještě nenačtený) → jen autor smí", () => {
    expect(
      canEditTask({
        task: { createdBy: "me" },
        taskAuthorRole: "OWNER",
        currentUserUid: "me",
        currentUserRole: null,
      }),
    ).toBe(true);
    expect(
      canEditTask({
        task: { createdBy: "other-owner" },
        taskAuthorRole: "OWNER",
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
        task: { createdBy: "me" },
        taskAuthorRole: "OWNER",
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });
  it("PM na OWNER napadu je readonly", () => {
    expect(
      isReadOnlyTask({
        task: { createdBy: "owner" },
        taskAuthorRole: "OWNER",
        currentUserUid: "pm",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(true);
  });
  it("OWNER na PM-legacy tasku (undefined role) je readonly", () => {
    expect(
      isReadOnlyTask({
        task: { createdBy: "pm" },
        taskAuthorRole: undefined,
        currentUserUid: "owner",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });
});
