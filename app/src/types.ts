export type TaskType = "napad" | "otazka";

export type TaskStatus =
  | "Nápad"
  | "Otázka"
  | "Čekám"
  | "Rozhodnuto"
  | "Ve stavbě"
  | "Hotovo";

export type UserRole = "OWNER" | "PROJECT_MANAGER";

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
  attachmentImageUrl?: string | null;
  attachmentImagePath?: string | null;
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
