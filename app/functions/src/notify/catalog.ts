/**
 * V16.7 — NOTIFICATION CATALOG
 * ===========================================================================
 *
 * SINGLE SOURCE OF TRUTH pro všechny push notifikace v aplikaci.
 *
 * Když chceš vidět "co, kdy a komu se posílá", otevři tenhle soubor — každý
 * event má jednu entry, která popisuje:
 *
 *   - key              → unikátní identifikátor (matchuje client-side prefs)
 *   - category         → "immediate" | "debounced" (V16.5)
 *   - dedupePriority   → nižší = vyhraje (mention < assigned < comment_on_mine ...)
 *   - trigger          → lidská dokumentace, kdy se spouští + KDE v kódu
 *   - recipients       → lidská dokumentace, kdo dostane notifikaci
 *   - renderTitle      → čistá funkce co vrátí text pro titulek push notifikace
 *   - renderBody       → čistá funkce co vrátí text pro tělo push notifikace
 *   - renderDeepLink   → kam odkaz z notifikace vede (relativní URL v aplikaci)
 *   - clientLabelKey   → i18n key v namespace "notifikace.events" pro Settings toggle
 *
 * Přidání nového event typu je:
 *   1. Rozšířit NotificationEventKey union v types.ts (+ mirror v app/src/types.ts)
 *   2. Přidat entry do NOTIFICATION_CATALOG tady
 *   3. Přidat i18n klíče (cs.json) pro label + hint
 *   4. Přidat UI ikonu do EVENT_UI_SPECS v app/src/lib/notifications.ts
 *   5. Spustit trigger (onTaskWrite / onCommentCreate / ...) který zavolá
 *      sendNotification({ eventType: "<nový_key>", ... })
 *
 * Kroky 1–4 dělají jen data; krok 5 je jediný imperativ. Žádná jiná místa
 * v kódu notifikaci "nezná" — render pipeline vše načítá z katalogu.
 *
 * Čistá funkcionalita pro testovatelnost: renderTitle/Body/DeepLink jsou
 * pure functions bez I/O. Unit testy v catalog.test.ts ověřují všech N
 * eventů snapshoty.
 */

import type {
  NotificationEventKey,
  NotifyInput,
  TaskDoc,
  CommentDoc,
  EventDoc,
  ReportDoc,
} from "./types";

// ---------- Typy ----------

/**
 * Category řídí jestli se notifikace pošle okamžitě, nebo se nakumuluje
 * do 60s debounce bufferu (V16.5).
 *
 *   - immediate: pošle se ihned z triggeru. Používáme pro komenty, zmínky,
 *     sdílení s PM a smazání tasku — tj. události, kde user čeká na reakci
 *     nebo by pozdní notifikace byla matoucí.
 *   - debounced: nakumuluje se v /debouncedNotifications/{uid_taskId} a
 *     po 60s klidu se pošle jedna souhrnná notifikace. Používáme pro
 *     rychlé editovatelné akce (assignee, priorita, deadline) aby user
 *     nedostal tři pushe za 10 sekund kdy PM nastavuje úkol.
 */
export type EventCategory = "immediate" | "debounced";

/** Kontext, který dostane render funkce. Pure data — žádný Firestore.
 *
 *  V18 — task/event jsou volitelné; katalogová entry ví co přesně má
 *  (podle eventType). Render funkce sahá na relevantní pole. */
export interface RenderContext {
  /** Task-scope context (tasky, komenty). */
  task?: TaskDoc;
  taskId?: string;
  /** V18 — event-scope context (kalendářové události). */
  event?: EventDoc;
  eventId?: string;
  actorName: string;
  comment?: CommentDoc;
  commentId?: string;
  /** V18-S05 — aktuální RSVP answer (pro event_rsvp_response render). */
  rsvpAnswer?: "yes" | "no";
  /** V26 — site report scope. */
  report?: ReportDoc;
  reportId?: string;
}

