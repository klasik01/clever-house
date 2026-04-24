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
  | "shared_with_pm";

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
  sharedWithPm?: boolean;
  status?: string;
}

export interface CommentDoc {
  authorUid: string;
  body: string;
  mentionedUids?: string[];
  workflowAction?: "flip" | "close" | null;
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
