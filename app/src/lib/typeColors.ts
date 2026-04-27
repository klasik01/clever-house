import type { TaskType } from "@/types";

/**
 * V23 — shared color palette for task types.
 * Used in FabRadial (button backgrounds), NapadCard (icon tint),
 * and TaskDetail (type icon color). Single source of truth.
 */
export const TYPE_COLORS: Record<TaskType, string> = {
  napad:       "#7C3AED", // purple
  dokumentace: "#16A34A", // green
  ukol:        "#DC2626", // red
  otazka:      "#EAB308", // yellow
};

/** Event type color (not a TaskType, used only in FabRadial). */
export const EVENT_COLOR = "#2563EB"; // blue
