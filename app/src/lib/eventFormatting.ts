/**
 * V18-S34 — pure formatting helpery pro Event UI komponenty.
 *
 * Sjednocení dat/čas formátování z EventDetail.DateTimeDisplay,
 * Events.EventCard a (potenciálně) push notifikace render.
 *
 * Konvence: cs-CZ locale + Europe/Prague TZ (default browser-driven),
 * až na all-day kde explicit `timeZone: "UTC"` zachová floating date.
 */
import type { Event } from "@/types";

const CS = "cs-CZ";

/**
 * Long date label pro detail headline ("PONDĚLÍ 14. KVĚTNA 2026").
 * Pro all-day forsuje UTC interpretaci aby cestující user viděl správný den.
 */
export function formatEventDateLong(event: Event): string {
  const d = new Date(event.startAt);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString(CS, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      ...(event.isAllDay ? { timeZone: "UTC" } : {}),
    })
    .toUpperCase();
}

/**
 * Short date label pro list card ("po 14. 5.") — den + datum bez roku
 * a bez velkých písmen, pro hustší kompaktní zobrazení.
 */
export function formatEventDateShort(event: Event): string {
  const d = new Date(event.startAt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(CS, {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    ...(event.isAllDay ? { timeZone: "UTC" } : {}),
  });
}

/**
 * Time range nebo all-day label. Pro timed event vrací "14:00–15:00",
 * pro all-day vrací poskytnutý `allDayLabel` (i18n string z caller-u).
 */
export function formatEventTimeRange(event: Event, allDayLabel: string): string {
  if (event.isAllDay) return allDayLabel;
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const fmt = (d: Date) =>
    d.toLocaleTimeString(CS, { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ---------- Status badge tokens ----------

export type EventStatus = Event["status"];

export interface StatusBadgeTokens {
  /** i18n key v namespace events.status.* — caller přeloží přes t(). */
  i18nKey: string;
  /** CSS variable string pro foreground (text). */
  color: string;
  /** CSS variable string pro background. */
  background: string;
}

/**
 * Pure mapping status → badge tokens. Caller (StatusBadge component)
 * přeloží i18nKey přes `t()` a aplikuje color/bg přes inline style.
 *
 * UPCOMING vrací null — neutrální status, badge se nezobrazí (rendering
 * komponenta vrací prázdný spacer pro layout konzistenci).
 */
export function statusBadgeTokens(status: EventStatus): StatusBadgeTokens | null {
  if (status === "UPCOMING") return null;
  if (status === "AWAITING_CONFIRMATION") {
    return {
      i18nKey: "events.status.awaiting",
      color: "var(--color-status-danger-fg)",
      background: "var(--color-priority-p1-bg)",
    };
  }
  if (status === "HAPPENED") {
    return {
      i18nKey: "events.status.happened",
      color: "var(--color-status-success-fg)",
      background: "var(--color-status-success-bg)",
    };
  }
  // CANCELLED
  return {
    i18nKey: "events.status.cancelled",
    color: "var(--color-ink-subtle)",
    background: "var(--color-bg-subtle)",
  };
}
