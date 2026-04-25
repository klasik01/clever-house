import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { resolveActorName, sendNotification } from "../notify/send";
import type { EventDoc } from "../notify/types";

/**
 * V18-S04 — fires when a calendar event is created.
 *
 * Flow:
 *   - Invitees (every uid in inviteeUids except creator) dostanou push
 *     + inbox notifikaci "event_invitation".
 *   - Creator sám sebe nenotifikuje (self-filter). Pokud se autor
 *     omylem pozval (UI to neumožní, ale rules to dovolí), filtr
 *     sendNotification se postará.
 *
 * Další triggery pro events (update, cancel, delete) přijdou v S07–S10.
 */

const REGION = "europe-west1";

export const onEventCreated = onDocumentCreated(
  { document: "events/{eventId}", region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as EventDoc | undefined;
    if (!data) return;
    const eventId = event.params.eventId;

    if (!Array.isArray(data.inviteeUids) || data.inviteeUids.length === 0) {
      logger.debug("event_invitation skip — no invitees", { eventId });
      return;
    }

    // Actor = creator (jediný zdroj pravdy v tuhle chvíli; edit notifikace
    // v S07 zvažuje jiného actora).
    const actorUid = data.createdBy;
    const actorName = await resolveActorName(actorUid);

    const recipients = data.inviteeUids.filter((uid) => uid !== actorUid);
    if (recipients.length === 0) {
      logger.debug("event_invitation skip — only creator in invitees", { eventId });
      return;
    }

    const sends = recipients.map((recipientUid) =>
      sendNotification({
        eventType: "event_invitation",
        actorUid,
        actorName,
        recipientUid,
        eventId,
        event: data,
      }),
    );
    const results = await Promise.all(sends);
    const total = results.reduce((a, b) => a + b, 0);
    logger.info("event_invitation fan-out done", {
      eventId,
      invited: recipients.length,
      delivered: total,
    });
  },
);


import { onDocumentUpdated } from "firebase-functions/v2/firestore";

/**
 * V18-S07 + V18-S08 — fires when event doc is updated.
 *
 * Routing:
 *   - Status transition → `CANCELLED` (V18-S08):
 *     Fan-out `event_cancelled` všem invitees (after.inviteeUids)
 *     kromě actora. Ostatní větve (invitation/update/uninvited) se
 *     v tomto případě přeskočí — cancel je terminální a jedna
 *     notifikace stačí.
 *   - Noví invitees (v after, ne v before) → `event_invitation`
 *   - Odebraní invitees (v before, ne v after) → `event_uninvited`
 *   - Existující invitees (v obou) → `event_update` POKUD se změnil
 *     některý z notifikačně-relevantních fieldů
 *     (title, startAt, endAt, isAllDay, address, description)
 *   - Actor je autor eventu (createdBy); self-filter v sendNotification
 *     pokryje ho kdyby byl v inviteeUids
 *
 * Ne-notifiable lifecycle (skip): UPCOMING → AWAITING_CONFIRMATION,
 *   AWAITING_CONFIRMATION → HAPPENED, … — to řeší S09/S10 dedikovanými
 *   code paths (scheduled CF / retro confirm). Sem tečou jen
 *   fieldy+invitees+CANCELLED flip.
 */