export interface NotificationSpec {
  key: NotificationEventKey;
  category: EventCategory;
  /** 1 = nejvyšší priorita (vyhraje při dedupe). */
  dedupePriority: number;
  /** Lidská dokumentace: kdy a kde se spouští. */
  trigger: string;
  /** Lidská dokumentace: kdo to dostane. */
  recipients: string;
  renderTitle: (ctx: RenderContext) => string;
  renderBody: (ctx: RenderContext) => string;
  renderDeepLink: (ctx: RenderContext) => string;
  /** i18n key v namespace "notifikace.events" (klient Settings). */
  clientLabelKey: string;
  /** Je default zapnutý? Všechny dnes existující true (gentle opt-out). */
  defaultEnabled: boolean;
  /** V18-S12 — meta-notifikace posílané sobě (self-confirm akce).
   *  Když true, sendNotification self-filter (actor == recipient) se
   *  pro tento event vypne. Default false — standard je potlačit self
   *  notifikace. */
  allowSelf?: boolean;
}

// ---------- Helpery pro render ----------

const BODY_MAX = 120;
const TITLE_FALLBACK = "[bez názvu]";

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export function taskTitleOrFallback(
  title?: string | null,
  body?: string | null,
): string {
  const t = (title ?? "").trim();
  if (t) return t;
  const firstLine = (body ?? "").split("\n")[0]?.trim();
  if (firstLine) return truncate(firstLine, 60);
  return TITLE_FALLBACK;
}

export function commentPreview(commentBody: string): string {
  const first = commentBody.split(/\n|\. |\? |! /)[0] ?? "";
  return truncate(first.trim(), BODY_MAX);
}

function taskTypeLabel(type: TaskDoc["type"]): string {
  if (type === "otazka") return "otázce";
  if (type === "ukol") return "úkolu";
  return "nápadu";
}

/**
 * V18 — format event datetime pro push notifikaci.
 * "14. 5. 14:00" nebo "14. 5." pokud all-day. Krátké aby vešlo do title.
 */
function formatEventWhen(event: EventDoc): string {
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return "";
  const date = start.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
  });
  if (event.isAllDay) return date;
  const time = start.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

// ---------- Katalog ----------

/**
 * Každý eventType má jednu entry. Pořadí v objektu nemá význam (klíče se
 * iterují přes NOTIFICATION_EVENT_KEYS array níž).
 */
