/**
 * V14 — four task kinds:
 *   "napad"       — OWNER's captured thought / watch-out.
 *   "otazka"      — clarification ping-pong with PM.
 *   "ukol"        — actionable work item with deadline.
 *   "dokumentace" — V19 document record (no workflow status).
 */
export type TaskType = "napad" | "otazka" | "ukol" | "dokumentace";

/**
 * Union of every status a Task can have. Historically role-based values
 * (ON_CLIENT_SITE, ON_PM_SITE — V5) were canonical for otázka. V10 collapses
 * "kdo to řeší" into `assigneeUid`, so status only tracks whether the task
 * is still active (OPEN) or reached a terminal state (BLOCKED / CANCELED / DONE).
 *
 * Legacy values stay in the union — `mapLegacyOtazkaStatus` (see lib/status.ts)
 * collapses them at read time. New writes on otázka only use the V10 canonical
 * set (OPEN | BLOCKED | CANCELED | DONE).
 */
export type TaskStatus =
  | "Nápad"
  | "Otázka"
  | "Čekám"
  | "Rozhodnuto"
  | "Ve stavbě"
  | "Hotovo"
  | "ON_CLIENT_SITE"
  | "ON_PM_SITE"
  | "OPEN"
  | "BLOCKED"
  // CANCELED (US, jedno L) — V10/V14 origin pro tasks. Záměrně se liší od
  // EventStatus.CANCELLED (UK, dvě L) — events musí používat dvě L kvůli
  // ICS RFC 5545 spec compliance (STATUS:CANCELLED). Nesjednocujeme — žádná
  // hodnota se nepoužívá v obou doménách současně, takže drift neškodí.
  | "CANCELED"
  | "DONE";

export type UserRole = "OWNER" | "PROJECT_MANAGER";

export interface ImageAttachment {
  id: string;      // client-side stable id for React keys + delete targeting
  url: string;     // Firebase Storage download URL
  path: string;    // Firebase Storage object path (for deleteObject)
}
/** V19 — a document (PDF or image) attached to a "dokumentace" task record. */
export interface DocumentAttachment {
  id: string;
  fileUrl: string;
  filePath: string;
  contentType: string;
  sizeBytes: number;
  /** Admin-managed document type label (e.g. "Smlouva", "Cenová nabídka"). */
  docType: string;
  /** User-specified display name. Defaults to original filename. */
  displayName: string;
  uploadedBy: string;
  uploadedAt: string;
}

/** V19 — audit log entry for a dokumentace record. */
export interface AuditEntry {
  action: "uploaded" | "replaced" | "deleted" | "metadata_changed";
  actorUid: string;
  timestamp: string;
  /** Free-form details — e.g. which document was affected. */
  details?: string;
}


// ---- V3 additions ----

/** Priority level for otázky. Nápady do not have priority. */
export type TaskPriority = "P1" | "P2" | "P3";

/** Emoji reaction map: emoji → array of UIDs who reacted. */
export type ReactionMap = { [emoji: string]: string[] };

/** V4 — workflow action attached to a comment in the Q&A flow. */
export type CommentWorkflowAction = "flip" | "close";

