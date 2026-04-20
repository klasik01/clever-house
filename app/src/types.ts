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
  title: string;
  body: string;
  status: TaskStatus;
  categoryId?: string | null;
  locationId?: string | null;
  linkedTaskId?: string | null;
  projektantAnswer?: string | null;
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
