export type TaskType = "napad" | "otazka";

export type TaskStatus =
  | "Nápad"
  | "Otázka"
  | "Čekám"
  | "Rozhodnuto"
  | "Ve stavbě"
  | "Hotovo";

export type UserRole = "OWNER" | "PROJECT_MANAGER";

export interface ImageAttachment {
  id: string;      // client-side stable id for React keys + delete targeting
  url: string;     // Firebase Storage download URL
  path: string;    // Firebase Storage object path (for deleteObject)
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  body: string;
  status: TaskStatus;
  categoryId?: string | null;
  locationId?: string | null;
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

export type LocationGroup = "outdoor" | "general" | "living" | "hygiene";

export interface Location {
  id: string;
  label: string;
  group: LocationGroup;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string | null;
}