export interface Comment {
  id: string;
  authorUid: string;
  body: string;                           // plain markdown (Tiptap NOT used here — per B3 decision)
  createdAt: string;                      // ISO timestamp
  editedAt?: string | null;
  attachmentImages?: ImageAttachment[];   // max 3
  attachmentLinks?: string[];             // max 10
  mentionedUids?: string[];               // parsed from @[name](uid) markers in body
  reactions?: ReactionMap;
  /** V4 — if the comment changed task state (flip assignee / close), these track what and to what. */
  workflowAction?: CommentWorkflowAction | null;
  /** Status snapshot after the action — used to colorize history in thread. */
  statusAfter?: TaskStatus | null;
  /** Assignee uid after the flip — for "was handed to {user}" labels. */
  assigneeAfter?: string | null;
  /** V17.5 — uid assignee tasku před batch commitem. Umožňuje CF detekovat
   *  "comment changed assignee" bez before/after task snapshotu (onCommentCreate
   *  ho nemá). CF: pokud priorAssigneeUid != assigneeAfter → posle
   *  assigned_with_comment event. */
  priorAssigneeUid?: string | null;
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  body: string;
  status: TaskStatus;
  /** Legacy single category. Read via bridgeCategoryIds, new writes use categoryIds. */
  categoryId?: string | null;
  /** V3 — N:M kategorie jako chip-field. */
  categoryIds?: string[];
  locationId?: string | null;
  // S26 — array of linked otázka IDs (nápad parent → otázka children)
  linkedTaskIds?: string[];
  // Single parent link (otázka child → nápad parent, also legacy on nápady pre-S26)
  linkedTaskId?: string | null;
  projektantAnswer?: string | null;
  projektantAnswerAt?: string | null;   // S10 — ISO timestamp of PM reply
  // S24 — array of image attachments (V2)
  attachmentImages?: ImageAttachment[];
  // Legacy single-image fields (pre-S24) — bridged by fromDocSnap
  attachmentImageUrl?: string | null;
  attachmentImagePath?: string | null;
  // S25 — array of link URLs (V2)
  attachmentLinks?: string[];
  // Legacy single link (pre-S25)
  attachmentLinkUrl?: string | null;
  // ---- V3 Phase 7 additions (otazka-only for priority/deadline/assignee) ----
  /** V3 priority — only meaningful on otázka. Default "P2" after migration. */
  priority?: TaskPriority;
  /** V3 deadline — ISO date string (YYYY-MM-DD) or ms epoch. null = no deadline. */
  deadline?: number | null;
  /** V3 assignee — whose turn is it. null = unassigned (treated as author's turn). */
  assigneeUid?: string | null;
  /** Cached comment count, maintained via batch writes in lib/comments.ts. */
  commentCount?: number;
  /** V19 — OWNER can share a nápad with specific roles (read-only + comments).
   *  Replaces legacy boolean `sharedWithPm`. Empty array or undefined = private. */
  sharedWithRoles?: UserRole[];
  /** V14 — free-text dependency on an úkol ("před omítkami"). No structured
   *  phase reference; users type whatever makes sense. Null for other types. */
  dependencyText?: string | null;
  /** V14 — "Výstup" markdown summary attached to a nápad. Owner fills this in
   *  when the nápad resolves; it's the durable record of what was decided.
   *  Shown in detail as a second editor below the body. Null for other types. */
  vystup?: string | null;
  /** V19 — documents attached to a "dokumentace" record. */
  documents?: DocumentAttachment[];
  /** V19 — audit trail for dokumentace record. */
  auditLog?: AuditEntry[];
  /** V19 — IDs of "dokumentace" tasks linked from this task. */
  linkedDocIds?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** V17.1 — snapshot role tvůrce ("OWNER" | "PROJECT_MANAGER"). Použito
   *  pro cross-OWNER edit rule: OWNER-created task smí editovat každý OWNER,
   *  PM-created task jen sám autor-PM. Legacy tasky bez tohoto pole fallback
   *  na "OWNER" (historicky v drtivé většině PM-created tasků neexistovalo). */
  authorRole?: UserRole;
}

/**
 * V18 — Events feature.
 *
 * Calendar-aware events with fixed datetime (unlike tasks which have
 * flexible deadlines). Exports to ICS (Apple Calendar, Google Calendar)
 * via per-user webcal subscription and per-event download.
 *
 * Kód anglicky, UI česky (viz CLAUDE.md konvenci).
 */
export type EventStatus =
  | "UPCOMING"                 // Vytvořen, termín nadchází
  | "AWAITING_CONFIRMATION"    // Uplynul termín, autor nepotvrdil (červený v UI)
  | "HAPPENED"                 // Autor potvrdil "proběhlo"
  | "CANCELLED";               // Zrušen (pre-termín nebo retro).
                               //   POZOR: dvě L (UK spelling) je požadavek
                               //   ICS RFC 5545 (STATUS:CANCELLED). Tasks
                               //   používají "CANCELED" (US, jedno L) —
                               //   záměrný drift, viz Status type výše.

export interface Event {
  id: string;
  title: string;
  description: string;                  // volitelný, markdown
  /** ISO timestamp of event start. */
  startAt: string;
  /** ISO timestamp of event end. Must be > startAt. */
  endAt: string;
  /** All-day mode: čas se ignoruje, používá se jen datum. */
  isAllDay: boolean;
  /** Free-text adresa; prázdný string = nevyplněno. */
  address: string;
  /** Uids of invitees (min. 1, may or may not include creator). */
  inviteeUids: string[];
  /** Uid tvůrce eventu. */
  createdBy: string;
  /** Snapshot role autora pro V17.1 cross-OWNER edit rule. */
  authorRole?: UserRole;
  status: EventStatus;
  /** Optional link to a related task (/t/:id). */
  linkedTaskId?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set when author confirms "proběhlo" po termínu. */
  happenedConfirmedAt?: string | null;
  /** Set when event is cancelled (pre-termín nebo retro). */
  cancelledAt?: string | null;
  /** V18-S13 — ISO kdy scheduled CF poslal RSVP reminder. Null = nikdy. */
  reminderSentAt?: string | null;
}

/**
 * V18-S05 — RSVP response na event.
 *
 * Každý invitee si spravuje svůj záznam v subkolekci
 * /events/{eventId}/rsvps/{uid}. Doc id = uid → guaranteed max jeden
 * záznam per pozvaný. Firestore rules: self-write only.
 */
export type RsvpAnswer = "yes" | "no";

export interface Rsvp {
  /** Doc id = uid pozvaného. */
  uid: string;
  response: RsvpAnswer;
  respondedAt: string;
}

export interface Category {
  id: string;
  label: string;
  createdBy: string;
  createdAt: string;
}

export interface DocumentType {
  id: string;
  label: string;
  createdBy: string;
  createdAt: string;
}

/** V7 — locations editable, reduced to 3 groups.
 *  "pozemek" = land / garden / outdoor.
 *  "dum"     = indoor rooms (living, general, hygiene — collapsed).
 *  "site"    = utility / network infrastructure. */
