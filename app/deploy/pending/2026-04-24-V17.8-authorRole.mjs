#!/usr/bin/env node
/**
 * @migration V17.8
 * @date 2026-04-24
 * @description Backfill authorRole do historických tasků (před V17.1 deploy)
 *
 * Orchestrátor (`scripts/deploy.mjs`) parsuje tyhle JSDoc tagy pro
 * archivní tabulku v README. Drž strukturu: jedna hodnota, žádné
 * multi-line popisy.
 *
 * V17.8 — backfill skript: doplní authorRole field do všech historických
 * tasků vytvořených před V17.1 deployem.
 *
 * Jak to funguje:
 *   1. Načte všechny /tasks.
 *   2. Pro každý task bez authorRole (nebo s garbage hodnotou) dohledá
 *      /users/{createdBy}.role a zapíše ho jako authorRole.
 *   3. Batch commit po 200 docs kvůli Firestore limitu 500 ops/batch.
 *
 * Jak spustit (doporučeno přes orchestrátor):
 *   cd app/functions
 *   node scripts/deploy.mjs <dev|ope> [--dry-run]
 *
 *   Nebo přímo pouze tento skript (bypass deploy):
 *   node scripts/pending/2026-04-24-V17.8-authorRole.mjs <dev|ope> [--dry-run]
 *
 *   # examples:
 *   node scripts/migrate-authorRole.mjs dev --dry-run   # test proti dev DB
 *   node scripts/migrate-authorRole.mjs dev             # ostrý zápis na dev
 *   node scripts/migrate-authorRole.mjs ope --dry-run   # test proti prod
 *   node scripts/migrate-authorRole.mjs ope             # ostrý zápis na prod
 *
 * Skript je idempotentní — druhé spuštění nic neudělá (už mají authorRole
 * nastavený). Safe ho pustit opakovaně.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// V17.8 — jednorázová migrace. Po úspěšném runu (dev+prod) přesuň skript
// do scripts/archive/. Guard níž zabrání omylnému re-runu z archivu.
// Kdyby bylo opravdu třeba rerunnout (disaster recovery, restore ze staré
// zálohy), odkomentuj return a spusť z archivního umístění.
if (basename(dirname(__filename)) === "archive") {
  console.error("⚠️  Tento skript je v scripts/archive/ — migrace už proběhla.");
  console.error("    Rerun není potřeba; Firestore má authorRole nastaveno u všech tasků");
  console.error("    (idempotence by beztak nic nezapsala).");
  console.error("");
  console.error("    Kdybys ho opravdu potřeboval spustit (disaster recovery),");
  console.error("    odkomentuj tenhle guard v hlavičce skriptu a věz co děláš.");
  process.exit(2);
}
const VALID_ROLES = new Set(["OWNER", "PROJECT_MANAGER"]);
const VALID_ENVS = new Set(["dev", "ope"]);

// Parse args — první positional určuje env, zbytek jsou flagy.
const args = process.argv.slice(2);
const env = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");

if (!env || !VALID_ENVS.has(env)) {
  console.error(
    "Usage: node scripts/migrate-authorRole.mjs <dev|ope> [--dry-run]",
  );
  console.error("");
  console.error("  První arg určuje service account JSON ze scripts/:");
  console.error("    dev → ../scripts/dev.json");
  console.error("    ope → ../scripts/ope.json");
  console.error("");
  console.error("  --dry-run: jen vypíše co by zapsal, nic nezmění.");
  process.exit(1);
}

async function loadServiceAccount() {
  // Service account JSONy žijí v scripts/ vedle functions/ (ne uvnitř
  // functions/scripts/). Cesta: app/functions/scripts/migrate-authorRole.mjs
  // → app/scripts/{env}.json přes ../../scripts/.
  const path = join(__dirname, "..", `${env}.json`);
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw);
}

async function main() {
  const sa = await loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  console.log(
    `Prostředí: ${env.toUpperCase()}  (${
      DRY_RUN ? "DRY RUN — nic se nezapíše" : "ZÁPIS režim"
    })`,
  );
  console.log("Čtu /users...");
  const usersSnap = await db.collection("users").get();
  const usersByUid = new Map();
  usersSnap.docs.forEach((d) => {
    const data = d.data();
    if (VALID_ROLES.has(data.role)) {
      usersByUid.set(d.id, data.role);
    }
  });
  console.log(`  načteno ${usersByUid.size} uživatelů s validní rolí`);

  console.log("Čtu /tasks...");
  const tasksSnap = await db.collection("tasks").get();
  console.log(`  načteno ${tasksSnap.size} tasků`);

  const toBackfill = [];
  const unknown = [];
  let alreadyOk = 0;

  tasksSnap.docs.forEach((d) => {
    const data = d.data();
    if (VALID_ROLES.has(data.authorRole)) {
      alreadyOk++;
      return;
    }
    const createdBy = data.createdBy;
    const role = usersByUid.get(createdBy);
    if (!role) {
      unknown.push({ id: d.id, createdBy });
      return;
    }
    toBackfill.push({ id: d.id, role, createdBy });
  });

  console.log(`\nReport:`);
  console.log(`  ${alreadyOk} tasků už má authorRole (přeskočeno)`);
  console.log(`  ${toBackfill.length} tasků bude doplněno:`);
  toBackfill.slice(0, 10).forEach(({ id, role, createdBy }) => {
    console.log(`    ${id}  createdBy=${createdBy}  → authorRole=${role}`);
  });
  if (toBackfill.length > 10) {
    console.log(`    ... a ${toBackfill.length - 10} dalších`);
  }
  if (unknown.length > 0) {
    console.log(`  ${unknown.length} tasků s neznámým autorem (user doc chybí):`);
    unknown.forEach(({ id, createdBy }) => {
      console.log(`    ${id}  createdBy=${createdBy}`);
    });
    console.log(`  Tyhle neopravíme — zvaž ruční smazání nebo přiřazení.`);
  }

  if (DRY_RUN || toBackfill.length === 0) {
    console.log(`\nKonec (dry-run nebo nic k zápisu).`);
    process.exit(0);
  }

  console.log(`\nZapisuju...`);
  const BATCH_SIZE = 200;
  for (let i = 0; i < toBackfill.length; i += BATCH_SIZE) {
    const chunk = toBackfill.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(({ id, role }) => {
      batch.update(db.collection("tasks").doc(id), { authorRole: role });
    });
    await batch.commit();
    console.log(
      `  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs committed`,
    );
  }
  console.log(`\nHotovo: ${toBackfill.length} tasků backfillnutých.`);
  // Orchestrátor (deploy.mjs) detekuje exit 0 a skript sám přesune do
  // archive/ + doplní řádek README. Při přímém spuštění je archivace na tobě.
  process.exit(0);
}

main().catch((err) => {
  console.error("Migrace selhala:", err);
  process.exit(1);
});
