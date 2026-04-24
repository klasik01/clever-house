#!/usr/bin/env node
/**
 * Deploy orchestrator — V17.10
 *
 * Jednou komandou nasadí všechno potřebné pro daný environment:
 *   1. Deploy Firestore rules  (firebase deploy --only firestore:rules)
 *   2. Spustí všechny pending migrace (scripts/pending/*.mjs, abecedně).
 *      Po úspěšném runu přesune do archive/ + doplní řádek README.
 *   3. Deploy Cloud Functions  (firebase deploy --only functions)
 *
 * Frontend je mimo scope — nasazuje se přes git push (develop → dev,
 * main → prod). Frontend závisí na odeslaných rules + functions, takže
 * ho nech na konec (po tom co tento orchestrátor doběhne).
 *
 * Usage:
 *   cd app/functions
 *   node scripts/deploy.mjs <dev|ope> [--dry-run] [--skip-firebase]
 *
 *   --dry-run         — jen vypíše co by se dělalo, nic nezmění
 *   --skip-firebase   — spustí jen migrace, přeskočí firebase deploy
 *                       (užitečné když chceš migrovat aniž bys aktualizoval code)
 *
 * Pending skript naming convention:
 *   YYYY-MM-DD-V{verze}-{popis}.mjs
 *   Prefix datem zajistí deterministické pořadí při list ordered by name.
 *
 * Pending skript musí mít v header JSDoc tagy:
 *   @migration V17.8
 *   @date 2026-04-24
 *   @description krátký popis co to dělá
 *
 * Tagy se parsují do archive README tabulky po úspěšné archivaci.
 */

