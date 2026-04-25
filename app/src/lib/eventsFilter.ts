/**
 * V18-S33 — pure filter helpery pro Events list route.
 *
 * Extrahované z Events.tsx aby šly testovat bez React renderingu.
 * Kritická logika:
 *   - "Mé eventy" (kde figuruju jako autor nebo invitee)
 *   - upcoming vs past split podle finálního status
 *   - AWAITING bookkeeping pro autora (banner trigger)
 */
import type { Event } from "@/types";

/** Filtruje events kde aktuální user je autor nebo pozvaný. */
export function filterMyEvents(events: Event[], uid: string): Event[] {
  return events.filter(
    (e) => e.createdBy === uid || e.inviteeUids.includes(uid),
  );
}

/**
 * V18-S09 — AWAITING_CONFIRMATION patří mezi upcoming (vyžaduje akci).
 * HAPPENED a CANCELLED jsou finální → past. UPCOMING s prošlým endAt je
 * přechodný stav (scheduled CF ho do hodiny flipne), necháme v upcoming.
 */
export function isPastEvent(event: Event): boolean {
  return event.status === "HAPPENED" || event.status === "CANCELLED";
}

export type EventFilter = "upcoming" | "past";

/**
 * Filtruje events podle upcoming/past + omezení na "moje" (autor/invitee).
 * Default filter = "upcoming" (typický view po otevření /events).
 */
export function filterEventsForUser(
  events: Event[],
  uid: string,
  filter: EventFilter = "upcoming",
): Event[] {
  return filterMyEvents(events, uid).filter((e) => {
    const past = isPastEvent(e);
    return filter === "past" ? past : !past;
  });
}

/**
 * Počet UPCOMING events kde user figuruje a `endAt` je v budoucnu.
 * Slouží pro hint v hlavičce ("N nadcházejících").
 */
export function countUpcomingForUser(
  events: Event[],
  uid: string,
  nowMs: number = Date.now(),
): number {
  return filterMyEvents(events, uid).filter(
    (e) => e.status === "UPCOMING" && Date.parse(e.endAt) >= nowMs,
  ).length;
}

/**
 * Počet AWAITING_CONFIRMATION events kde JÁ jsem autor — trigger pro
 * banner "N událostí čeká na potvrzení". Pozvaným to neukazujeme,
 * potvrzení dělá autor.
 */
export function countAwaitingMine(events: Event[], uid: string): number {
  return events.filter(
    (e) => e.status === "AWAITING_CONFIRMATION" && e.createdBy === uid,
  ).length;
}
