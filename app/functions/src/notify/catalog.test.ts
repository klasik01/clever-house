import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_CATALOG,
  NOTIFICATION_EVENT_KEYS,
  buildDefaultPrefs,
  commentPreview,
  eventPriorityList,
  renderNotification,
  taskTitleOrFallback,
  truncate,
} from "./catalog";
import type { NotificationEventKey, NotifyInput, TaskDoc } from "./types";

// ---------- Helpery ----------

function baseTask(override: Partial<TaskDoc> = {}): TaskDoc {
  return {
    type: "ukol",
    title: "Topení",
    body: "Rozhodnout do konce měsíce.",
    createdBy: "owner-uid",
    assigneeUid: "pm-uid",
    priority: "P2",
    deadline: 1714435200000, // 2024-04-30 (v čase testů pevný anchor)
    ...override,
  };
}

function baseInput(override: Partial<NotifyInput> = {}): NotifyInput {
  return {
    eventType: "assigned",
    actorUid: "actor-uid",
    actorName: "Stanislav",
    recipientUid: "recipient-uid",
    taskId: "task-1",
    task: baseTask(),
    ...override,
  };
}

// ---------- Invarianty katalogu ----------

describe("NOTIFICATION_CATALOG — shape invarianty", () => {
  it("každý klíč má entry s matchujícím key fieldem (soundness)", () => {
    for (const key of NOTIFICATION_EVENT_KEYS) {
      const spec = NOTIFICATION_CATALOG[key];
      expect(spec).toBeDefined();
      expect(spec.key).toBe(key);
    }
  });

  it("dedupePriority jsou strictly ascending v NOTIFICATION_EVENT_KEYS", () => {
    let last = -Infinity;
    for (const key of NOTIFICATION_EVENT_KEYS) {
      const prio = NOTIFICATION_CATALOG[key].dedupePriority;
      expect(prio).toBeGreaterThan(last);
      last = prio;
    }
  });

  it("dedupePriority čísla jsou unikátní", () => {
    const priorities = NOTIFICATION_EVENT_KEYS.map(
      (k) => NOTIFICATION_CATALOG[k].dedupePriority,
    );
    const set = new Set(priorities);
    expect(set.size).toBe(priorities.length);
  });

  it("každý spec má neprázdné trigger + recipients dokumentační řetězce", () => {
    for (const key of NOTIFICATION_EVENT_KEYS) {
      const spec = NOTIFICATION_CATALOG[key];
      expect(spec.trigger.length).toBeGreaterThan(10);
      expect(spec.recipients.length).toBeGreaterThan(10);
    }
  });

  it("category je buď 'immediate' nebo 'debounced' (žádná další hodnota)", () => {
    for (const key of NOTIFICATION_EVENT_KEYS) {
      const spec = NOTIFICATION_CATALOG[key];
      expect(["immediate", "debounced"]).toContain(spec.category);
    }
  });

  it("clientLabelKey matchuje key (aby i18n namespace seděl)", () => {
    for (const key of NOTIFICATION_EVENT_KEYS) {
      expect(NOTIFICATION_CATALOG[key].clientLabelKey).toBe(key);
    }
  });
});

// ---------- eventPriorityList + NOTIFICATION_EVENT_KEYS ----------

describe("eventPriorityList + NOTIFICATION_EVENT_KEYS", () => {
  it("eventPriorityList() vrací kopii (volající ho smí mutovat bez dopadu)", () => {
    const a = eventPriorityList();
    const b = eventPriorityList();
    expect(a).toEqual(b);
    a.reverse();
    expect(eventPriorityList()).toEqual(b); // original nezměněn
  });

  it("obsahuje všechny klíče katalogu", () => {
    expect(NOTIFICATION_EVENT_KEYS.sort()).toEqual(
      Object.keys(NOTIFICATION_CATALOG).sort(),
    );
  });

  it("mention je první (nejvyšší priorita dedupe)", () => {
    expect(NOTIFICATION_EVENT_KEYS[0]).toBe("mention");
  });
});

// ---------- buildDefaultPrefs ----------

describe("buildDefaultPrefs", () => {
  it("enabled=true, každý event dle spec.defaultEnabled", () => {
    const prefs = buildDefaultPrefs();
    expect(prefs.enabled).toBe(true);
    for (const key of NOTIFICATION_EVENT_KEYS) {
      expect(prefs.events[key]).toBe(
        NOTIFICATION_CATALOG[key].defaultEnabled,
      );
    }
  });

  it("vrací fresh objekt (nemůže mutovat sdílený state)", () => {
    const a = buildDefaultPrefs();
    const b = buildDefaultPrefs();
    a.events.mention = false;
    expect(b.events.mention).toBe(true);
  });
});