import { readFile, readdir, rename, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PENDING_DIR = join(__dirname, "pending");
const ARCHIVE_DIR = join(__dirname, "archive");
const ARCHIVE_README = join(ARCHIVE_DIR, "README.md");
const VALID_ENVS = new Set(["dev", "ope"]);

// Layout: app/deploy/deploy.mjs → appRoot = app/ (kde je firebase.json +
// firestore.rules), functionsRoot = app/functions/ (kde běží npm build).
const APP_ROOT = join(__dirname, "..");
const FUNCTIONS_ROOT = join(APP_ROOT, "functions");

const args = process.argv.slice(2);
const env = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");
const SKIP_FIREBASE = args.includes("--skip-firebase");

if (!env || !VALID_ENVS.has(env)) {
  console.error("Usage: node scripts/deploy.mjs <dev|ope> [--dry-run] [--skip-firebase]");
  process.exit(1);
}

// ---------- Helpers ----------

/** Spustí shell command a streamuje výstup do stdout/stderr. Promise resolvuje
 *  s exit code nebo rejects při error. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${cmd} ${args.join(" ")}`);
    if (DRY_RUN) {
      console.log(`  (DRY RUN — skipping)`);
      resolve(0);
      return;
    }
    const child = spawn(cmd, args, {
      stdio: "inherit",
      cwd: opts.cwd ?? process.cwd(),
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

/** Parse JSDoc @migration / @date / @description tags ze skriptu. */
async function parseMeta(scriptPath) {
  const src = await readFile(scriptPath, "utf-8");
  // Beru jen prvních ~40 řádků = JSDoc header block.
  const head = src.split("\n").slice(0, 40).join("\n");
  const grab = (tag) => {
    const re = new RegExp(`@${tag}\\s+([^\\n*]+?)\\s*(?:\\*|\\n|$)`);
    const m = head.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    migration: grab("migration"),
    date: grab("date"),
    description: grab("description"),
  };
}

/** Najdi Project ID pro vybraný env — čti ze service account JSON. Tím se
 *  orientujeme jaký firebase project má být aktivní. */
async function resolveProjectId(env) {
  const path = join(__dirname, `${env}.json`);
  if (!existsSync(path)) {
    throw new Error(`Service account JSON not found: ${path}`);
  }
  const raw = await readFile(path, "utf-8");
  const json = JSON.parse(raw);
  if (!json.project_id) {
    throw new Error(`project_id missing in ${path}`);
  }
  return json.project_id;
}

// ---------- Flow ----------

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Deploy orchestrator — prostředí: ${env.toUpperCase()}`);
  if (DRY_RUN) console.log("  DRY RUN — nic se nezmění");
  if (SKIP_FIREBASE) console.log("  --skip-firebase — jen migrace, žádný firebase deploy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const projectId = await resolveProjectId(env);
  console.log(`Firebase project: ${projectId}`);

  const firebaseEnv = { GOOGLE_APPLICATION_CREDENTIALS: join(__dirname, `${env}.json`) };
  const appRoot = APP_ROOT;
  const functionsRoot = FUNCTIONS_ROOT;

  // --- 1. Deploy Firestore rules ---
  if (!SKIP_FIREBASE) {
    console.log("\n[1/3] Deploy Firestore rules");
    await run(
      "npx",
      ["firebase", "deploy", "--only", "firestore:rules", "--project", projectId, "--non-interactive"],
      { cwd: appRoot, env: firebaseEnv },
    );
  } else {
    console.log("\n[1/3] Firestore rules — SKIPPED (--skip-firebase)");
  }

  // --- 2. Pending migrace ---
  console.log("\n[2/3] Pending migrations");
  const pendingFiles = (await readdir(PENDING_DIR))
    .filter((f) => f.endsWith(".mjs"))
    .sort(); // naming convention = datum-prefix → abecedně = chronologicky
  if (pendingFiles.length === 0) {
    console.log("  žádné pending migrace");
  } else {
    console.log(`  pending: ${pendingFiles.length} skriptů`);
  }

  // Archivace jen po úspěchu na prod (ope). Dev je testovací krok —
  //   pending zůstává, protože ope ten samý skript ještě potřebuje spustit
  //   proti produkční DB. Idempotence skriptů zajistí že re-run na
  //   stejném prostředí nic nezapíše podruhé (safety net).
  const ARCHIVE_ENABLED = env === "ope" && !DRY_RUN;

  const ran = [];
  for (const file of pendingFiles) {
    const scriptPath = join(PENDING_DIR, file);
    console.log(`\n  → ${file}`);
    try {
      await run("node", [scriptPath, env], { cwd: functionsRoot });
      const meta = await parseMeta(scriptPath);
      ran.push({ file, meta });
      if (ARCHIVE_ENABLED) {
        const target = join(ARCHIVE_DIR, file);
        await rename(scriptPath, target);
        console.log(`  ✓ archivováno do archive/${file}`);
        const row = `| ${meta.date || "?"} | ${meta.migration || "?"} | \`${file}\` | ${meta.description || "—"} |\n`;
        await appendFile(ARCHIVE_README, row);
        console.log(`  ✓ záznam v archive/README.md`);
      } else if (DRY_RUN) {
        console.log(`  (DRY RUN — skipping archive move + README update)`);
      } else {
        console.log(`  ✓ pending zůstává (archivace probíhá až po 'ope' deployi)`);
      }
    } catch (err) {
      console.error(`  ✗ SKRIPT SELHAL: ${err.message}`);
      console.error(`  Zbylé pending skripty nebudou spuštěny. Oprav chybu`);
      console.error(`  a pusť deploy znovu — idempotentní skripty doběhnou bez škod.`);
      process.exit(1);
    }
  }

  // --- 3. Deploy Cloud Functions ---
  if (!SKIP_FIREBASE) {
    console.log("\n[3/3] Build + Deploy Cloud Functions");
    // firebase deploy sice automaticky pustí `npm run build` (viz
    // firebase.json predeploy hook), ale ne všechny repozitáře ten hook
    // mají nastavený — spustíme build explicitně, ať je deploy
    // deterministický bez ohledu na firebase.json konfiguraci.
    await run("npm", ["run", "build"], { cwd: functionsRoot });
    await run(
      "npx",
      ["firebase", "deploy", "--only", "functions", "--project", projectId, "--non-interactive"],
      { cwd: appRoot, env: firebaseEnv },
    );
  } else {
    console.log("\n[3/3] Cloud Functions — SKIPPED (--skip-firebase)");
  }

  // --- Report ---
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✓ Deploy na ${env.toUpperCase()} hotovo`);
  if (ran.length > 0) {
    console.log(`  spuštěno migrací: ${ran.length}`);
    ran.forEach(({ file, meta }) => {
      console.log(`    ${meta.migration || "?"} — ${file}`);
    });
    if (env === "dev" && !DRY_RUN) {
      console.log(``);
      console.log(`  pending/ zůstává — spusť 'npm run deploy:ope' pro prod nasazení`);
      console.log(`  a následnou archivaci.`);
    }
  }
  console.log("");
  console.log("Frontend: push do git (develop=dev, main=prod) → CI/CD.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((err) => {
  console.error("\n✗ Deploy selhal:", err.message);
  process.exit(1);
});
