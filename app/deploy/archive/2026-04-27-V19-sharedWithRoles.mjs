#!/usr/bin/env node
/**
 * @migration V19
 * @date 2026-04-27
 * @description Backfill sharedWithPm: true → sharedWithRoles: ["PROJECT_MANAGER"] on nápad tasks.
 *
 * Reads all tasks where type == "napad" and sharedWithPm == true,
 * writes sharedWithRoles: ["PROJECT_MANAGER"]. Idempotent — skips
 * documents that already have a non-empty sharedWithRoles array.
 */

import { dirname, basename } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ---- Guard: don't run from archive ----
const __filename = fileURLToPath(import.meta.url);
if (basename(dirname(__filename)) === "archive") {
  console.error("ERROR: this script has been archived — refusing to run.");
  process.exit(2);
}

// ---- Args ----
const env = process.argv[2]; // "dev" | "ope"
if (!env || !["dev", "ope"].includes(env)) {
  console.error("Usage: node 2026-04-27-V19-sharedWithRoles.mjs <dev|ope> [--dry-run]");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");

// ---- Init Firebase Admin ----
const saPath = new URL(`../${env}.json`, import.meta.url);
const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ---- Main ----
async function main() {
  console.log(`[V19 sharedWithRoles] env=${env} dryRun=${dryRun}`);

  // Query nápady with sharedWithPm == true
  const snapshot = await db
    .collection("tasks")
    .where("type", "==", "napad")
    .where("sharedWithPm", "==", true)
    .get();

  console.log(`Found ${snapshot.size} nápady with sharedWithPm=true`);

  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Idempotent: skip if already has non-empty sharedWithRoles
    if (Array.isArray(data.sharedWithRoles) && data.sharedWithRoles.length > 0) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] would update ${docSnap.id}: sharedWithRoles=["PROJECT_MANAGER"]`);
      updated++;
      continue;
    }

    await docSnap.ref.update({
      sharedWithRoles: ["PROJECT_MANAGER"],
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated++;
  }

  console.log(`Done. updated=${updated} skipped=${skipped}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