export const onEventUpdated = onDocumentUpdated(
  { document: "events/{eventId}", region: REGION },
  async (event) => {
    const before = event.data?.before.data() as EventDoc | undefined;
    const after = event.data?.after.data() as EventDoc | undefined;
    if (!before || !after) return;
    const eventId = event.params.eventId;

    // Actor = autor (stejný jak při create). Pokud jiný OWNER event
    // upraví (cross-OWNER), actor by měl být on, ale Firestore nenese
    // "kdo napsal". Fallback na createdBy.
    const actorUid = after.createdBy;

    // V18-S08 — CANCELLED transition má přednost: jeden notifikační
    // fan-out "event_cancelled" všem invitees, ostatní větve (update,
    // invitation, uninvited) se přeskočí. Invitees nepotřebují vědět
    // že jim v rámci téhož commitu změnil i čas — cancel to anuluje.
    //
    // V18-S10 — Jen LIVE cancel (UPCOMING → CANCELLED) posílá push.
    // Retro cancel z AWAITING_CONFIRMATION → CANCELLED je audit akce
    // autora po uplynutí endAt, invitees už to vědí (event byl
    // naplánovaný a prošel) — spam by bez přidané hodnoty obtěžoval.
    if (before.status === "UPCOMING" && after.status === "CANCELLED") {
      const actorName = await resolveActorName(actorUid);
      const invitees = Array.isArray(after.inviteeUids)
        ? after.inviteeUids.filter((uid) => uid !== actorUid)
        : [];
      if (invitees.length === 0) {
        logger.debug("event_cancelled skip — no invitees", { eventId });
        return;
      }
      const cancelSends = invitees.map((recipientUid) =>
        sendNotification({
          eventType: "event_cancelled",
          actorUid,
          actorName,
          recipientUid,
          eventId,
          event: after,
        }),
      );
      const cancelResults = await Promise.all(cancelSends);
      const cancelTotal = cancelResults.reduce((a, b) => a + b, 0);
      logger.info("event_cancelled fan-out done", {
        eventId,
        notified: invitees.length,
        delivered: cancelTotal,
      });
      return;
    }

    // Detekce změny invitee sady.
    const beforeSet = new Set(before.inviteeUids ?? []);
    const afterSet = new Set(after.inviteeUids ?? []);
    const added: string[] = [];
    const removed: string[] = [];
    const kept: string[] = [];
    for (const uid of afterSet) {
      if (beforeSet.has(uid)) kept.push(uid);
      else added.push(uid);
    }
    for (const uid of beforeSet) {
      if (!afterSet.has(uid)) removed.push(uid);
    }

    // Detekce notifikačně-relevantní změny fieldů (pro "kept" invitees).
    const fieldsChanged =
      before.title !== after.title ||
      before.startAt !== after.startAt ||
      before.endAt !== after.endAt ||
      before.isAllDay !== after.isAllDay ||
      (before.address ?? "") !== (after.address ?? "") ||
      (before.description ?? "") !== (after.description ?? "");

    // Skip pokud jen status lifecycle (S08/S09/S10 to řeší separately)
    //   a žádné fieldové / invitee změny nenastaly.
    if (!fieldsChanged && added.length === 0 && removed.length === 0) {
      logger.debug("onEventUpdated — only status change, skip notifikace", {
        eventId,
      });
      return;
    }

    const actorName = await resolveActorName(actorUid);
    const sends: Promise<number>[] = [];

    // Noví pozvaní → event_invitation
    for (const uid of added) {
      if (uid === actorUid) continue;
      sends.push(
        sendNotification({
          eventType: "event_invitation",
          actorUid,
          actorName,
          recipientUid: uid,
          eventId,
          event: after,
        }),
      );
    }

    // Odebraní → event_uninvited
    for (const uid of removed) {
      if (uid === actorUid) continue;
      sends.push(
        sendNotification({
          eventType: "event_uninvited",
          actorUid,
          actorName,
          recipientUid: uid,
          eventId,
          // Posíláme `before` event — reflektuje co bylo. User vidí
          // title a datum co se HO dotýkalo; `after` by mohl mít jiný
          // čas který ho už nezajímá.
          event: before,
        }),
      );
    }

    // Existing invitees (v obou sadách) → event_update, pouze pokud
    //   se změnily relevantní fieldy.
    if (fieldsChanged) {
      for (const uid of kept) {
        if (uid === actorUid) continue;
        sends.push(
          sendNotification({
            eventType: "event_update",
            actorUid,
            actorName,
            recipientUid: uid,
            eventId,
            event: after,
          }),
        );
      }
    }

    const results = await Promise.all(sends);
    const total = results.reduce((a, b) => a + b, 0);
    logger.info("event update fan-out done", {
      eventId,
      added: added.length,
      removed: removed.length,
      kept: kept.length,
      fieldsChanged,
      delivered: total,
    });
  },
);