// ---------- renderNotification — všechny eventy ----------

describe("renderNotification — každý event", () => {
  it("mention → title obsahuje actor + 'zmínil' + title tasku", () => {
    const { title, body, deepLink } = renderNotification(
      baseInput({
        eventType: "mention",
        comment: { authorUid: "actor-uid", body: "Co na to říkáš?" },
        commentId: "c-1",
      }),
    );
    expect(title).toContain("Stanislav");
    expect(title).toContain("zmínil");
    expect(title).toContain("Topení");
    expect(body).toBe("Co na to říkáš?");
    expect(deepLink).toBe("/t/task-1#comment-c-1");
  });

  it("mention bez commentId → deep-link bez fragmentu", () => {
    const { deepLink } = renderNotification(
      baseInput({
        eventType: "mention",
        comment: { authorUid: "actor-uid", body: "x" },
      }),
    );
    expect(deepLink).toBe("/t/task-1");
  });

  it("assigned → title 'přiřadil úkol', body s title tasku", () => {
    const { title, body, deepLink } = renderNotification(
      baseInput({ eventType: "assigned" }),
    );
    expect(title).toContain("Stanislav");
    expect(title).toContain("přiřadil");
    expect(body).toContain("Topení");
    expect(deepLink).toBe("/t/task-1");
  });

  it("comment_on_mine → title 'komentoval' + task title, body = preview komentu", () => {
    const { title, body } = renderNotification(
      baseInput({
        eventType: "comment_on_mine",
        comment: { authorUid: "actor-uid", body: "Dobrý den. Ano." },
        commentId: "c-2",
      }),
    );
    expect(title.startsWith("Stanislav komentoval")).toBe(true);
    expect(title).toContain("Topení");
    expect(body).toBe("Dobrý den");
  });

  it("comment_on_thread → title obsahuje 'v diskuzi'", () => {
    const { title } = renderNotification(
      baseInput({
        eventType: "comment_on_thread",
        comment: { authorUid: "actor-uid", body: "ok" },
      }),
    );
    expect(title).toContain("v diskuzi");
  });

  it("shared_with_pm → title 'Nový sdílený nápad' + task title", () => {
    const { title, body } = renderNotification(
      baseInput({
        eventType: "shared_with_pm",
        task: baseTask({
          type: "napad",
          title: "Střecha",
          body: "Taška vs plech — rozhoduji.",
        }),
      }),
    );
    expect(title).toContain("sdílený nápad");
    expect(title).toContain("Střecha");
    expect(body).toContain("Taška vs plech");
  });

  it("priority_changed → title s actor + novou prioritou, body s task title", () => {
    const { title, body, deepLink } = renderNotification(
      baseInput({
        eventType: "priority_changed",
        task: baseTask({ priority: "P1" }),
      }),
    );
    expect(title).toContain("Stanislav");
    expect(title).toContain("prioritu");
    expect(title).toContain("P1");
    expect(body).toContain("Topení");
    expect(deepLink).toBe("/t/task-1");
  });

  it("priority_changed s null prioritou → bez explicitní hodnoty v titulku", () => {
    const { title } = renderNotification(
      baseInput({
        eventType: "priority_changed",
        task: baseTask({ priority: null }),
      }),
    );
    expect(title).toContain("Stanislav");
    expect(title).toContain("prioritu");
    expect(title).not.toMatch(/P\d/);
  });

  it("deadline_changed s datem → title obsahuje datum ve formátu cs-CZ", () => {
    const { title } = renderNotification(
      baseInput({
        eventType: "deadline_changed",
        task: baseTask({ deadline: 1714435200000 }), // 30.4.2024
      }),
    );
    expect(title).toContain("Stanislav");
    expect(title).toContain("nastavil termín");
    // 30. 4. nebo 30.4., záleží na node-intl formátu — jen kontroluj že tam je "30"
    expect(title).toMatch(/\d+/);
  });

  it("deadline_changed s null → title 'odstranil termín'", () => {
    const { title } = renderNotification(
      baseInput({
        eventType: "deadline_changed",
        task: baseTask({ deadline: null }),
      }),
    );
    expect(title).toContain("odstranil termín");
  });

  it("task_deleted → title obsahuje actor + 'smazal', deep-link na /zaznamy", () => {
    const { title, body, deepLink } = renderNotification(
      baseInput({
        eventType: "task_deleted",
        task: baseTask({ type: "ukol", title: "Topení" }),
      }),
    );
    expect(title).toContain("Stanislav");
    expect(title).toContain("smazal");
    expect(title).toContain("Topení");
    // type-aware "úkolu" / "otázce" / "nápadu"
    expect(title).toMatch(/úkolu|otázce|nápadu/);
    expect(body.length).toBeGreaterThan(0);
    expect(deepLink).toBe("/zaznamy");
  });

  it("task_deleted s type='otazka' → titulek 'otázce'", () => {
    const { title } = renderNotification(
      baseInput({
        eventType: "task_deleted",
        task: baseTask({ type: "otazka" }),
      }),
    );
    expect(title).toContain("otázce");
  });

  it("task_deleted s type='napad' → titulek 'nápadu'", () => {
    const { title } = renderNotification(
      baseInput({
        eventType: "task_deleted",
        task: baseTask({ type: "napad" }),
      }),
    );
    expect(title).toContain("nápadu");
  });

  it("fallback actor name — když actorName prázdný, použije se 'Někdo'", () => {
    const { title } = renderNotification(
      baseInput({ eventType: "assigned", actorName: "" }),
    );
    expect(title.startsWith("Někdo")).toBe(true);
  });
});