export type LocationGroup = "pozemek" | "dum" | "site";

export interface Location {
  id: string;
  label: string;
  group: LocationGroup;
  /** Only set on user-created records (Firestore-backed). Seeded defaults
   *  don’t need it, but consumers shouldn’t rely on it being set. */
  createdBy?: string;
  createdAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string | null;
  /** V18-S24 — kontakt email pro Apple Calendar matchování s Contacts.
   *  Lišit se od `email` (= auth email z Google sign-in). User si vyplní
   *  v Settings, aby Apple Calendar v ATTENDEE listu matchnul kontakt
   *  v iCloud Contacts a zobrazil vizitku.
   *  Pokud null/prázdné, ICS použije `email` (auth) jako fallback. */
  contactEmail?: string | null;
  /** V15 — push notification preferences. Undefined = legacy record;
   *  readers merge with DEFAULT_PREFS (see lib/notifications.ts). */
  notificationPrefs?: NotificationPrefs;
  /** V18-S12 — webcal subscription token. URL-safe alphanumeric + hyphen.
   *  Undefined = legacy user před migration; resolver si vygeneruje lazily. */
  calendarToken?: string;
  /** V18-S12 — ISO kdy byl token naposledy vygenerován/rotován. */
  calendarTokenRotatedAt?: string;
  /** V18-S25 — ISO timestamp posledního GET requestu na webcal feed (CF
   *  ho updatuje throttled 1× za hodinu). Heuristic indikátor zda user má
   *  aktivní subscription v Apple Calendar (≤25h od fetchu = "Připojeno"). */
  calendarLastFetchedAt?: string;
  /** V18-S30 — ISO kdy user dokončil/přeskočil onboarding modal. Jakmile
   *  je set, modal se už nezobrazí. Undefined = nový/legacy user → modal
   *  poběží (pre-fill smart skipuje již vyplněné kroky). */
  onboardingCompletedAt?: string | null;
}

// ==================== V15 — Push notifications ====================

/**
 * Event keys that can trigger a push notification. Order defines the
 * priority used for deduplication when a single actor action makes a
 * recipient eligible for multiple events (e.g. a @mention inside a
 * comment on their own task — mention wins).
 */
export type NotificationEventKey =
  | "mention"
  | "assigned"
  | "comment_on_mine"
  | "comment_on_thread"
  | "shared_with_pm"
  | "priority_changed"    // V16.4
  | "deadline_changed"    // V16.4
  | "task_deleted"       // V16.6
  | "assigned_with_comment" // V17.5
  | "event_invitation"   // V18-S04
  | "event_rsvp_response" // V18-S05
  | "event_update"       // V18-S07
  | "event_uninvited"    // V18-S07
  | "event_cancelled"    // V18-S08
  | "event_calendar_token_reset"   // V18-S12
  | "event_rsvp_reminder"          // V18-S13
  | "document_uploaded";           // V20

/** Per-user notification preferences, stored on the user profile doc. */
export interface NotificationPrefs {
  /** Master switch — when false, no pushes regardless of event toggles. */
  enabled: boolean;
  /** Per-event opt-in/out. Default all true until the user flips. */
  events: Record<NotificationEventKey, boolean>;
}

/**
 * A browser/device registration for push delivery. Lives in
 * users/{uid}/devices/{deviceId}. A single user may have multiple (iPhone
 * PWA + desktop Chrome). deviceId is a stable client-generated UUID held
 * in localStorage so page reloads don't spawn duplicates.
 */
export interface NotificationDevice {
  id: string;
  /** FCM registration token — changes on browser reset or permission flip. */
  token: string;
  /** Low-res platform hint for debugging / future split logic. */
  platform: "ios" | "android" | "desktop";
  userAgent: string;
  createdAt: string;
  /** Bumped on every app load so stale devices can be swept quarterly. */
  lastSeen: string;
}

/**
 * In-app inbox item — mirror of a FCM push that's been delivered (or
 * would've been, had the user had a registered device). Lives in
 * users/{uid}/notifications/{id}. Written by the Cloud Function alongside
 * the FCM send, so the feed stays in sync with push without relying on
 * client-side delivery confirmation.
 *
 * readAt = null means unread (driver for the badge count); setting a
 * timestamp marks it read. There's no delete — cleanup lives in a later
 * scheduled function (TTL ~30 days).
 */
export interface NotificationItem {
  id: string;
  eventType: NotificationEventKey;
  /** V18 — volitelné; event notifikace nesou eventId místo taskId. */
  taskId?: string | null;
  /** V18 — event-scope notifikace. */
  eventId?: string | null;
  commentId?: string | null;
  actorUid: string;
  /** Cached at write time so the feed renders without user-collection reads. */
  actorName: string;
  title: string;
  body: string;
  /** V18 — pre-rendered deep-link z katalogu (/t/:id nebo /event/:id).
   *  Legacy records (bez fieldu) mají fallback na taskId path. */
  deepLink?: string;
  createdAt: string;
  readAt: string | null;
}