export const NOTIFICATION_CATALOG: Record<NotificationEventKey, NotificationSpec> = {
  mention: {
    key: "mention",
    category: "immediate",
    dedupePriority: 1,
    trigger:
      "triggers/onCommentCreate.ts — když comment.mentionedUids obsahuje alespoň jeden uid",
    recipients:
      "Všichni uživatelé explicitně zmínění přes @mention v komentáři (minus autor komentáře — self-filter)",
    renderTitle: (ctx) =>
      `${ctx.actorName} tě zmínil: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        50,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "mention",
    defaultEnabled: true,
  },

  assigned: {
    key: "assigned",
    category: "debounced",
    dedupePriority: 2,
    trigger:
      "triggers/onTaskWrite.ts — při CREATE s assigneeUid != createdBy, nebo při UPDATE kdy assigneeUid změněn (null → X nebo X → Y)",
    recipients:
      "Nový assignee (after.assigneeUid). Self-filter: pokud actor sám sebe nastavuje, notifikace se nepošle.",
    renderTitle: (ctx) => `${ctx.actorName} ti přiřadil úkol`,
    renderBody: (ctx) =>
      `${taskTitleOrFallback(ctx.task!.title, ctx.task!.body)} — otevři a pojď do toho`,
    renderDeepLink: (ctx) => `/t/${ctx.taskId}`,
    clientLabelKey: "assigned",
    defaultEnabled: true,
  },

  comment_on_mine: {
    key: "comment_on_mine",
    category: "immediate",
    dedupePriority: 3,
    trigger:
      "triggers/onCommentCreate.ts — když autor komentáře != autor tasku (task.createdBy)",
    recipients:
      "Autor tasku (task.createdBy), pokud není sám autorem komentáře. Dedupe: pokud je zároveň @mention, vyhraje mention.",
    renderTitle: (ctx) =>
      `${ctx.actorName} komentoval: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        50,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "comment_on_mine",
    defaultEnabled: true,
  },

  comment_on_thread: {
    key: "comment_on_thread",
    category: "immediate",
    dedupePriority: 4,
    trigger:
      "triggers/onCommentCreate.ts — když existují prior komentátoři (distinct authorUids ze starších komentů)",
    recipients:
      "Každý kdo dříve v threadu komentoval (kromě autora nového komentáře). Dedupe: @mention > comment_on_mine > tento event.",
    renderTitle: (ctx) =>
      `${ctx.actorName} v diskuzi: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        50,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "comment_on_thread",
    defaultEnabled: true,
  },

  shared_with_pm: {
    key: "shared_with_pm",
    category: "immediate",
    dedupePriority: 5,
    trigger:
      "triggers/onTaskWrite.ts — při CREATE napadu s sharedWithRoles obsahuje roli, nebo při UPDATE kdy se role přidá do sharedWithRoles",
    recipients:
      "Všichni uživatelé s role == 'PROJECT_MANAGER' (fan-out přes resolvePmUids). Self-filter: pokud je PM zároveň autor, nedostane.",
    renderTitle: (ctx) =>
      `Nový sdílený nápad: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        60,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.task!.body ?? ""),
    renderDeepLink: (ctx) => `/t/${ctx.taskId}`,
    clientLabelKey: "shared_with_pm",
    defaultEnabled: true,
  },

  priority_changed: {
    key: "priority_changed",
    category: "debounced",
    dedupePriority: 6,
    trigger:
      "triggers/onTaskWrite.ts — při UPDATE kdy before.priority !== after.priority a after.assigneeUid != null",
    recipients:
      "Protistrana: kdo z {createdBy, assigneeUid} NENÍ actor. Nikdy self (actor vlastní změnu). Platí jen když je task aktuálně na někom assignutý.",
    renderTitle: (ctx) =>
      `${ctx.actorName} změnil prioritu${
        ctx.task!.priority ? ` na ${ctx.task!.priority}` : ""
      }`,
    renderBody: (ctx) =>
      `${taskTitleOrFallback(ctx.task!.title, ctx.task!.body)}`,
    renderDeepLink: (ctx) => `/t/${ctx.taskId}`,
    clientLabelKey: "priority_changed",
    defaultEnabled: true,
  },

  deadline_changed: {
    key: "deadline_changed",
    category: "debounced",
    dedupePriority: 7,
    trigger:
      "triggers/onTaskWrite.ts — při UPDATE kdy before.deadline !== after.deadline a after.assigneeUid != null",
    recipients:
      "Protistrana (viz priority_changed). Platí jen pro assignuté tasky.",
    renderTitle: (ctx) => {
      if (ctx.task!.deadline == null) {
        return `${ctx.actorName} odstranil termín`;
      }
      const d = new Date(ctx.task!.deadline);
      const formatted = Number.isNaN(d.getTime())
        ? "?"
        : d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
      return `${ctx.actorName} nastavil termín na ${formatted}`;
    },
    renderBody: (ctx) =>
      `${taskTitleOrFallback(ctx.task!.title, ctx.task!.body)}`,
    renderDeepLink: (ctx) => `/t/${ctx.taskId}`,
    clientLabelKey: "deadline_changed",
    defaultEnabled: true,
  },

  task_deleted: {
    key: "task_deleted",
    category: "immediate",
    dedupePriority: 8,
    trigger:
      "triggers/onTaskDeleted.ts — při smazání tasku (event.data je before-snapshot)",
    recipients:
      "Autor tasku (createdBy) + všichni prior komentátoři. Self-filter: actor neincluded.",
    renderTitle: (ctx) =>
      `${ctx.actorName} smazal ${taskTypeLabel(ctx.task!.type)}: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        50,
      )}`,
    renderBody: () => "Záznam byl smazán.",
    // Task už neexistuje — odkaz vedeme na listing, ne na /t/{id}.
    renderDeepLink: () => `/zaznamy`,
    clientLabelKey: "task_deleted",
    defaultEnabled: true,
  },

  event_invitation: {
    key: "event_invitation",
    category: "immediate",
    // Dedupe priority ~10: nižší než comment events (1-4), nevyhraje
    // nad @mention v komentáři, ale vyhraje nad generic task updates.
    // V praxi je event_invitation téměř vždy sám — jen při rare case
    // "pozvali mě na event A jedním dechem jsem mění priority na tasku B"
    // by mohlo dojít k dedupe.
    dedupePriority: 10,
    trigger:
      "triggers/onEventWrite.ts — při CREATE /events/{id} (V18-S04)",
    recipients:
      "Všichni uživatelé v inviteeUids kromě creatorUid (autor sám sebe nepozývá).",
    renderTitle: (ctx) =>
      `${ctx.actorName} tě pozval: ${truncate(ctx.event?.title ?? "[bez názvu]", 50)}`,
    renderBody: (ctx) =>
      ctx.event ? formatEventWhen(ctx.event) : "",
    renderDeepLink: (ctx) =>
      ctx.eventId ? `/event/${ctx.eventId}` : "/events",
    clientLabelKey: "event_invitation",
    defaultEnabled: true,
  },

  event_rsvp_response: {
    key: "event_rsvp_response",
    category: "immediate",
    // Priorita 11 — těsně pod event_invitation. Autor dostává typicky
    // 2-3 RSVP notifikace per event (od každého pozvaného), dedupe
    // není kritický.
    dedupePriority: 11,
    trigger:
      "triggers/onRsvpWrite.ts — při CREATE nebo UPDATE /events/{id}/rsvps/{uid} (V18-S05)",
    recipients:
      "Pouze autor eventu (event.createdBy). Respondent sám sebe nenotifikuje (self-filter v sendNotification).",
    renderTitle: (ctx) => {
      const verb =
        (ctx as { rsvpAnswer?: "yes" | "no" }).rsvpAnswer === "no"
          ? "odmítl"
          : "potvrdil";
      return `${ctx.actorName} ${verb}: ${truncate(
        ctx.event?.title ?? "[bez názvu]",
        50,
      )}`;
    },
    renderBody: (ctx) =>
      ctx.event ? formatEventWhen(ctx.event) : "",
    renderDeepLink: (ctx) =>
      ctx.eventId ? `/event/${ctx.eventId}` : "/events",
    clientLabelKey: "event_rsvp_response",
    defaultEnabled: true,
  },

  event_update: {
    key: "event_update",
    category: "immediate",
    dedupePriority: 12,
    trigger:
      "triggers/onEventWrite.ts — při UPDATE /events/{id} kdy se změnil title, startAt, endAt, isAllDay, address, description nebo inviteeUids (V18-S07)",
    recipients:
      "Všichni existující pozvaní (in both before+after inviteeUids) kromě actora. Nově přidaní dostanou místo toho event_invitation; odebraní event_uninvited.",
    renderTitle: (ctx) =>
      `${ctx.actorName} upravil: ${truncate(
        ctx.event?.title ?? "[bez názvu]",
        50,
      )}`,
    renderBody: (ctx) =>
      ctx.event ? formatEventWhen(ctx.event) : "",
    renderDeepLink: (ctx) =>
      ctx.eventId ? `/event/${ctx.eventId}` : "/events",
    clientLabelKey: "event_update",
    defaultEnabled: true,
  },

  event_uninvited: {
    key: "event_uninvited",
    category: "immediate",
    dedupePriority: 13,
    trigger:
      "triggers/onEventWrite.ts — při UPDATE /events/{id} kdy autor odebral user z inviteeUids (V18-S07)",
    recipients:
      "Pozvaní, kteří byli v before.inviteeUids ale nejsou v after.inviteeUids. Actor se nikdy nenotifikuje.",
    renderTitle: (ctx) =>
      `${ctx.actorName} tě vyškrtl z události: ${truncate(
        ctx.event?.title ?? "[bez názvu]",
        40,
      )}`,
    renderBody: (ctx) =>
      ctx.event ? formatEventWhen(ctx.event) : "",
    // Deep-link na /events (list) — uninvitee už nemá přístup k detailu;
    // rules dovolují read všem signedIn, takže detail by prošel, ale UX
    // zní divně "klikneš na notifikaci → uvidíš event kde už nejsi".
    renderDeepLink: () => `/events`,
    clientLabelKey: "event_uninvited",
    defaultEnabled: true,
  },

  event_rsvp_reminder: {
    key: "event_rsvp_reminder",
    category: "immediate",
    // Priorita 15 — pro-active reminder, nejníž v pořadí. Prakticky nikdy
    // nedoráží ve stejném batch commitu jako jiný event (je to scheduled
    // CF běžící hodinově).
    dedupePriority: 15,
    trigger:
      "scheduled/rsvpReminder.ts — každou hodinu: events s startAt za 23-25h bez reminderSentAt (V18-S13)",
    recipients:
      "Invitees co dosud nemají /events/{id}/rsvps/{uid} záznam (žádné yes/no). Kdo už odpověděl (v jakékoliv formě) reminder nedostává.",
    renderTitle: (ctx) =>
      `Připomenutí: ${truncate(ctx.event?.title ?? "[bez názvu]", 50)}`,
    renderBody: (ctx) =>
      ctx.event
        ? `Zítra ${formatEventWhen(ctx.event)} — dej vědět, jestli dorazíš.`
        : "Zítra — dej vědět, jestli dorazíš.",
    renderDeepLink: (ctx) =>
      ctx.eventId ? `/event/${ctx.eventId}` : "/events",
    clientLabelKey: "event_rsvp_reminder",
    defaultEnabled: true,
  },

  event_calendar_token_reset: {
    key: "event_calendar_token_reset",
    category: "immediate",
    // Priorita 14 — meta-notifikace, nekonkuruje s event-scope. Self
    // notification (recipient == actor), dedupe prakticky irrelevantní.
    dedupePriority: 14,
    trigger:
      "triggers/onUserWrite.ts — při UPDATE /users/{uid} kdy calendarTokenRotatedAt se změnil (V18-S12)",
    recipients:
      "User sám sobě — potvrzení že reset proběhl. Self-notifikace: sendNotification self-filter se pro tento event vypíná (recipient == actor).",
    renderTitle: () => "Kalendář token resetován",
    renderBody: () =>
      "Stará subscription URL přestala platit. V Nastavení si zkopíruj novou a nahraď v Apple Calendar.",
    renderDeepLink: () => "/nastaveni#kalendar",
    clientLabelKey: "event_calendar_token_reset",
    defaultEnabled: true,
    allowSelf: true,
  },

  document_uploaded: {
    key: "document_uploaded",
    category: "immediate",
    dedupePriority: 16,
    trigger:
      "triggers/onTaskWrite.ts — při UPDATE dokumentace kdy documents[] se prodloužil (V20)",
    recipients:
      "Protistrana: pokud je sdílená přes sharedWithRoles → PM. Pokud PM nahrál → OWNER (createdBy). Self-filter: actor nedostane.",
    renderTitle: (ctx) =>
      `Nový dokument: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        60,
      )}`,
    renderBody: (ctx) => {
      const docs = (ctx.task as unknown as { documents?: { displayName: string }[] }).documents;
      const last = docs?.[docs.length - 1];
      return last ? last.displayName : "Byl nahrán nový dokument.";
    },
    renderDeepLink: (ctx) => `/t/${ctx.taskId}`,
    clientLabelKey: "document_uploaded",
    defaultEnabled: true,
  },

  event_cancelled: {
    key: "event_cancelled",
    category: "immediate",
    // Priorita 9 — nad event_invitation (10), protože cancel je časově
    // citlivý a má vyhrát pokud autor během 60s pozval a pak zrušil
    // (nepravděpodobné, ale cancel > invite by měl platit).
    dedupePriority: 9,
    trigger:
      "triggers/onEventWrite.ts — při UPDATE /events/{id} kdy before.status != 'CANCELLED' a after.status == 'CANCELLED' (V18-S08)",
    recipients:
      "Všichni aktuální invitees (after.inviteeUids) kromě actora. Autor sám sebe nenotifikuje (self-filter).",
    renderTitle: (ctx) =>
      `${ctx.actorName} zrušil událost: ${truncate(
        ctx.event?.title ?? "[bez názvu]",
        50,
      )}`,
    renderBody: (ctx) =>
      ctx.event ? formatEventWhen(ctx.event) : "",
    // Deep-link na detail — pozvaní tam uvidí "Zrušeno" + strike-through.
    renderDeepLink: (ctx) =>
      ctx.eventId ? `/event/${ctx.eventId}` : "/events",
    clientLabelKey: "event_cancelled",
    defaultEnabled: true,
  },

  assigned_with_comment: {
    key: "assigned_with_comment",
    category: "immediate",
    // V17.5 — vyšší priorita než mention (1), aby v dedupe vyhrál i když
    //   nový assignee je zároveň @zmíněn v komentáři. Cíl: jedna jasná
    //   notifikace "dostal jsi úkol + komentář" místo dvou.
    dedupePriority: 0,
    trigger:
      "triggers/onCommentCreate.ts — comment má priorAssigneeUid != assigneeAfter (flip)",
    recipients:
      "Pouze nový assignee (assigneeAfter), pokud se liší od původního a není to actor sám. Ostatní účastníci threadu dostanou normální comment_on_* / mention.",
    renderTitle: (ctx) =>
      `${ctx.actorName} ti přiřadil + komentář: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        40,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "assigned_with_comment",
    defaultEnabled: true,
  },

  // ---------- V25 — task lifecycle akcí ----------

  task_completed: {
    key: "task_completed",
    category: "immediate",
    // V25 dedupe priorita 17 (po document_uploaded=16). Lifecycle akcí
    // jsou nezávislé na ostatních eventech — když přijdou společně s
    // mention/comment, ostatní vyhrávají; to je OK, "Hotovo" stejně
    // dorazí v inboxu jen jednou.
    dedupePriority: 17,
    trigger:
      "triggers/onCommentCreate.ts — comment.workflowAction === 'complete' (V25). Status fliponul na DONE.",
    recipients:
      "Autor tasku (createdBy) + původní assignee, pokud se liší od actora. Ostatní účastníci dostanou comment_on_thread.",
    renderTitle: (ctx) =>
      `${ctx.actorName} dokončil: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        40,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "task_completed",
    defaultEnabled: true,
  },

  task_blocked: {
    key: "task_blocked",
    category: "immediate",
    dedupePriority: 18,
    trigger:
      "triggers/onCommentCreate.ts — comment.workflowAction === 'block' (V25). Status na BLOCKED. Komentář povinný (důvod).",
    recipients:
      "Autor tasku + původní assignee, kromě actora.",
    renderTitle: (ctx) =>
      `${ctx.actorName} blokuje: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        40,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "task_blocked",
    defaultEnabled: true,
  },

  task_unblocked: {
    key: "task_unblocked",
    category: "immediate",
    dedupePriority: 19,
    trigger:
      "triggers/onCommentCreate.ts — comment.workflowAction === 'reopen' z BLOCKED → OPEN (V25).",
    recipients:
      "Autor tasku + nový assignee (assigneeAfter), kromě actora.",
    renderTitle: (ctx) =>
      `${ctx.actorName} odblokoval: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        40,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "task_unblocked",
    defaultEnabled: true,
  },

  task_canceled: {
    key: "task_canceled",
    category: "immediate",
    dedupePriority: 20,
    trigger:
      "triggers/onCommentCreate.ts — comment.workflowAction === 'cancel' (V25). Status → CANCELED.",
    recipients:
      "Autor tasku + původní assignee, kromě actora. Ostatní účastníci přes comment_on_thread.",
    renderTitle: (ctx) =>
      `${ctx.actorName} zrušil: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        40,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "task_canceled",
    defaultEnabled: true,
  },

  task_reopened: {
    key: "task_reopened",
    category: "immediate",
    dedupePriority: 21,
    trigger:
      "triggers/onCommentCreate.ts — comment.workflowAction === 'reopen' z DONE/CANCELED → OPEN (V25).",
    recipients:
      "Nový assignee (assigneeAfter) + autor, kromě actora.",
    renderTitle: (ctx) =>
      `${ctx.actorName} znovu otevřel: ${truncate(
        taskTitleOrFallback(ctx.task!.title, ctx.task!.body),
        40,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.comment?.body ?? ""),
    renderDeepLink: (ctx) =>
      ctx.commentId
        ? `/t/${ctx.taskId}#comment-${ctx.commentId}`
        : `/t/${ctx.taskId}`,
    clientLabelKey: "task_reopened",
    defaultEnabled: true,
  },

  // ---------- V26 — Hlášení ze stavby ----------

  site_report_created: {
    key: "site_report_created",
    category: "immediate",
    // V26 — broadcast hlášení. Priorita 22 (po task_reopened=21). Lifecycle
    //   nezávislé na ostatních eventech, žádné dedupe konflikty s mention/comment.
    dedupePriority: 22,
    trigger:
      "triggers/onReportWrite.ts — když /reports/{id} doc se vytvoří. Fan-out na všechny workspace useři kromě actora.",
    recipients:
      "Všichni workspace users (kromě autora). Self-filter v sendNotification.",
    renderTitle: (ctx) => {
      const importance = ctx.report?.importance ?? "normal";
      const prefix =
        importance === "critical"
          ? "🚨 Kritické: "
          : importance === "important"
            ? "⚠️ Důležité: "
            : "📣 ";
      return `${prefix}${ctx.actorName}: ${truncate(ctx.report?.message ?? "", 50)}`;
    },
    renderBody: (ctx) => {
      const m = ctx.report?.message ?? "";
      return m.length > 80 ? `${m.slice(0, 80)}…` : m;
    },
    renderDeepLink: (ctx) =>
      ctx.reportId ? `/hlaseni#r-${ctx.reportId}` : "/hlaseni",
    clientLabelKey: "site_report_created",
    defaultEnabled: true,
  },
};

