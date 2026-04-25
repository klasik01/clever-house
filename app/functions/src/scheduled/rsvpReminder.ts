/**
 * V18-S13 — RSVP reminder 24h před eventem.
 *
 * Scheduled CF co každou hodinu:
 *   1. Najde UPCOMING eventy s `startAt` v okně [now+23h, now+25h]
 *      které ještě nemají `reminderSentAt` (idempotentní — jeden
 *      reminder na event).
 *   2. Pro každý event: načte /events/{id}/rsvps/* a dedupe invitees
 *      kteří už odpověděli (jakkoliv).
 *   3. Zbylým invitees pošle push + inbox `event_rsvp_reminder`.
 *   4. Zapíše `reminderSentAt: now` na event doc — dedupe flag.
 *
 * Pure helper `findEventsNeedingReminder` je samostatně unit-testovaný.
 * Reminder se posílá všem invitees bez response — včetně autora pokud
 * si sám sebe pozval (okrajové). Self-filter v sendNotification to
 * stejně chytí, ale zde filtrujeme předem pro šetrnost.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { sendNotification, resolveActorName } from "../notify/send";
import type { EventDoc } from "../notify/types";

const REGION = "europe-west1";
const WINDOW_START_MS = 23 * 60 * 60 * 1000;
const WINDOW_END_MS = 25 * 60 * 60 * 1000;

/** Tvar eventu pro reminder rozhodování. */
export interface ReminderEvent {
  id: string;
  startAt: string;
  status: EventDoc["status"];
  reminderSentAt?: string | null;
}

/**
 * Pure — vrátí events jejichž `startAt` spadá do okna
 * [now + 23h, now + 25h] a status je UPCOMING a `reminderSentAt` je null.
 *
 * Okno 2 hodiny je záměrně široké: scheduled CF běží hodinově, takže
 * se všechny eventy pokryjí (nikdy neuteču žádný).
 *   - Event se `startAt` v čase now+24h: první tick ho chytí (now+23<24<now+25).
 *   - Event se `startAt` v čase now+23.5h: taky chytí.
 *   - Po zaslání se zapíše `reminderSentAt` → další ticks ho skipnou.
 */
export function findEventsNeedingReminder(
  events: ReminderEvent[],
  nowMs: number,
): ReminderEvent[] {
  const lo = nowMs + WINDOW_START_MS;
  const hi = nowMs + WINDOW_END_MS;
  const out: ReminderEvent[] = [];
  for (const e of events) {
    if (e.status !== "UPCOMING") continue;
    if (e.reminderSentAt) continue;
    const t = Date.parse(e.startAt);
    if (Number.isNaN(t)) continue;
    if (t >= lo && t <= hi) out.push(e);
  }
  return out;
}

export const rsvpReminderTick = onSchedule(
  {
    schedule: "every 1 hours",
    region: REGION,
    timeZone: "Europe/Prague",
  },
  async () => {
    const db = admin.firestore();

    // Query jen UPCOMING — rest filtr přes pure helper.
    const snap = await db
      .collection("events")
      .where("status", "==", "UPCOMING")
      .get();
    const events: ReminderEvent[] = snap.docs.map((d) => ({
      id: d.id,
      startAt: typeof d.get("startAt") === "string" ? (d.get("startAt") as string) : "",
      status: d.get("status") as EventDoc["status"],
      reminderSentAt:
        typeof d.get("reminderSentAt") === "string"
          ? (d.get("reminderSentAt") as string)
          : null,
    }));

    const nowMs = Date.now();
    const candidates = findEventsNeedingReminder(events, nowMs);
    if (candidates.length === 0) {
      logger.debug("rsvpReminderTick — nothing in window", {
        scanned: events.length,
      });
      return;
    }

    let totalPushed = 0;

    for (const { id: eventId } of candidates) {
      // Re-fetch full event doc pro rendering (helper měl jen lehký tvar).
      const eventSnap = await db.collection("events").doc(eventId).get();
      const eventData = eventSnap.data() as EventDoc | undefined;
      if (!eventData) continue;

      // Fetch RSVPs pro dedupe
      const rsvpSnap = await db
        .collection("events")
        .doc(eventId)
        .collection("rsvps")
        .get();
      const rsvpUids = new Set(rsvpSnap.docs.map((d) => d.id));

      const invitees = Array.isArray(eventData.inviteeUids)
        ? eventData.inviteeUids
        : [];
      const pending = invitees.filter(
        (uid) => uid !== eventData.createdBy && !rsvpUids.has(uid),
      );

      if (pending.length === 0) {
        logger.debug("rsvpReminderTick — no pending invitees", { eventId });
        // Setneme reminderSentAt tak jako tak, ať tenhle event už neřešíme.
        await db
          .collection("events")
          .doc(eventId)
          .update({ reminderSentAt: new Date().toISOString() });
        continue;
      }

      const actorName = await resolveActorName(eventData.createdBy);
      const sends = pending.map((recipientUid) =>
        sendNotification({
          eventType: "event_rsvp_reminder",
          // Actor = creator eventu (on tě zval, takže on ti i připomíná)
          actorUid: eventData.createdBy,
          actorName,
          recipientUid,
          eventId,
          event: eventData,
        }),
      );
      const results = await Promise.all(sends);
      const delivered = results.reduce((a, b) => a + b, 0);
      totalPushed += delivered;

      // Flag event jako "reminder odeslán" — další tick ho přeskočí.
      await db
        .collection("events")
        .doc(eventId)
        .update({ reminderSentAt: new Date().toISOString() });

      logger.info("rsvpReminderTick — event done", {
        eventId,
        pending: pending.length,
        delivered,
      });
    }

    logger.info("rsvpReminderTick — summary", {
      scanned: events.length,
      eventsInWindow: candidates.length,
      totalDelivered: totalPushed,
    });
  },
);
