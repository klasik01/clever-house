/**
 * Chytrý dům — Cloud Functions (V15 push notifications).
 *
 * This file wires the runtime. Event handlers live in sibling modules
 * (triggers/ for Firestore triggers, notify/ for payload + send helpers).
 *
 * Runtime: Node 20, Firebase Functions v2 (Eventarc-based). All functions
 * pinned to `europe-west1` so latency is low for Czech users and data
 * stays in the same region as the Firestore database. If you move DB
 * regions, update the constant in triggers/*.
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Default region for every function exported from this codebase. Keeps
// individual handlers terse — they only need to spell region out when
// overriding.
setGlobalOptions({ region: "europe-west1" });

// Initialise the Admin SDK once at module load. Subsequent imports (from
// triggers/, notify/) just call `admin.firestore()` / `admin.messaging()`
// and reuse this instance.
admin.initializeApp();

/**
 * Smoke-test endpoint — confirms the deploy worked. Curl it with:
 *   curl https://europe-west1-<project-id>.cloudfunctions.net/helloPing
 * Returns { ok: true, ts } + 200.
 *
 * Safe to keep in production. Remove it once there's a richer admin / debug
 * surface (or behind auth if you care).
 */
export const helloPing = onRequest((req, res) => {
  logger.info("helloPing", {
    method: req.method,
    ua: req.headers["user-agent"],
  });
  res.status(200).json({ ok: true, ts: Date.now() });
});

// ---- Event triggers (V15 push pipeline) ----
export { onTaskCreated, onTaskUpdated } from "./triggers/onTaskWrite";
export { onCommentCreate } from "./triggers/onCommentCreate";
export { onTaskDeleted } from "./triggers/onTaskDeleted";  // V16.6
export { onEventCreated, onEventUpdated } from "./triggers/onEventWrite";  // V18-S04 + S07 + S08
export { onRsvpWrite } from "./triggers/onRsvpWrite";  // V18-S05
export { onUserUpdated } from "./triggers/onUserWrite";  // V18-S12
export { onReportCreated } from "./triggers/onReportWrite";  // V26 — Hlášení

// ---- Scheduled (cron) ----
export { eventLifecycleTick } from "./scheduled/eventLifecycle";  // V18-S09
export { rsvpReminderTick } from "./scheduled/rsvpReminder";  // V18-S13
export { reportCleanupTick } from "./scheduled/reportCleanup";  // V26 — auto-delete reports >24h

// ---- HTTP endpoints ----
export { calendarSubscription } from "./cal/calendarSubscription";  // V18-S11
