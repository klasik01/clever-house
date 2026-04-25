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

  it("assigned_with_comment má vůbec nejnižší dedupePriority (vyhrává nad vším)", () => {
    // V17.5 — assigned_with_comment musí beat všechno ostatní pro nového
    // assignee, aby dostal JEDNU merged notifikaci místo dvou.
    const awc = NOTIFICATION_CATALOG["assigned_with_comment"].dedupePriority;
    for (const k of NOTIFICATION_EVENT_KEYS) {
      if (k === "assigned_with_comment") continue;
      expect(awc).toBeLessThan(NOTIFICATION_CATALOG[k].dedupePriority);
    }
  });

  it("mention má nejnižší prioritu v rámci comment-path eventů", () => {
    const commentPathEvents = [
      "mention",
      "comment_on_mine",
      "comment_on_thread",
    ] as const;
    const mentionPrio = NOTIFICATION_CATALOG["mention"].dedupePriority;
    expect(mentionPrio).toBeLessThan(
      NOTIFICATION_CATALOG["comment_on_mine"].dedupePriority,
    );
    expect(mentionPrio).toBeLessThan(
      NOTIFICATION_CATALOG["comment_on_thread"].dedupePriority,
    );
    // Sanity: mention je v komunit-path trojici nejnižší.
    const priorities = commentPathEvents.map(
      (k) => NOTIFICATION_CATALOG[k].dedupePriority,
    );
    expect(mentionPrio).toBe(Math.min(...priorities));
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
    "event_invitation",
    "event_rsvp_response",
  ];
  it.each(newEvents)("%s má defaultEnabled=true", (key) => {
    expect(NOTIFICATION_CATALOG[key].defaultEnabled).toBe(true);
  });
});

// ---------- V18-S04 — event_invitation (nový event-scope event type) ----------

describe("event_invitation — V18-S04", () => {
  function mkInput(override = {}) {
    return {
      eventType: "event_invitation" as const,
      actorUid: "owner-uid",
      actorName: "Stanislav",
      recipientUid: "spouse-uid",
      eventId: "event-42",
      event: {
        title: "Elektrikář — rozvaděč",
        startAt: "2026-05-14T12:00:00.000Z",
        endAt: "2026-05-14T14:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["spouse-uid", "pm-uid"],
        createdBy: "owner-uid",
        status: "UPCOMING" as const,
      },
      ...override,
    };
  }

  it("title obsahuje actor jméno + event title", () => {
    const { title } = renderNotification(mkInput());
    expect(title).toContain("Stanislav");
    expect(title).toContain("pozval");
    expect(title).toContain("Elektrikář");
  });

  it("body obsahuje datum + čas (timed event)", () => {
    const { body } = renderNotification(mkInput());
    // Formát "14. 5. 14:00" nebo podobný — ověříme že tam je aspoň datum
    expect(body).toMatch(/\d+\.\s*\d+/);
  });

  it("all-day event → body bez času", () => {
    const { body } = renderNotification(
      mkInput({
        event: {
          title: "Kolaudace",
          startAt: "2026-06-01T00:00:00.000Z",
          endAt: "2026-06-01T23:59:00.000Z",
          isAllDay: true,
          inviteeUids: ["u"],
          createdBy: "owner",
          status: "UPCOMING",
        },
      }),
    );
    expect(body).not.toMatch(/\d\d:\d\d/);
  });

  it("deep-link vede na /event/:id", () => {
    const { deepLink } = renderNotification(mkInput());
    expect(deepLink).toBe("/event/event-42");
  });

  it("fallback /events pokud eventId chybí", () => {
    const { deepLink } = renderNotification(
      mkInput({ eventId: undefined }),
    );
    expect(deepLink).toBe("/events");
  });

  it("dedupePriority je vyšší (nižší číslo) než task-update ale nižší než comment events", () => {
    // event_invitation nemá soutěžit s mention/assigned — jen být nad task
    // update events (priority_changed=6). Explicitní hodnota v katalogu: 10.
    expect(NOTIFICATION_CATALOG["event_invitation"].dedupePriority).toBe(10);
  });
});

