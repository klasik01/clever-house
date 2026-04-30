/**
 * V26 — Scheduled cleanup hlášení starších 24 hodin.
 *
 * Hlášení je broadcast (žádný workflow), retention 24 hodin podle Stáňa
 * specifikace. Každý den v 03:00 europe-west1 spustí scheduled CF, najde
 * /reports docs starší 24h a smaže:
 *   1. attached media z Firebase Storage (best-effort, per file)
 *   2. Firestore dokument
 *
 * Notifikace inbox items se nedotýkají — mají vlastní retention pipeline
 * (V20+ scheduled cleanup po 30 dnech, ne implementováno V1).
 *
 * Pure helper `findExpiredReports` je separátně testovatelný — bere
 * snapshot arraye + "now" ms.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

const REGION = "europe-west1";
const TTL_HOURS = 24;
const MAX_BATCH = 200;

interface ReportSnapshot {
  id: string;
  createdAt: string;
  media?: Array<{ path?: string }>;
}

/**
 * Pure helper — vrátí ID hlášení starších TTL_HOURS od now.
 *
 * Invalid `createdAt` (non-ISO, NaN) je bezpečně přeskočen — defensive
 * check pro jistotu.
 */
export function findExpiredReports(
  reports: ReportSnapshot[],
  nowMs: number,
  ttlHours: number = TTL_HOURS,
): ReportSnapshot[] {
  const cutoffMs = nowMs - ttlHours * 60 * 60 * 1000;
  return reports.filter((r) => {
    const ts = Date.parse(r.createdAt);
    if (Number.isNaN(ts)) return false;
    return ts < cutoffMs;
  });
}

/**
 * Daily scheduled cleanup. Cron: 03:00 europe-west1 každý den.
 * Podle deploy region cron může drift +/- několik minut.
 */
export const reportCleanupTick = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Europe/Prague",
    region: REGION,
  },
  async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const snap = await db.collection("reports").get();
    if (snap.empty) {
      logger.info("reportCleanup: no reports");
      return;
    }

    const reports: ReportSnapshot[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        createdAt: typeof data.createdAt === "string"
          ? data.createdAt
          : data.createdAt?.toDate?.()?.toISOString?.() ?? "",
        media: Array.isArray(data.media) ? data.media : [],
      };
    });

    const expired = findExpiredReports(reports, Date.now()).slice(0, MAX_BATCH);

    if (expired.length === 0) {
      logger.info("reportCleanup: nothing expired", { totalReports: reports.length });
      return;
    }

    logger.info("reportCleanup: deleting", { count: expired.length });

    let deletedDocs = 0;
    let deletedMedia = 0;
    let mediaErrors = 0;

    for (const r of expired) {
      // 1) Storage media cleanup (best-effort per soubor)
      for (const m of r.media ?? []) {
        if (!m.path) continue;
        try {
          await bucket.file(m.path).delete({ ignoreNotFound: true });
          deletedMedia++;
        } catch (err) {
          mediaErrors++;
          logger.warn("reportCleanup: media delete failed", {
            reportId: r.id,
            path: m.path,
            err,
          });
        }
      }

      // 2) Firestore doc delete
      try {
        await db.collection("reports").doc(r.id).delete();
        deletedDocs++;
      } catch (err) {
        logger.error("reportCleanup: doc delete failed", { reportId: r.id, err });
      }
    }

    logger.info("reportCleanup: done", {
      examined: reports.length,
      expired: expired.length,
      deletedDocs,
      deletedMedia,
      mediaErrors,
    });
  },
);
