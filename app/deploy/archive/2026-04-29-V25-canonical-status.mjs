#!/usr/bin/env node
/**
 * @migration V25
 * @date 2026-04-29
 * @description Hard-migrate task.status to canonical 4-value union.
 *
 * Mapping table per V25 brief:
 *   "Otázka" | "Čekám" | "Ve stavbě" | "ON_CLIENT_SITE" | "ON_PM_SITE" | "Nápad" → "OPEN"
 *   "Rozhodnuto" | "Hotovo"                                                       → "DONE"
 *   "OPEN" | "BLOCKED" | "CANCELED" | "DONE"                                      → kept
 *
 * Plus: comments where workflowAction === "close" stay (legacy alias for "complete").
 *
 * Idempotent — second run rewrites nothing. Reads each task, checks if
 * current status is already canonical, skip if yes.
 */

import { dirname, basename } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
if (basename(dirname(__filename)) === "archive") {
  console.error("ERROR: this script has been archived — refusing to run.");
  process.exit(2);
}

const env = process.argv[2];
if (!env || !["dev", "ope"].includes(env)) {
  console.error(
    "Usage: node 2026-04-29-V25-canonical-status.mjs <dev|ope> [--dry-run]",
  );
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");

const saPath = new URL(`../${env}.json`, import.meta.url);
const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const CANONICAL = new Set(["OPEN", "BLOCKED", "CANCELED", "DONE"]);
const TO_DONE = new Set(["Rozhodnuto", "Hotovo"]);

function mapLegacy(status) {
  if (CANONICAL.has(status)) return null; // no-op
  if (TO_DONE.has(status)) return "DONE";
  // All other legacy values → OPEN
  // (Otázka, Čekám, Ve stavbě, ON_CLIENT_SITE, ON_PM_SITE, Nápad)
  return "OPEN";
}

async function main() {
  console.log(`[V25 canonical-status] env=${env} dryRun=${dryRun}`);

  const snapshot = await db.collection("tasks").get();
  console.log(`Loaded ${snapshot.size} tasks`);

  let updated = 0;
  let skipped = 0;
  const writePromises = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const newStatus = mapLegacy(data.status);
    if (newStatus === null) {
      skipped++;
      continue;
    }
    console.log(
      `  ${doc.id}: status="${data.status}" → "${newStatus}" (type=${data.type})`,
    );
    if (!dryRun) {
      writePromises.push(
        doc.ref.update({
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }),
      );
    }
    updated++;
  }

  if (writePromises.length > 0) {
    console.log(`Committing ${writePromises.length} writes...`);
    await Promise.all(writePromises);
  }

  console.log(`\n[V25 canonical-status] DONE`);
  console.log(`  updated: ${updated}`);
  console.log(`  skipped (already canonical): ${skipped}`);
  console.log(`  total: ${snapshot.size}`);
  if (dryRun) console.log(`  (DRY RUN — no writes)`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
