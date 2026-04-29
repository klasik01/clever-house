import { describe, it, expect } from "vitest";
import { canEditTask, isReadOnlyTask, canChangeTaskType, canLinkTasks } from "./permissions";

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

// ---------- canEditEvent (V18-S07) ----------

import { canEditEvent } from "./permissions";

describe("canEditEvent — V18-S07", () => {
  it("autor vždy edituje", () => {
    expect(
      canEditEvent({
        event: { createdBy: "me", authorRole: "OWNER" },
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("OWNER edituje jiný OWNER event (cross-OWNER)", () => {
    expect(
      canEditEvent({
        event: { createdBy: "owner-spouse", authorRole: "OWNER" },
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("OWNER NEMŮŽE PM event", () => {
    expect(
      canEditEvent({
        event: { createdBy: "pm-x", authorRole: "PROJECT_MANAGER" },
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("PM NEMŮŽE jiný PM event", () => {
    expect(
      canEditEvent({
        event: { createdBy: "pm-a", authorRole: "PROJECT_MANAGER" },
        currentUserUid: "pm-b",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });

  it("missing authorRole → false i pro OWNER", () => {
    expect(
      canEditEvent({
        event: { createdBy: "ghost" },
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("unauthorized → false", () => {
    expect(
      canEditEvent({
        event: { createdBy: "x", authorRole: "OWNER" },
        currentUserUid: null,
        currentUserRole: null,
      }),
    ).toBe(false);
  });
});


describe("canChangeTaskType (V18-S40)", () => {
  it("autor otázky smí převést na úkol", () => {
    expect(
      canChangeTaskType({
        task: { createdBy: "me", type: "otazka" },
        taskAuthorRole: "OWNER",
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("autor úkolu smí převést na otázku", () => {
    expect(
      canChangeTaskType({
        task: { createdBy: "me", type: "ukol" },
        taskAuthorRole: "OWNER",
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("napad NESMÍ být převeden (jiný workflow)", () => {
    expect(
      canChangeTaskType({
        task: { createdBy: "me", type: "napad" },
        taskAuthorRole: "OWNER",
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("dokumentace NESMÍ být převedena", () => {
    expect(
      canChangeTaskType({
        task: { createdBy: "me", type: "dokumentace" },
        taskAuthorRole: "OWNER",
        currentUserUid: "me",
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("cross-OWNER smí převést OWNER-vytvořenou otázku", () => {
    expect(
      canChangeTaskType({
        task: { createdBy: "owner-1", type: "otazka" },
        taskAuthorRole: "OWNER",
        currentUserUid: "owner-2",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("PM ne-autor PM-otázky NESMÍ", () => {
    expect(
      canChangeTaskType({
        task: { createdBy: "pm-1", type: "otazka" },
        taskAuthorRole: "PROJECT_MANAGER",
        currentUserUid: "pm-2",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });
});

describe("canLinkTasks (V18-S40)", () => {
  const me = { uid: "me", role: "OWNER" as const };
  const myOwnerTask = { createdBy: "me" };
  const otherOwnerTask = { createdBy: "owner-2" };
  const pmTask = { createdBy: "pm-1" };

  it("autor obou stran smí linkovat", () => {
    expect(
      canLinkTasks({
        task: myOwnerTask,
        taskAuthorRole: "OWNER",
        other: myOwnerTask,
        otherAuthorRole: "OWNER",
        currentUserUid: me.uid,
        currentUserRole: me.role,
      }),
    ).toBe(true);
  });

  it("OWNER smí linkovat 2 OWNER-vytvořené tasky (cross-OWNER na obě)", () => {
    expect(
      canLinkTasks({
        task: otherOwnerTask,
        taskAuthorRole: "OWNER",
        other: otherOwnerTask,
        otherAuthorRole: "OWNER",
        currentUserUid: me.uid,
        currentUserRole: me.role,
      }),
    ).toBe(true);
  });

  it("OWNER NESMÍ linkovat když je druhá strana PM-vytvořená a OWNER nemá edit", () => {
    expect(
      canLinkTasks({
        task: myOwnerTask,
        taskAuthorRole: "OWNER",
        other: pmTask,
        otherAuthorRole: "PROJECT_MANAGER",
        currentUserUid: me.uid,
        currentUserRole: me.role,
      }),
    ).toBe(false);
  });

  it("PM smí linkovat svoji otázku se svým úkolem", () => {
    expect(
      canLinkTasks({
        task: pmTask,
        taskAuthorRole: "PROJECT_MANAGER",
        other: pmTask,
        otherAuthorRole: "PROJECT_MANAGER",
        currentUserUid: "pm-1",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(true);
  });

  it("missing uid → false", () => {
    expect(
      canLinkTasks({
        task: myOwnerTask,
        taskAuthorRole: "OWNER",
        other: myOwnerTask,
        otherAuthorRole: "OWNER",
        currentUserUid: null,
        currentUserRole: "OWNER",
      }),
    ).toBe(false);
  });
});