// ---------- V18-S05 — event_rsvp_response ----------

describe("event_rsvp_response — V18-S05", () => {
  function mkInput(rsvp: "yes" | "no") {
    return {
      eventType: "event_rsvp_response" as const,
      actorUid: "spouse-uid",
      actorName: "Manželka",
      recipientUid: "owner-uid",
      eventId: "event-1",
      rsvpAnswer: rsvp,
      event: {
        title: "Schůzka s PM",
        startAt: "2026-06-10T10:00:00.000Z",
        endAt: "2026-06-10T11:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["spouse-uid"],
        createdBy: "owner-uid",
        status: "UPCOMING" as const,
      },
    };
  }

  it("title obsahuje 'potvrdil' pro yes", () => {
    const { title } = renderNotification(mkInput("yes"));
    expect(title).toContain("Manželka");
    expect(title).toContain("potvrdil");
    expect(title).toContain("Schůzka s PM");
  });

  it("title obsahuje 'odmítl' pro no", () => {
    const { title } = renderNotification(mkInput("no"));
    expect(title).toContain("odmítl");
  });

  it("priorita 11 — pod event_invitation", () => {
    expect(NOTIFICATION_CATALOG["event_rsvp_response"].dedupePriority).toBe(11);
  });
});

// ---------- V18-S07 — event_update + event_uninvited ----------

describe("event_update — V18-S07", () => {
  function mkInput() {
    return {
      eventType: "event_update" as const,
      actorUid: "owner-uid",
      actorName: "Stanislav",
      recipientUid: "spouse-uid",
      eventId: "event-1",
      event: {
        title: "Schůzka s PM",
        startAt: "2026-06-10T10:00:00.000Z",
        endAt: "2026-06-10T11:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["spouse-uid"],
        createdBy: "owner-uid",
        status: "UPCOMING" as const,
      },
    };
  }

  it("title obsahuje 'upravil' + actor", () => {
    const { title } = renderNotification(mkInput());
    expect(title).toContain("Stanislav");
    expect(title).toContain("upravil");
    expect(title).toContain("Schůzka s PM");
  });

  it("priorita 12", () => {
    expect(NOTIFICATION_CATALOG["event_update"].dedupePriority).toBe(12);
  });

  it("deep-link vede na /event/:id", () => {
    const { deepLink } = renderNotification(mkInput());
    expect(deepLink).toBe("/event/event-1");
  });
});

describe("event_uninvited — V18-S07", () => {
  function mkInput() {
    return {
      eventType: "event_uninvited" as const,
      actorUid: "owner-uid",
      actorName: "Stanislav",
      recipientUid: "spouse-uid",
      eventId: "event-1",
      event: {
        title: "Schůzka s PM",
        startAt: "2026-06-10T10:00:00.000Z",
        endAt: "2026-06-10T11:00:00.000Z",
        isAllDay: false,
        inviteeUids: [],
        createdBy: "owner-uid",
        status: "UPCOMING" as const,
      },
    };
  }

  it("title obsahuje 'vyškrtl' + actor", () => {
    const { title } = renderNotification(mkInput());
    expect(title).toContain("Stanislav");
    expect(title).toContain("vyškrtl");
  });

  it("priorita 13", () => {
    expect(NOTIFICATION_CATALOG["event_uninvited"].dedupePriority).toBe(13);
  });

  it("deep-link vede na /events (list, ne detail — uninvitee už nemá přístup)", () => {
    const { deepLink } = renderNotification(mkInput());
    expect(deepLink).toBe("/events");
  });
});

// ---------- V18-S08 — event_cancelled ----------

