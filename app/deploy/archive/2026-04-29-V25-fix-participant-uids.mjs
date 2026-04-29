#!/usr/bin/env node
/**
 * @migration V25-fix
 * @date 2026-04-29
 * @description Backfill participantUids[] na existujících tascích.
 *
 * Pro každý task scaní /tasks/{id}/comments podkolekci a sbírá:
 *   - task.createdBy
 *   - task.assigneeUid (pokud != null)
 *   - každý comment.authorUid
 *   - každý uid v comment.mentionedUids
 *
 * Výsledek zapíše jako `participantUids: string[]` (deduplikováno).
 *
 * Idempotentní — skript přepíše participantUids jen pokud aktuální stav
 * je striktní podmnožinou nově spočítaných uidů (tj. nikdy nezmenší).
 *
 * Bez --dry-run: zapíše do Firestore.
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
    "Usage: node 2026-04-29-V25-fix-participant-uids.mjs <dev|ope> [--dry-run]",
  );
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");

const saPath = new URL(`../${env}.json`, import.meta.url);
const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function collectParticipants(taskDoc) {
  const data = taskDoc.data();
  const set = new Set();
  if (typeof data.createdBy === "string" && data.createdBy) {
    set.add(data.createdBy);
  }
  if (typeof data.assigneeUid === "string" && data.assigneeUid) {
    set.add(data.assigneeUid);
  }
  // Scan comments
  const commentsSnap = await taskDoc.ref.collection("comments").get();
  for (const cdoc of commentsSnap.docs) {
    const cdata = cdoc.data();
    if (typeof cdata.authorUid === "string" && cdata.authorUid) {
      set.add(cdata.authorUid);
    }
    if (Array.isArray(cdata.mentionedUids)) {
      for (const m of cdata.mentionedUids) {
        if (typeof m === "string" && m) set.add(m);
      }
    }
    if (typeof cdata.assigneeAfter === "string" && cdata.assigneeAfter) {
      set.add(cdata.assigneeAfter);
    }
    if (typeof cdata.priorAssigneeUid === "string" && cdata.priorAssigneeUid) {
      set.add(cdata.priorAssigneeUid);
    }
  }
  return Array.from(set);
}

async function main() {
  console.log(`[V25-fix participant-uids] env=${env} dryRun=${dryRun}`);

  const snapshot = await db.collection("tasks").get();
  console.log(`Loaded ${snapshot.size} tasks`);

  let updated = 0;
  let skipped = 0;
  const writePromises = [];

  for (const taskDoc of snapshot.docs) {
    const computed = await collectParticipants(taskDoc);
    const data = taskDoc.data();
    const existing = Array.isArray(data.participantUids)
      ? data.participantUids.filter((x) => typeof x === "string")
      : [];

    // Idempotence: pokud už computed ⊆ existing (nic nového), skip.
    const newOnes = computed.filter((u) => !existing.includes(u));
    if (newOnes.length === 0) {
      skipped++;
      continue;
    }

    const merged = Array.from(new Set([...existing, ...computed]));
    console.log(
      `  ${taskDoc.id}: existing=${existing.length} → merged=${merged.length} (added: ${newOnes.join(", ")})`,
    );
    if (!dryRun) {
      writePromises.push(
        taskDoc.ref.update({
          participantUids: merged,
        }),
      );
    }
    updated++;
  }

  if (writePromises.length > 0) {
    console.log(`Committing ${writePromises.length} writes...`);
    await Promise.all(writePromises);
  }

  console.log(`\n[V25-fix participant-uids] DONE`);
  console.log(`  updated: ${updated}`);
  console.log(`  skipped (already complete): ${skipped}`);
  console.log(`  total: ${snapshot.size}`);
  if (dryRun) console.log(`  (DRY RUN — no writes)`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
