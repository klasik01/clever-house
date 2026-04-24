#!/usr/bin/env bash
# =============================================================================
# Firebase Service Account diagnostic
# =============================================================================
# Ověří, že service-account JSON skutečně má permissions potřebné pro Firebase
# rules deploy. Běží lokálně, nic nemění (kromě samotného rules deploye na
# konci — ten mění stav v Firebase projektu).
#
# Použití:
#   ./scripts/diagnose-firebase-sa.sh <cesta-k-sa.json>
#
# Nebo:
#   SA_JSON=/path/to/sa.json ./scripts/diagnose-firebase-sa.sh
# =============================================================================

set -euo pipefail

RED=$'\033[0;31m'
GRN=$'\033[0;32m'
YLW=$'\033[0;33m'
BLU=$'\033[0;34m'
RST=$'\033[0m'

say()  { echo; echo "${BLU}==>${RST} $*"; }
ok()   { echo "${GRN}✓${RST} $*"; }
warn() { echo "${YLW}⚠${RST}  $*"; }
err()  { echo "${RED}✗${RST} $*"; }
die()  { err "$*"; exit 1; }

# ---- 1) Resolve SA JSON path ----
SA_PATH="${1:-${SA_JSON:-}}"
if [[ -z "$SA_PATH" ]]; then
  die "Usage: $0 <cesta-k-sa.json>    (nebo nastav SA_JSON env var)"
fi
if [[ ! -f "$SA_PATH" ]]; then
  die "Soubor neexistuje: $SA_PATH"
fi

say "Diagnostikuji service account: $SA_PATH"

# ---- 2) Check dependencies ----
command -v node >/dev/null || die "node není v PATH — nainstaluj Node.js."
command -v npx  >/dev/null || die "npx není v PATH — nainstaluj Node.js."

# ---- 3) Parse JSON + extract identity ----
# Používáme fs.readFileSync + JSON.parse místo require(), protože require
# funguje jen pro soubory s .json extension a neumí řešit BOM. Tenhle způsob
# parsuje libovolný valid JSON bez ohledu na cestu / extension.
read_json_field() {
  node -e '
    const fs = require("fs");
    const raw = fs.readFileSync(process.argv[1], "utf8").replace(/^﻿/, "");
    try {
      const j = JSON.parse(raw);
      process.stdout.write(String(j[process.argv[2]] ?? ""));
    } catch (e) {
      process.stderr.write("[parse error] " + e.message);
      process.exit(2);
    }
  ' "$SA_PATH" "$1"
}

# Capture stderr separately so we can show parse errors.
PARSE_ERR=$(mktemp)
CLIENT_EMAIL=$(read_json_field client_email 2>"$PARSE_ERR" || true)
PROJECT_ID=$(read_json_field  project_id   2>"$PARSE_ERR" || true)
TYPE=$(read_json_field        type         2>"$PARSE_ERR" || true)

if [[ -s "$PARSE_ERR" ]]; then
  err "Chyba při parse JSONu:"
  sed 's/^/    /' "$PARSE_ERR"
  rm -f "$PARSE_ERR"
  echo
  echo "Zkontroluj, že soubor $SA_PATH je platný JSON object (začíná { a končí })."
  echo "Typická příčina: stažený soubor má .html / error stránku místo JSONu,"
  echo "nebo byl zkopírován jen výřez (např. bez závorek)."
  echo "Podívej se na první řádky:"
  head -c 200 "$SA_PATH" | sed 's/^/    /'
  echo
  exit 1
fi
rm -f "$PARSE_ERR"

if [[ -z "$CLIENT_EMAIL" || -z "$PROJECT_ID" ]]; then
  err "JSON se parsoval, ale nemá pole client_email nebo project_id."
  err "Pravděpodobně to není platný service-account klíč."
  die "Stáhni nový z Firebase Console → Project Settings → Service accounts → Generate new private key."
fi
if [[ "$TYPE" != "service_account" ]]; then
  warn "JSON má type='${TYPE}', očekával jsem 'service_account'. Pokračuji, ale pravděpodobně to selže."
