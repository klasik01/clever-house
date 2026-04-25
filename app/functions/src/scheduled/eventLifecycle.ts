/**
 * V18-S09 — Event lifecycle auto-transition.
 *
 * Scheduled CF co každou hodinu překlápí eventy jejichž `endAt` uplynul
 * a status je ještě `UPCOMING` → `AWAITING_CONFIRMATION`. Autor pak
 * v appce vidí červenou banner "N událostí čeká na potvrzení" a v detailu
 * dostane tlačítka `[Proběhlo]` / `[Zrušilo se]` (S10).
 *
 * Žádná notifikace se v tomhle kroku neposílá — autor to vidí až otevře
 * app. V2 možná "připomeň potvrzení" push, ale V1 out of scope (spam risk
 * vs benefit).
 *
 * Pure helper `findAwaitingEvents` je samostatně unit-testovaný (nemá
 * žádné Firestore sahnutí — bere snapshot arraye + "now" ms).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

const REGION = "europe-west1";
const MAX_BATCH = 200;

/** Minimální tvar eventu pro lifecycle rozhodování. */
export interface LifecycleEvent {
  id: string;
  endAt: string; // ISO
  status: "UPCOMING" | "AWAITING_CONFIRMATION" | "HAPPENED" | "CANCELLED";
}

/**
 * Pure helper — vrátí seznam events jejichž endAt uplynul a status je
 * `UPCOMING`. Nerozlišuje on-purpose vs. zapomenuté eventy — autor
 * rozhodne v UI přes S10 buttons.
 *
 * Invalid `endAt` (non-ISO, NaN) je bezpečně přeskočen — event by měl
 * mít valid endAt díky rules, ale defensive check pro jistotu.
 */
export function findAwaitingEvents(
  events: LifecycleEvent[],
  nowMs: number,
): LifecycleEvent[] {
  const out: LifecycleEvent[] = [];
  for (const e of events) {
    if (e.status !== "UPCOMING") continue;
    const t = Date.parse(e.endAt);
    if (Number.isNaN(t)) continue;
    if (t < nowMs) out.push(e);
  }
  return out;
}

/**
 * Scheduled CF: 1× za hodinu. Query `/events` WHERE `status ==
 * "UPCOMING"` a filtruje client-side přes `findAwaitingEvents` (Firestore
 * neumí range query na ISO string + equality na status bez compound
 * indexu — pro malý dataset <500 events to v single fetch zvládneme).
 *
 * Batch update max `MAX_BATCH` eventů per invocation. Zbytek počká
 * na další hodinovku — v praxi bude vždy jen pár eventů na transition.
 */
export const eventLifecycleTick = onSchedule(
  {
    schedule: "every 1 hours",
    region: REGION,
    timeZone: "Europe/Prague",
  },
  async () => {
    const db = admin.firestore();
    const snap = await db
      .collection("events")
      .where("status", "==", "UPCOMING")
      .get();
    const events: LifecycleEvent[] = snap.docs.map((d) => ({
      id: d.id,
      endAt: typeof d.get("endAt") === "string" ? (d.get("endAt") as string) : "",
      status: d.get("status") as LifecycleEvent["status"],
    }));
    const nowMs = Date.now();
    const awaiting = findAwaitingEvents(events, nowMs).slice(0, MAX_BATCH);
    if (awaiting.length === 0) {
      logger.debug("eventLifecycleTick — no transitions", {
        scanned: events.length,
      });
      return;
    }
    const batch = db.batch();
    for (const e of awaiting) {
      batch.update(db.collection("events").doc(e.id), {
        status: "AWAITING_CONFIRMATION",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    logger.info("eventLifecycleTick — flipped to AWAITING_CONFIRMATION", {
      scanned: events.length,
      flipped: awaiting.length,
    });
  },
);
