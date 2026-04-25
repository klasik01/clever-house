#!/usr/bin/env node
/**
 * V18-S38 — Auto-gen markdown matrix z permissionsConfig.ts.
 *
 * Spouští se přes `npm run docs:permissions` z `app/`. Načte AST
 * permissionsConfig.ts (stačí naivní regex parser, struktura je striktní),
 * vyplivne markdown tabulku s actions × roles + ownership + popisem +
 * rulesAt pointer.
 *
 * Output: app/PERMISSIONS_GENERATED.md (gitignored? záleží na týmu —
 * doporučení: NE-gitignore, commitovat. Reviewer pak v PR vidí diff
 * matrix bez čtení configu.)
 *
 * Nezávislé na ts compileru — žádné dependency, jen node + fs. Když parser
 * narazí na neočekávaný shape, throws s jasnou chybou a usnesti pošle.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "src/lib/permissionsConfig.ts");
const OUT = resolve(ROOT, "PERMISSIONS_GENERATED.md");

const code = readFileSync(SRC, "utf8");

// ---------- Parse UserRole union ----------

// Hledáme `export type UserRole = "OWNER" | "PROJECT_MANAGER";` v types.ts.
// Pro jednoduchost: hardcode list rolí z prvního výskytu `roles: [...]`.
// Lepší: parse z @/types. Tady nepotřebujeme všechno, jen pro hlavičku tabulky.
const TYPES_PATH = resolve(ROOT, "src/types.ts");
const typesSrc = readFileSync(TYPES_PATH, "utf8");
const userRoleMatch = typesSrc.match(/export type UserRole\s*=\s*([^;]+);/);
if (!userRoleMatch) throw new Error("Cannot find UserRole in types.ts");
const ALL_ROLES = userRoleMatch[1]
  .split("|")
  .map((s) => s.trim().replace(/^"|"$/g, ""))
  .filter(Boolean);

// ---------- Parse PERMISSIONS object ----------

const permsBlockMatch = code.match(
  /export const PERMISSIONS\s*:\s*Record<ActionKey,\s*PermissionRule>\s*=\s*\{([\s\S]*?)\n\};/,
);
if (!permsBlockMatch) throw new Error("Cannot locate PERMISSIONS object");
const permsBody = permsBlockMatch[1];

// Naivní iterace přes top-level entries: `"action.key": { ... },`
// Regex: nesahá do nested struktury, ale roles[] + popis + rulesAt jsou jednoduché.
const entryRe =
  /"([^"]+)":\s*\{\s*roles:\s*\[([^\]]*)\],?\s*(?:ownership:\s*"([^"]+)",?\s*)?description:\s*((?:`[\s\S]*?`)|(?:"[^"]*"\s*\+\s*\n?\s*"[^"]*")|(?:"[^"]*")),?\s*rulesAt:\s*((?:`[\s\S]*?`)|(?:"[^"]*")),?\s*\}/g;

const entries = [];
let m;
while ((m = entryRe.exec(permsBody)) !== null) {
  const [, action, rolesRaw, ownership, descRaw, rulesAtRaw] = m;
  const roles = rolesRaw
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  // Strip Stringer wrappers (`...` or "..." or "..." + "...")
  const description = descRaw
    .replace(/^[`"]/, "")
    .replace(/[`"]$/, "")
    .replace(/"\s*\+\s*\n?\s*"/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const rulesAt = rulesAtRaw
    .replace(/^[`"]/, "")
    .replace(/[`"]$/, "")
    .replace(/\s+/g, " ")
    .trim();
  entries.push({ action, roles, ownership: ownership ?? "anyone", description, rulesAt });
}

if (entries.length === 0) {
  throw new Error("Parser failed — no entries found. Aktualizuj entryRe.");
}

// ---------- Build markdown ----------

const today = new Date().toISOString().split("T")[0];

const header = [
  "# PERMISSIONS_GENERATED.md",
  "",
  "> **Auto-generated** z `app/src/lib/permissionsConfig.ts`. **Neměň ručně** —",
  "> uprav config a spusť `npm run docs:permissions`.",
  "",
  `Vygenerováno: ${today}`,
  "",
  "## Klientská permission matrix",
  "",
  "Pro každou akci: které role smí, jestli je gated ownership-em, a kam mrknout do `firestore.rules` při sync auditu.",
  "",
];

const colHeaders = ["Action", ...ALL_ROLES, "Ownership", "Rules at", "Popis"];
const sep = colHeaders.map((c) => "-".repeat(Math.max(c.length, 3))).join(" | ");
const head = colHeaders.join(" | ");

const rows = entries.map((e) => {
  const cells = [
    "`" + e.action + "`",
    ...ALL_ROLES.map((r) => (e.roles.includes(r) ? "✅" : "❌")),
    "`" + e.ownership + "`",
    "`" + e.rulesAt + "`",
    e.description,
  ];
  return cells.join(" | ");
});

const md = [
  ...header,
  "| " + head + " |",
  "| " + sep + " |",
  ...rows.map((r) => "| " + r + " |"),
  "",
  "## Ownership semantika",
  "",
  "- **`anyone`** — stačí mít roli v allow-listu, žádné autorství navíc.",
  "- **`author`** — jen autor (createdBy === me). Cross-OWNER NEMÁ.",
  "- **`author-or-cross-owner`** — autor + (OWNER edituje OWNER-created) — V17.1 cross-OWNER pattern.",
  "",
  "## Jak to udržovat",
  "",
  "Při změně permissions:",
  "",
  "1. Uprav `app/src/lib/permissionsConfig.ts`.",
  "2. Updatuj `app/deploy/firestore.rules` podle `rulesAt` pointru.",
  "3. Spusť `npm run docs:permissions` — regeneruje tenhle soubor.",
  "4. Spusť `npm test` — ověří invariant testy.",
  "5. Commit všechno společně.",
  "",
].join("\n");

writeFileSync(OUT, md, "utf8");
console.log(`✅ Wrote ${OUT} (${entries.length} actions, ${ALL_ROLES.length} roles)`);
