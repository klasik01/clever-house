/**
 * V14 — three task kinds:
 *   "napad"  — OWNER's captured thought / watch-out. Container; can embed a
 *              "výstup" summary when it resolves.
 *   "otazka" — clarification ping-pong with PM. Short-lived.
 *   "ukol"   — actionable work item with deadline + dependency text. Longer-
 *              lived. Can be standalone or linked to a nápad.
 *
 * Both "otazka" and "ukol" share the V10 canonical status set + assignee +
 * comment thread; they differ mostly in what shows on the card and in the
 * TaskDetail meta block.
 */
export type TaskType = "napad" | "otazka" | "ukol";

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
  | "CANCELED"
  | "DONE";

export type UserRole = "OWNER" | "PROJECT_MANAGER";

export interface ImageAttachment {
  id: string;      // client-side stable id for React keys + delete targeting
  url: string;     // Firebase Storage download URL
  path: string;    // Firebase Storage object path (for deleteObject)
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
  /** V3-polish: OWNER can opt-in to share a nápad with PM (read-only for PM). */
  sharedWithPm?: boolean;
  /** V14 — free-text dependency on an úkol ("před omítkami"). No structured
   *  phase reference; users type whatever makes sense. Null for other types. */
  dependencyText?: string | null;
  /** V14 — "Výstup" markdown summary attached to a nápad. Owner fills this in
   *  when the nápad resolves; it's the durable record of what was decided.
   *  Shown in detail as a second editor below the body. Null for other types. */
  vystup?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Category {
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
}