fi

ok "client_email: $CLIENT_EMAIL"
ok "project_id : $PROJECT_ID"
echo

# ---- 4) Set GOOGLE_APPLICATION_CREDENTIALS for firebase-tools ----
export GOOGLE_APPLICATION_CREDENTIALS="$SA_PATH"

# ---- 5) Test auth — projects:list ----
say "Test 1/2: projects:list (ověří základní auth)"
if npx --yes firebase-tools projects:list >/tmp/fb-projects.txt 2>&1; then
  ok "projects:list prošlo — SA auth je platný."
  # Pokud PROJECT_ID není v listu, výsledek je podezřelý:
  if grep -qE "(^|[^a-z])${PROJECT_ID}([^a-z]|$)" /tmp/fb-projects.txt; then
    ok "Projekt ${PROJECT_ID} je v seznamu."
  else
    warn "Projekt ${PROJECT_ID} NENÍ v seznamu, co vrátil projects:list. Divné — pokračuj, ale dej pozor."
  fi
else
  err "projects:list selhal:"
  sed 's/^/    /' /tmp/fb-projects.txt
  echo
  die "Auth je rozbitý. SA klíč může být neplatný, expirovaný, nebo patří jinému účtu než myslíš."
fi

# ---- 6) Test rules deploy permissions ----
say "Test 2/2: deploy firestore:rules (ověří rules permissions)"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"   # ..../app
cd "$APP_DIR"

if npx --yes firebase-tools deploy \
    --only firestore:rules,storage \
    --project "$PROJECT_ID" \
    --non-interactive \
    --force \
    > /tmp/fb-deploy.txt 2>&1; then
  ok "Rules deploy prošel — SA má všechny potřebné role."
  echo
  echo "${GRN}============================================${RST}"
  echo "${GRN}Diagnóza: A — SA funguje, stačí updatnout secret.${RST}"
  echo "${GRN}============================================${RST}"
  echo "Zkopíruj OBSAH ${SA_PATH} do GitHub secretu:"
  echo "  • FIREBASE_SERVICE_ACCOUNT   (pokud je to dev SA)"
  echo "  • OPE_FIREBASE_SERVICE_ACCOUNT (pokud je to prod SA)"
  echo "Pak retry pipeline."
else
  err "Rules deploy selhal:"
  sed 's/^/    /' /tmp/fb-deploy.txt
  echo
  # Rozpoznat hlavní error patterny
  if grep -q "does not have permission" /tmp/fb-deploy.txt; then
    echo "${RED}============================================${RST}"
    echo "${RED}Diagnóza: B — IAM problém.${RST}"
    echo "${RED}============================================${RST}"
    echo "Service account:"
    echo "    ${CLIENT_EMAIL}"
    echo "nemá dost permissions. Jdi do GCP Console IAM:"
    echo "    https://console.cloud.google.com/iam-admin/iam?project=${PROJECT_ID}"
    echo "a TOMUHLE přesně emailu přidej roli:"
    echo "    • Firebase Admin  (roles/firebase.admin)"
    echo "POZOR — ověř, že v UI nahoře je vybraný projekt '${PROJECT_ID}',"
    echo "ne jiný. Pak počkej 2 min a spusť tenhle skript znovu."
  elif grep -qi "not found" /tmp/fb-deploy.txt; then
    echo "${RED}============================================${RST}"
    echo "${RED}Diagnóza: C — projekt/SA mismatch.${RST}"
    echo "${RED}============================================${RST}"
    echo "SA je z jiného projektu, než na který chceš deploynout."
    echo "Vygeneruj nový klíč z Firebase Console když jsi přepnutý NA '${PROJECT_ID}'."
  else
    echo "${RED}============================================${RST}"
    echo "${RED}Diagnóza: jiná chyba — pošli mi output výše.${RST}"
    echo "${RED}============================================${RST}"
  fi
  exit 1
fi
