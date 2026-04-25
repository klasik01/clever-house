#!/usr/bin/env node
/**
 * @migration V18.S12
 * @date 2026-04-25
 * @description Backfill calendarToken do users/{uid} pro webcal subscription
 *
 * V18-S12 — pro webcal subscription (S11 HTTP endpoint) potřebuje každý
 * user v /users/{uid} mít `calendarToken` + `calendarTokenRotatedAt`.
 * Klient lazy-generuje token při prvním otevření Settings "Kalendář",
 * ale migrace to udělá hromadně pro všechny existing users aby ani
 * nestarší účty neznepříjemnila první načtení Settings.
 *
 * Skript:
 *   1. Projde všechny /users.
 *   2. Pro každého bez `calendarToken` (nebo s prázdným stringem)
 *      vygeneruje nový 32-znakový hex token + zapíše ISO timestamp.
 *   3. Idempotentní — druhé spuštění přeskočí usery co už token mají.
 *   4. Batch commit po 200 docs.
 *
 * Token format: 32 hex (ne UUID s pomlčkami, aby se vešel do URL bez
 * escapingu). Matchuje `generateCalendarToken` v lib/calendarToken.ts.
 *
 * Jak spustit:
 *   cd app/deploy
 *   npm run deploy:dev        (dev, pending zůstává)
 *   npm run deploy:ope        (prod, přesune do archive)
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Guard proti omylovému re-runu po archivaci.
if (basename(dirname(__filename)) === "archive") {
  console.error("⚠️  Tento skript je v deploy/archive/ — migrace už proběhla.");
  console.error("    Rerun není potřeba; každý user má calendarToken.");
  console.error("    Pro rotaci tokenu konkrétního usera použij UI Settings");
  console.error("    nebo admin script (nutno napsat pro speciální případ).");
  process.exit(2);
}

const VALID_ENVS = new Set(["dev", "ope"]);

const args = process.argv.slice(2);
const env = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");

if (!env || !VALID_ENVS.has(env)) {
  console.error(
    "Usage: node 2026-04-25-V18.S12-calendar-tokens.mjs <dev|ope> [--dry-run]",
  );
  console.error("");
  console.error("  dev → ../dev.json (service account)");
  console.error("  ope → ../ope.json (service account)");
  process.exit(1);
}

function generateToken() {
  // 32 hex znaků z UUID, bez pomlček. Stejný algoritmus jako
  // generateCalendarToken v app/src/lib/calendarToken.ts.
  return randomUUID().replace(/-/g, "");
}

async function loadServiceAccount() {
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
  console.log(`  načteno ${usersSnap.size} uživatelů`);

  const toBackfill = [];
  let alreadyOk = 0;

  usersSnap.docs.forEach((d) => {
    const data = d.data();
    const existing = typeof data.calendarToken === "string" ? data.calendarToken : "";
    if (existing.length >= 20) {
      alreadyOk++;
      return;
    }
    toBackfill.push({ id: d.id, email: data.email || "?" });
  });

  console.log(`\nReport:`);
  console.log(`  ${alreadyOk} uživatelů už má calendarToken (přeskočeno)`);
  console.log(`  ${toBackfill.length} uživatelů bude doplněno:`);
  toBackfill.slice(0, 10).forEach(({ id, email }) => {
    console.log(`    ${id}  ${email}`);
  });
  if (toBackfill.length > 10) {
    console.log(`    ... a ${toBackfill.length - 10} dalších`);
  }

  if (DRY_RUN || toBackfill.length === 0) {
    console.log(`\nKonec (dry-run nebo nic k zápisu).`);
    process.exit(0);
  }

  console.log(`\nZapisuju...`);
  const nowIso = new Date().toISOString();
  const BATCH_SIZE = 200;
  for (let i = 0; i < toBackfill.length; i += BATCH_SIZE) {
    const chunk = toBackfill.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(({ id }) => {
      batch.update(db.collection("users").doc(id), {
        calendarToken: generateToken(),
        calendarTokenRotatedAt: nowIso,
      });
    });
    await batch.commit();
    console.log(
      `  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs committed`,
    );
  }
  console.log(`\nHotovo: ${toBackfill.length} users backfillnutých.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migrace selhala:", err);
  process.exit(1);
});