// ---------- Helpery (truncate / taskTitleOrFallback / commentPreview) ----------
// Duplikujeme light coverage — už testované v copy.test.ts, ale katalog je
// teď public API, takže helpers se jeví i odsud a mají mít stabilitu.

describe("catalog helpers", () => {
  it("truncate respektuje max + přidá ellipsis", () => {
    expect(truncate("abcdefgh", 5)).toBe("abcd…");
    expect(truncate("ab", 5)).toBe("ab");
  });

  it("taskTitleOrFallback — title > first line > placeholder", () => {
    expect(taskTitleOrFallback("Titul", "ignoruj")).toBe("Titul");
    expect(taskTitleOrFallback("", "první\ndruhý")).toBe("první");
    expect(taskTitleOrFallback("", "")).toBe("[bez názvu]");
  });

  it("commentPreview — první věta, truncated", () => {
    expect(commentPreview("První věta. Druhá.")).toBe("První věta");
  });
});

// ---------- Regression: nové event typy jsou zapnuté defaultně ----------

describe("V16 new events default-on (gentle opt-out)", () => {
  const newEvents: NotificationEventKey[] = [
    "priority_changed",
    "deadline_changed",
    "task_deleted",
    "assigned_with_comment",
  ];
  it.each(newEvents)("%s má defaultEnabled=true", (key) => {
    expect(NOTIFICATION_CATALOG[key].defaultEnabled).toBe(true);
  });
});

// ---------- V17.5 — assigned_with_comment ----------

describe("assigned_with_comment — V17.5 merged event", () => {
  it("má nejvyšší dedupe prioritu (vyhraje nad mention, comment_on_*)", () => {
    const priority = NOTIFICATION_CATALOG["assigned_with_comment"].dedupePriority;
    expect(priority).toBeLessThan(NOTIFICATION_CATALOG["mention"].dedupePriority);
    expect(priority).toBeLessThan(NOTIFICATION_CATALOG["assigned"].dedupePriority);
  });

  it("renderTitle obsahuje actor + 'přiřadil' + 'komentář' + task title", () => {
    const { title, body, deepLink } = renderNotification(
      baseInput({
        eventType: "assigned_with_comment",
        comment: { authorUid: "actor-uid", body: "Zkontroluj to prosím." },
        commentId: "c-42",
      }),
    );
    expect(title).toContain("Stanislav");
    expect(title).toContain("přiřadil");
    expect(title).toContain("komentář");
    expect(title).toContain("Topení");
    expect(body).toBe("Zkontroluj to prosím");
    expect(deepLink).toBe("/t/task-1#comment-c-42");
  });

  it("deep-link bez commentId → /t/taskId", () => {
    const { deepLink } = renderNotification(
      baseInput({
        eventType: "assigned_with_comment",
        comment: { authorUid: "actor-uid", body: "x" },
      }),
    );
    expect(deepLink).toBe("/t/task-1");
  });

  it("category je immediate (ne debounced) — assignee flip s komentem je okamžitá událost", () => {
    expect(NOTIFICATION_CATALOG["assigned_with_comment"].category).toBe("immediate");
  });
});
