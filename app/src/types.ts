// Shared types for Chytrý dům na vsi.
// Scope for S01: Task (type=napad only). Later slices add "otazka", categories,
// locations, attachments, roles.

export type TaskType = "napad" | "otazka";

export type TaskStatus =
  | "Nápad"
  | "Otázka"
  | "Čekám"
  | "Rozhodnuto"
  | "Ve stavbě"
  | "Hotovo";

export interface Task {
  id: string;
  type: TaskType;
  title: string; // short label — in S01 derived from first 80 chars of body
  body: string;
  status: TaskStatus;
  // fields added in later slices:
  categoryId?: string | null;
  locationId?: string | null;
  linkedTaskId?: string | null;
  projektantAnswer?: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdBy: string; // in S01 = local user placeholder
}
