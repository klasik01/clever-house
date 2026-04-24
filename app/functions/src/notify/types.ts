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
  | "assigned_with_comment"; // V17.5

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
  type: "napad" | "otazka" | "ukol";
  title?: string;
  body?: string;
  assigneeUid?: string | null;
  createdBy: string;
  /** V17.1 — snapshot role tvůrce (OWNER/PROJECT_MANAGER). Legacy tasky fallback OWNER. */
  authorRole?: "OWNER" | "PROJECT_MANAGER";
  sharedWithPm?: boolean;
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
  workflowAction?: "flip" | "close" | null;
  /** V17.5 — hodnota task.assigneeUid PŘED batch commitem. */
  priorAssigneeUid?: string | null;
  /** V17.5 — hodnota task.assigneeUid PO batch commitu (když comment flipuje). */
  assigneeAfter?: string | null;
}

/** A resolved notification ready to send — actor, recipient, event key
 *  plus the task (and optionally comment) context we render into copy. */
export interface NotifyInput {
  eventType: NotificationEventKey;
  actorUid: string;
  actorName: string;
  recipientUid: string;
  taskId: string;
  task: TaskDoc;
  commentId?: string;
  comment?: CommentDoc;
}

/**
 * In-app inbox doc shape — written by send.ts after prefs gate passes.
 * Mirrors the FCM payload fields so feed renders without additional reads.
 */
export interface NotificationItemWrite {
  eventType: NotificationEventKey;
  taskId: string;
  commentId?: string | null;
  actorUid: string;
  actorName: string;
  title: string;
  body: string;
  createdAt: FirebaseFirestore.FieldValue;
  readAt: null;
}
