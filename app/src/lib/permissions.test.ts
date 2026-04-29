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

// ---------- canViewTask V24 — CONSTRUCTION_MANAGER ----------

import { canViewTask } from "./permissions";

describe("canViewTask — V24 CONSTRUCTION_MANAGER scope", () => {
  const cmUid = "cm-a";

  it("CM nikdy nevidí napad (NDA hranice s OWNER+manželka brainstormingem)", () => {
    expect(
      canViewTask({
        task: {
          type: "napad",
          createdBy: "owner",
          assigneeUid: null,
          sharedWithRoles: [],
          authorRole: "OWNER",
        },
        currentUserUid: cmUid,
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("CM nevidí napad ani když by měl být v sharedWithRoles (defense in depth)", () => {
    // Edge case: nějak se napadu dostane sharedWithRoles s CM. UI to nemá
    // nikdy zapsat (S05 + S09 to gate-checnou), ale safeguard.
    expect(
      canViewTask({
        task: {
          type: "napad",
          createdBy: "owner",
          assigneeUid: null,
          sharedWithRoles: ["CONSTRUCTION_MANAGER"],
          authorRole: "OWNER",
        },
        currentUserUid: cmUid,
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("CM vidí dokumentaci jen pokud je v sharedWithRoles", () => {
    expect(
      canViewTask({
        task: {
          type: "dokumentace",
          createdBy: "owner",
          assigneeUid: null,
          sharedWithRoles: ["CONSTRUCTION_MANAGER"],
          authorRole: "OWNER",
        },
        currentUserUid: cmUid,
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
    expect(
      canViewTask({
        task: {
          type: "dokumentace",
          createdBy: "owner",
          assigneeUid: null,
          sharedWithRoles: ["PROJECT_MANAGER"],
          authorRole: "OWNER",
        },
        currentUserUid: cmUid,
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("CM vidí svůj přiřazený ukol (assignee==me)", () => {
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: "owner",
          assigneeUid: cmUid,
          sharedWithRoles: [],
          authorRole: "OWNER",
        },
        currentUserUid: cmUid,
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("CM vidí jím vytvořenou otázku (creator==me)", () => {
    expect(
      canViewTask({
        task: {
          type: "otazka",
          createdBy: cmUid,
          assigneeUid: "owner",
          sharedWithRoles: [],
          authorRole: "CONSTRUCTION_MANAGER",
        },
        currentUserUid: cmUid,
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("CM-B vidí task, který vytvořil CM-A (cross-CM team via authorRole)", () => {
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: "cm-a",
          assigneeUid: "owner",
          sharedWithRoles: [],
          authorRole: "CONSTRUCTION_MANAGER",
        },
        currentUserUid: "cm-b",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("CM-B NEVIDÍ task přiřazený CM-A přes authorRole gate (klientský filter limit)", () => {
    // Server rule by tohle povolila přes get(users/cmA).role==CM, ale
    // klient by potřeboval CM-uids cache. Pro V1 přijatelný kompromis;
    // CM-B k tasku dohledá přes mention/comment notifikaci nebo
    // single-doc deep link, ne přes listing.
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: "owner",
          assigneeUid: "cm-a",
          sharedWithRoles: [],
          authorRole: "OWNER",
        },
        currentUserUid: "cm-b",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("CM nevidí cizí PM otázku (žádný shared, žádný own)", () => {
    expect(
      canViewTask({
        task: {
          type: "otazka",
          createdBy: "pm-1",
          assigneeUid: "owner",
          sharedWithRoles: [],
          authorRole: "PROJECT_MANAGER",
        },
        currentUserUid: cmUid,
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("CM bez resolved role (status=loading) → nepustíme", () => {
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: cmUid,
          assigneeUid: cmUid,
          sharedWithRoles: [],
          authorRole: "CONSTRUCTION_MANAGER",
        },
        currentUserUid: cmUid,
        currentUserRole: null,
      }),
    ).toBe(false);
  });
});


// ---------- V24 — canCompleteAsAssignee + canFlipAssignee ----------

import { canCompleteAsAssignee, canFlipAssignee } from "./permissions";

describe("canCompleteAsAssignee — V24 (CM finish own assigned task)", () => {
  const baseTask = {
    type: "ukol" as const,
    status: "OPEN" as const,
    createdBy: "owner-1",
    assigneeUid: "cm-a",
  };

  it("CM jako assignee na OPEN ukolu (vytvořeném OWNER) smí dokončit", () => {
    expect(
      canCompleteAsAssignee({
        task: baseTask,
        taskAuthorRole: "OWNER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("CM jako assignee na otázce taky smí (oba actionable typy)", () => {
    expect(
      canCompleteAsAssignee({
        task: { ...baseTask, type: "otazka" },
        taskAuthorRole: "OWNER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("CM jako NE-assignee na OPEN ukolu NESMÍ dokončit", () => {
    expect(
      canCompleteAsAssignee({
        task: { ...baseTask, assigneeUid: "owner-1" },
        taskAuthorRole: "OWNER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("Hotovo je no-op pokud task není OPEN (DONE/BLOCKED/CANCELED)", () => {
    expect(
      canCompleteAsAssignee({
        task: { ...baseTask, status: "DONE" },
        taskAuthorRole: "OWNER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
    expect(
      canCompleteAsAssignee({
        task: { ...baseTask, status: "BLOCKED" },
        taskAuthorRole: "OWNER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("Hotovo je no-op pro napad / dokumentace (jiný workflow)", () => {
    expect(
      canCompleteAsAssignee({
        task: { ...baseTask, type: "napad" },
        taskAuthorRole: "OWNER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
    expect(
      canCompleteAsAssignee({
        task: { ...baseTask, type: "dokumentace" },
        taskAuthorRole: "OWNER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("autor (OWNER) na vlastním tasku samozřejmě smí (přes canEditTask)", () => {
    expect(
      canCompleteAsAssignee({
        task: { ...baseTask, createdBy: "owner-me" },
        taskAuthorRole: "OWNER",
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
  });

  it("PM jako assignee na OWNER tasku (klasický scénář) — smí přes canEditTask? NE (cross-team neexistuje pro PM-OWNER)", () => {
    // PM-as-assignee na OWNER-created tasku NEMÁ edit (PM cross-OWNER neexistuje).
    // Bez "PM-as-assignee dovětek" by NEsměl flippnout. Ale historicky PM
    // používal flip přes komentář k tomu samému efektu. Tahle funkce vrací
    // false pro PM ne-autora; UI skin zůstává stejný — close button se
    // pouze pro PM neukáže (S07 zachová existující flip workflow pro PM).
    expect(
      canCompleteAsAssignee({
        task: baseTask,
        taskAuthorRole: "OWNER",
        currentUserUid: "pm-1",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });
});

describe("canFlipAssignee — V24", () => {
  it("CM jako pouhý assignee NESMÍ reassignnout cizí task (žádné cross-team boundary)", () => {
    expect(
      canFlipAssignee({
        task: {
          type: "ukol",
          status: "OPEN",
          createdBy: "owner-1",
          assigneeUid: "cm-a",
        },
        taskAuthorRole: "OWNER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("CM autor smí reassignnout (přes edit)", () => {
    expect(
      canFlipAssignee({
        task: {
          type: "ukol",
          status: "OPEN",
          createdBy: "cm-a",
          assigneeUid: "owner-1",
        },
        taskAuthorRole: "CONSTRUCTION_MANAGER",
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("OWNER autor smí, PM ne-autor nesmí", () => {
    expect(
      canFlipAssignee({
        task: {
          type: "ukol",
          status: "OPEN",
          createdBy: "owner-me",
          assigneeUid: "pm-1",
        },
        taskAuthorRole: "OWNER",
        currentUserUid: "owner-me",
        currentUserRole: "OWNER",
      }),
    ).toBe(true);
    expect(
      canFlipAssignee({
        task: {
          type: "ukol",
          status: "OPEN",
          createdBy: "owner-1",
          assigneeUid: "pm-1",
        },
        taskAuthorRole: "OWNER",
        currentUserUid: "pm-1",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(false);
  });
});


// ---------- V25-fix — participantUids visibility ----------

import { isReadOnlyParticipant } from "./permissions";

describe("canViewTask — V25-fix participantUids", () => {
  it("CM-A flipnul assignee na OWNER → CM-A je v participantUids → vidí dál", () => {
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: "owner-1",
          assigneeUid: "owner-1", // flipnut zpět z cm-a
          sharedWithRoles: [],
          authorRole: "OWNER",
          participantUids: ["owner-1", "cm-a"],
        },
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("CM @označen v komentu na úkol, který nikdy neměl jako assignee → vidí read-only", () => {
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: "owner-1",
          assigneeUid: "pm-1",
          sharedWithRoles: [],
          authorRole: "OWNER",
          participantUids: ["owner-1", "pm-1", "cm-a"], // CM mention added
        },
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("CM bez participation → nevidí cizí úkol", () => {
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: "owner-1",
          assigneeUid: "pm-1",
          sharedWithRoles: [],
          authorRole: "OWNER",
          participantUids: ["owner-1", "pm-1"],
        },
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("CM mention na napad → STÁLE NESMÍ vidět (NDA hard rule, V24 boundary)", () => {
    expect(
      canViewTask({
        task: {
          type: "napad",
          createdBy: "owner-1",
          assigneeUid: null,
          sharedWithRoles: [],
          authorRole: "OWNER",
          participantUids: ["owner-1", "cm-a"], // mention nepomáhá pro napad
        },
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("CM mention na dokumentaci bez sharedWithRoles → nevidí (hard role-share)", () => {
    expect(
      canViewTask({
        task: {
          type: "dokumentace",
          createdBy: "owner-1",
          assigneeUid: null,
          sharedWithRoles: [],
          authorRole: "OWNER",
          participantUids: ["owner-1", "cm-a"],
        },
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("PM v participantUids vidí task, i kdyby nebyl assignee/autor", () => {
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: "owner-1",
          assigneeUid: "owner-1",
          sharedWithRoles: [],
          authorRole: "OWNER",
          participantUids: ["owner-1", "pm-1"], // PM byl mentioned
        },
        currentUserUid: "pm-1",
        currentUserRole: "PROJECT_MANAGER",
      }),
    ).toBe(true);
  });

  it("Legacy task bez participantUids → fallback na createdBy/assignee/cross-team", () => {
    expect(
      canViewTask({
        task: {
          type: "ukol",
          createdBy: "cm-a",
          assigneeUid: "owner-1",
          sharedWithRoles: [],
          authorRole: "CONSTRUCTION_MANAGER",
          participantUids: undefined, // legacy doc
        },
        currentUserUid: "cm-b",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true); // cross-CM team via authorRole
  });
});

describe("isReadOnlyParticipant — V25-fix", () => {
  it("Mention-only CM → true (read-only mention mode)", () => {
    expect(
      isReadOnlyParticipant({
        task: {
          createdBy: "owner-1",
          assigneeUid: "pm-1",
          authorRole: "OWNER",
          participantUids: ["owner-1", "pm-1", "cm-a"],
        },
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(true);
  });

  it("Aktuální assignee → ne read-only (má edit přes assignee path)", () => {
    expect(
      isReadOnlyParticipant({
        task: {
          createdBy: "owner-1",
          assigneeUid: "cm-a",
          authorRole: "OWNER",
          participantUids: ["owner-1", "cm-a"],
        },
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("Autor → ne read-only", () => {
    expect(
      isReadOnlyParticipant({
        task: {
          createdBy: "cm-a",
          assigneeUid: "owner-1",
          authorRole: "CONSTRUCTION_MANAGER",
          participantUids: ["cm-a", "owner-1"],
        },
        currentUserUid: "cm-a",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("Cross-CM team na CM-vytvořeném tasku → ne read-only (má cross-team edit)", () => {
    expect(
      isReadOnlyParticipant({
        task: {
          createdBy: "cm-a",
          assigneeUid: "owner-1",
          authorRole: "CONSTRUCTION_MANAGER",
          participantUids: ["cm-a", "owner-1", "cm-b"],
        },
        currentUserUid: "cm-b",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });

  it("Někdo, kdo není v participantUids → ne read-only (žádná visibility k tasku vůbec)", () => {
    expect(
      isReadOnlyParticipant({
        task: {
          createdBy: "owner-1",
          assigneeUid: "pm-1",
          authorRole: "OWNER",
          participantUids: ["owner-1", "pm-1"],
        },
        currentUserUid: "cm-stranger",
        currentUserRole: "CONSTRUCTION_MANAGER",
      }),
    ).toBe(false);
  });
});
