import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { resolveActorName, sendNotification } from "../notify/send";
import type { EventDoc } from "../notify/types";

/**
 * V18-S05 — fires when an RSVP doc is created, updated or deleted.
 *
 * Flow:
 *   - Respondent (doc id = uid) vytvoří/upraví svou odpověď
 *   - Trigger pošle push + inbox AUTOROVI eventu (event.createdBy)
 *   - Self-filter v sendNotification: pokud je autor sám respondentem
 *     (pozvaný sám sebe), nedostane notifikaci
 *   - Delete RSVP (clearRsvp) — zatím ignorujeme (v UI to neumožňujeme)
 *
 * Dedupe: response se může změnit (yes → no). Každá změna triggeruje
 * novou notifikaci. Per-recipient dedupe v sendNotification neplatí
 * protože je jiný event (snapshot priorAnswer → after by vyžadoval
 * extra logiku; pro MVP přijmeme že autor dostane 2 pushe pokud si
 * invitee rozmyslí odpověď).
 */

const REGION = "europe-west1";

export const onRsvpWrite = onDocumentWritten(
  {
    document: "events/{eventId}/rsvps/{uid}",
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const eventId = event.params.eventId;
    const respondentUid = event.params.uid;

    // Ignoruj delete (zatím UI neumožňuje).
    if (!after) {
      logger.debug("rsvp deleted — ignoring", { eventId, uid: respondentUid });
      return;
    }

    const newAnswer = after.response === "no" ? "no" : "yes";
    const priorAnswer = before?.response === "no" ? "no" : before?.response === "yes" ? "yes" : null;

    // Skip pokud se hodnota neliší (např. write bez change — resave s
    // stejným response).
    if (priorAnswer === newAnswer) {
      logger.debug("rsvp response unchanged — skip", {
        eventId,
        uid: respondentUid,
        response: newAnswer,
      });
      return;
    }

    // Fetch parent event — potřebujeme title, startAt, createdBy.
    const eventRef = admin.firestore().collection("events").doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      logger.warn("parent event missing, skipping", { eventId });
      return;
    }
    const eventData = eventSnap.data() as EventDoc;

    // Recipient = autor. Pokud respondent je zároveň autor (self-rsvp),
    // sendNotification self-filter to odmítne.
    const authorUid = eventData.createdBy;
    if (!authorUid) {
      logger.warn("event missing createdBy, skipping rsvp notif", { eventId });
      return;
    }

    const actorName = await resolveActorName(respondentUid);

    await sendNotification({
      eventType: "event_rsvp_response",
      actorUid: respondentUid,
      actorName,
      recipientUid: authorUid,
      eventId,
      event: eventData,
      rsvpAnswer: newAnswer,
    });
    logger.info("event_rsvp_response delivered", {
      eventId,
      respondent: respondentUid,
      author: authorUid,
      response: newAnswer,
    });
  },
);