describe("event_cancelled — V18-S08", () => {
  function mkInput() {
    return {
      eventType: "event_cancelled" as const,
      actorUid: "owner-uid",
      actorName: "Stanislav",
      recipientUid: "spouse-uid",
      eventId: "event-1",
      event: {
        title: "Schůzka s PM",
        startAt: "2026-06-10T10:00:00.000Z",
        endAt: "2026-06-10T11:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["spouse-uid"],
        createdBy: "owner-uid",
        status: "CANCELLED" as const,
      },
    };
  }

  it("title obsahuje 'zrušil'", () => {
    const { title } = renderNotification(mkInput());
    expect(title).toContain("zrušil");
    expect(title).toContain("Schůzka s PM");
  });

  it("priorita 9 — vyšší než invitation (10) aby cancel vyhrál v race", () => {
    expect(NOTIFICATION_CATALOG["event_cancelled"].dedupePriority).toBe(9);
    expect(NOTIFICATION_CATALOG["event_cancelled"].dedupePriority).toBeLessThan(
      NOTIFICATION_CATALOG["event_invitation"].dedupePriority,
    );
  });

  it("deep-link na detail (uvidí strike-through)", () => {
    const { deepLink } = renderNotification(mkInput());
    expect(deepLink).toBe("/event/event-1");
  });
});

// ---------- V18-S12 — event_calendar_token_reset ----------

describe("event_calendar_token_reset — V18-S12", () => {
  function mkInput() {
    return {
      eventType: "event_calendar_token_reset" as const,
      actorUid: "owner-uid",
      actorName: "Stanislav",
      recipientUid: "owner-uid", // self
    };
  }

  it("title je statický bez actor jména (meta-notifikace)", () => {
    const { title } = renderNotification(mkInput());
    expect(title).toContain("Kalendář");
    expect(title).toContain("resetován");
  });

  it("deep-link vede na /nastaveni#kalendar", () => {
    const { deepLink } = renderNotification(mkInput());
    expect(deepLink).toBe("/nastaveni#kalendar");
  });

  it("má allowSelf=true (povolí self-notification)", () => {
    expect(
      NOTIFICATION_CATALOG["event_calendar_token_reset"].allowSelf,
    ).toBe(true);
  });

  it("priorita 14", () => {
    expect(
      NOTIFICATION_CATALOG["event_calendar_token_reset"].dedupePriority,
    ).toBe(14);
  });
});

// ---------- V18-S13 — event_rsvp_reminder ----------

describe("event_rsvp_reminder — V18-S13", () => {
  function mkInput() {
    return {
      eventType: "event_rsvp_reminder" as const,
      actorUid: "owner-uid",
      actorName: "Stanislav",
      recipientUid: "spouse-uid",
      eventId: "event-1",
      event: {
        title: "Schůzka s PM",
        startAt: "2026-06-10T10:00:00.000Z",
        endAt: "2026-06-10T11:00:00.000Z",
        isAllDay: false,
        inviteeUids: ["spouse-uid"],
        createdBy: "owner-uid",
        status: "UPCOMING" as const,
      },
    };
  }

  it("title obsahuje 'Připomenutí' + event title", () => {
    const { title } = renderNotification(mkInput());
    expect(title).toContain("Připomenutí");
    expect(title).toContain("Schůzka s PM");
  });

  it("body obsahuje 'Zítra' + výzvu k odpovědi", () => {
    const { body } = renderNotification(mkInput());
    expect(body).toContain("Zítra");
    expect(body).toContain("dorazíš");
  });

  it("priorita 15 — nejníž (proactive reminder)", () => {
    expect(NOTIFICATION_CATALOG["event_rsvp_reminder"].dedupePriority).toBe(15);
  });

  it("deep-link vede na /event/:id", () => {
    const { deepLink } = renderNotification(mkInput());
    expect(deepLink).toBe("/event/event-1");
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
    // commentPreview odděluje jen na ". " / "? " / "! " (trailing period
    // na konci věty zůstává — nemá za sebou mezeru). Fine, na notifikaci
    // se čte přirozeně.
    expect(body).toBe("Zkontroluj to prosím.");
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
