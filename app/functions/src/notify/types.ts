/**
 * Shared types for the Cloud Functions side of the push pipeline.
 * Duplicates a subset of the app's @/types because Functions is its own
 * package and can't import across Vite path aliases. Keep field names
 * identical to Firestore shape on both sides — drift = silent bugs.
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
  | "document_uploaded"            // V20
  | "task_completed"               // V25
  | "task_blocked"                 // V25
  | "task_unblocked"               // V25
  | "task_canceled"                // V25
  | "task_reopened";               // V25

export interface NotificationPrefs {
  enabled: boolean;
  events: Record<NotificationEventKey, boolean>;
}

export interface NotificationDevice {
  id: string;
  token: string;
  platform: "ios" | "android" | "desktop";
  userAgent: string;
}

export interface TaskDoc {
  type: "napad" | "otazka" | "ukol" | "dokumentace";
  title?: string;
  body?: string;
  assigneeUid?: string | null;
  createdBy: string;
  /** V17.1 — snapshot role tvůrce (OWNER/PROJECT_MANAGER). Legacy tasky fallback OWNER. */
  authorRole?: "OWNER" | "PROJECT_MANAGER" | "CONSTRUCTION_MANAGER";
  /** V19 — role-based sharing (replaces legacy sharedWithPm boolean).
   *  V24 — CONSTRUCTION_MANAGER joined the union for stavbyvedoucí share. */
  sharedWithRoles?: ("OWNER" | "PROJECT_MANAGER" | "CONSTRUCTION_MANAGER")[];
  status?: string;
  /** V16.4 — P1/P2/P3. Null = nenastaveno. */
  priority?: "P1" | "P2" | "P3" | null;
  /** V16.4 — unix millis. Null = bez termínu. */
  deadline?: number | null;
}

export interface CommentDoc {
  authorUid: string;
  body: string;
  mentionedUids?: string[];
  /** V4 + V25 — komentový workflow akcí. Legacy "close" se renderuje jako "complete". */
  workflowAction?: "flip" | "close" | "complete" | "block" | "reopen" | "cancel" | null;
  /** V17.5 — hodnota task.assigneeUid PŘED batch commitem. */
  priorAssigneeUid?: string | null;
  /** V17.5 — hodnota task.assigneeUid PO batch commitu (když comment flipuje). */
  assigneeAfter?: string | null;
}

/**
 * V18 — Event doc shape (calendar events). Snapshot toho co bylo
 * v /events/{eventId} při triggeru.
 */
export interface EventDoc {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  address?: string;
  inviteeUids: string[];
  createdBy: string;
  authorRole?: "OWNER" | "PROJECT_MANAGER" | "CONSTRUCTION_MANAGER";
  status: "UPCOMING" | "AWAITING_CONFIRMATION" | "HAPPENED" | "CANCELLED";
  /** V18-S13 — ISO kdy scheduled CF poslal RSVP reminder. Null = nikdy
   *  (nebo ještě ne). Dedupe flag aby invitees nedostali reminder 2×. */
  reminderSentAt?: string | null;
}

/** A resolved notification ready to send — actor, recipient, event key
 *  plus the task or event context we render into copy.
 *
 *  V18 — `task`/`taskId` jsou volitelné (dřív povinné). Event notifikace
 *  nesou `event`/`eventId` místo nich. Render path v katalogu si vybírá
 *  podle `eventType`. Přesně jeden z obou (task / event) musí být
 *  přítomný — render funkce předpokládá, že katalogová entry ví co
 *  chce. */
export interface NotifyInput {
  eventType: NotificationEventKey;
  actorUid: string;
  actorName: string;
  recipientUid: string;
  taskId?: string;
  task?: TaskDoc;
  commentId?: string;
  comment?: CommentDoc;
  /** V18 — event-scope notifikace. */
  eventId?: string;
  event?: EventDoc;
  /** V18-S05 — aktuální RSVP answer (pro event_rsvp_response render). */
  rsvpAnswer?: "yes" | "no";
}

/**
 * In-app inbox doc shape — written by send.ts after prefs gate passes.
 * Mirrors the FCM payload fields so feed renders without additional reads.
 *
 * V18 — `taskId` volitelné (event notifikace nesou `eventId`). Klient
 * v UI rozhodne podle přítomnosti, kam deep-linknout; nebo použije
 * pre-computed `deepLink` field níž.
 */
export interface NotificationItemWrite {
  eventType: NotificationEventKey;
  taskId?: string | null;
  eventId?: string | null;
  commentId?: string | null;
  actorUid: string;
  actorName: string;
  title: string;
  body: string;
  /** V18 — pre-rendered deep-link z katalogu (/t/:id nebo /event/:id). */
  deepLink: string;
  createdAt: FirebaseFirestore.FieldValue;
  readAt: null;
}
