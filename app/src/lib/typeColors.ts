import type { TaskType } from "@/types";

/**
 * V23 + V26 — shared color palette for task types.
 * Used in FabRadial (button backgrounds), NapadCard (icon tint),
 * and TaskDetail (type icon color). Single source of truth.
 *
 * V26 — vibrantnější paleta:
 *   - napad: violet-600 (purple)
 *   - dokumentace: emerald-600 (green)
 *   - ukol: orange-500 (Stáňa V26: vyměna red→orange aby red zůstala
 *     pro Hlášení jako naléhavá broadcast barva)
 *   - otazka: amber-400 (yellow, vibrant)
 */
export const TYPE_COLORS: Record<TaskType, string> = {
  napad:       "#7C3AED", // violet-600
  dokumentace: "#059669", // emerald-600
  ukol:        "#F97316", // orange-500 (V26 — bylo red, swapped s Hlášením)
  otazka:      "#FACC15", // amber-400
};

/** Event type color (not a TaskType, used only in FabRadial). */
export const EVENT_COLOR = "#2563EB"; // blue-600

/**
 * V26 — Hlášení (site report) color: red-600. Důraz na broadcast naléhavost.
 *   Vyměněno za úkol (předtím light-blue → light-blue se nehodilo s blue
 *   kalendáře, plus hlášení potřebovalo silnější vizuální signál).
 */
export const REPORT_COLOR = "#DC2626"; // red-600

/**
 * V26-fix — barevná schémata per importance level. Single source of truth
 * pro banner, composer pills, list border-l, list/detail ikony.
 *
 *   - normal:    výrazná modrá (sky-600)
 *   - important: oranžová (orange-500)
 *   - critical:  červená (red-600)
 *
 * `bg` = primary background (banner / pill), `fg` = text barva, `solid` =
 * akcent bez backgroundu (pro icon tint, border-l).
 */
import type { ReportImportance } from "@/types";

export const REPORT_IMPORTANCE_COLORS: Record<
  ReportImportance,
  { bg: string; fg: string; solid: string }
> = {
  normal:    { bg: "#0284C7", fg: "white", solid: "#0284C7" }, // sky-600
  important: { bg: "#F97316", fg: "white", solid: "#F97316" }, // orange-500
  critical:  { bg: "#DC2626", fg: "white", solid: "#DC2626" }, // red-600
};