/**
 * Seznam klíčů v deterministickém pořadí. Iterace přes Object.keys na
 * Records je v JS sice pořadově stabilní, ale katalog se bude rozšiřovat
 * a chceme jasný kontrakt co je "order". Tenhle array je canonical —
 * dedupe priority, client UI render order, testy.
 *
 * Pořadí = pořadí v sort(dedupePriority). Kdo má nižší prio, jde dřív.
 */
export const NOTIFICATION_EVENT_KEYS: NotificationEventKey[] = (
  Object.keys(NOTIFICATION_CATALOG) as NotificationEventKey[]
).sort(
  (a, b) =>
    NOTIFICATION_CATALOG[a].dedupePriority -
    NOTIFICATION_CATALOG[b].dedupePriority,
);

/**
 * Renderuje title/body/deepLink pro daný NotifyInput. Náhrada za starý
 * renderPayload switch v copy.ts. Kompletně pure — žádné I/O, žádný
 * Firestore. Snadno testovatelné.
 */
export function renderNotification(input: NotifyInput): {
  title: string;
  body: string;
  deepLink: string;
} {
  const spec = NOTIFICATION_CATALOG[input.eventType];
  const ctx: RenderContext = {
    task: input.task,
    taskId: input.taskId,
    event: input.event,
    eventId: input.eventId,
    actorName: input.actorName || "Někdo",
    comment: input.comment,
    commentId: input.commentId,
    rsvpAnswer: input.rsvpAnswer,
    report: input.report,
    reportId: input.reportId,
  };
  return {
    title: spec.renderTitle(ctx),
    body: spec.renderBody(ctx),
    deepLink: spec.renderDeepLink(ctx),
  };
}

/**
 * Vrátí všechny event keys seřazené dle dedupe priority (vzestupně =
 * nejvyšší priorita první). Náhrada za starý EVENT_PRIORITY array v
 * dedupe.ts — jediný způsob jak získat seznam, aby byl derivován z katalogu.
 */
export function eventPriorityList(): NotificationEventKey[] {
  return [...NOTIFICATION_EVENT_KEYS];
}

/**
 * Výchozí prefs pro nového uživatele. Každý event v katalogu s
 * defaultEnabled=true → true.
 */
export function buildDefaultPrefs(): {
  enabled: boolean;
  events: Record<NotificationEventKey, boolean>;
} {
  const events = {} as Record<NotificationEventKey, boolean>;
  for (const key of NOTIFICATION_EVENT_KEYS) {
    events[key] = NOTIFICATION_CATALOG[key].defaultEnabled;
  }
  return { enabled: true, events };
}
