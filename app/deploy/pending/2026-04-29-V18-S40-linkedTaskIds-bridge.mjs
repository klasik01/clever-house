#!/usr/bin/env node
/**
 * @migration V18-S40
 * @date 2026-04-29
 * @description Bridge legacy single linkedTaskId → many-to-many linkedTaskIds.
 *
 * V18-S40 zavádí many-to-many propojení mezi otázkami/úkoly a tématy (nápady).
 * Před touto verzí měla otázka/úkol jen single-parent `linkedTaskId`. Migrace:
 *
 *   - Pro každý task, kde linkedTaskIds (array) je prázdné nebo chybí, ale
 *     linkedTaskId je vyplněný string, zapíše linkedTaskIds=[linkedTaskId].
 *   - Symetricky doplní zpětný link: protistraně (target tasku) přidá ID
 *     do JEJÍHO linkedTaskIds, pokud tam ještě není. Tím se z legacy
 *     parent-only linku stane plně bidirectional many-to-many vztah.
 *
 * `linkedTaskId` field zůstává v dokumentech (nemažeme) — read-time bridge
 * v `lib/tasks.ts/bridgeLinkedTaskIds()` ho dál podporuje, takže rollback
 * skriptu (nebo selhání uprostřed) nezpůsobí ztrátu linku.
 *
 * Idempotentní — druhé spuštění nezapíše duplikáty.
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
  console.error("Usage: node 2026-04-29-V18-S40-linkedTaskIds-bridge.mjs <dev|ope> [--dry-run]");
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
  console.log(`[V18-S40 linkedTaskIds bridge] env=${env} dryRun=${dryRun}`);

  // Načti všechny tasky najednou — workspace je malý (max ~ stovky tasků),
  // jednorázová migrace, zjednodušuje logiku zpětných linků.
  const snapshot = await db.collection("tasks").get();
  console.log(`Loaded ${snapshot.size} tasks total`);

  // First pass: for each task, compute new linkedTaskIds array
  // (existing array unioned with legacy linkedTaskId).
  /** @type {Map<string, string[]>} */
  const desired = new Map();
  for (const d of snapshot.docs) {
    const data = d.data();
    const arr = Array.isArray(data.linkedTaskIds)
      ? data.linkedTaskIds.filter((x) => typeof x === "string" && x.length > 0)
      : [];
    const legacy = typeof data.linkedTaskId === "string" && data.linkedTaskId.length > 0
      ? data.linkedTaskId
      : null;
    const set = new Set(arr);
    if (legacy) set.add(legacy);
    desired.set(d.id, [...set]);
  }

  // Second pass: ensure backward links — if A.linkedTaskIds includes B,
  // also B.linkedTaskIds should include A.
  for (const [aId, aLinks] of desired.entries()) {
    for (const bId of aLinks) {
      const bLinks = desired.get(bId);
      if (!bLinks) continue; // target neexistuje — orphan link, neopravujeme
      if (!bLinks.includes(aId)) {
        bLinks.push(aId);
      }
    }
  }

  // Third pass: write only when changed.
  let updated = 0;
  let skipped = 0;
  for (const d of snapshot.docs) {
    const data = d.data();
    const newLinks = desired.get(d.id) ?? [];
    const oldLinks = Array.isArray(data.linkedTaskIds) ? data.linkedTaskIds : [];
    if (
      newLinks.length === oldLinks.length &&
      newLinks.every((x, i) => x === oldLinks[i])
    ) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(
        `  [dry-run] would update ${d.id}: linkedTaskIds ${JSON.stringify(oldLinks)} → ${JSON.stringify(newLinks)}`,
      );
      updated++;
      continue;
    }
    await d.ref.update({
      linkedTaskIds: newLinks,
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
