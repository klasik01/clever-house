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

/** Kontext, který dostane render funkce. Pure data — žádný Firestore. */
export interface RenderContext {
  task: TaskDoc;
  taskId: string;
  actorName: string;
  comment?: CommentDoc;
  commentId?: string;
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
        taskTitleOrFallback(ctx.task.title, ctx.task.body),
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
      `${taskTitleOrFallback(ctx.task.title, ctx.task.body)} — otevři a pojď do toho`,
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
        taskTitleOrFallback(ctx.task.title, ctx.task.body),
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
        taskTitleOrFallback(ctx.task.title, ctx.task.body),
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
      "triggers/onTaskWrite.ts — při CREATE napadu s sharedWithPm=true, nebo při UPDATE kdy sharedWithPm: false → true",
    recipients:
      "Všichni uživatelé s role == 'PROJECT_MANAGER' (fan-out přes resolvePmUids). Self-filter: pokud je PM zároveň autor, nedostane.",
    renderTitle: (ctx) =>
      `Nový sdílený nápad: ${truncate(
        taskTitleOrFallback(ctx.task.title, ctx.task.body),
        60,
      )}`,
    renderBody: (ctx) => commentPreview(ctx.task.body ?? ""),
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
        ctx.task.priority ? ` na ${ctx.task.priority}` : ""
      }`,
    renderBody: (ctx) =>
      `${taskTitleOrFallback(ctx.task.title, ctx.task.body)}`,
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
      if (ctx.task.deadline == null) {
        return `${ctx.actorName} odstranil termín`;
      }
      const d = new Date(ctx.task.deadline);
      const formatted = Number.isNaN(d.getTime())
        ? "?"
        : d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
      return `${ctx.actorName} nastavil termín na ${formatted}`;
    },
    renderBody: (ctx) =>
      `${taskTitleOrFallback(ctx.task.title, ctx.task.body)}`,
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
      `${ctx.actorName} smazal ${taskTypeLabel(ctx.task.type)}: ${truncate(
        taskTitleOrFallback(ctx.task.title, ctx.task.body),
        50,
      )}`,
    renderBody: () => "Záznam byl smazán.",
    // Task už neexistuje — odkaz vedeme na listing, ne na /t/{id}.
    renderDeepLink: () => `/zaznamy`,
    clientLabelKey: "task_deleted",
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
    actorName: input.actorName || "Někdo",
    comment: input.comment,
    commentId: input.commentId,
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
