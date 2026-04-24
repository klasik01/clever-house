# app/deploy — deploy orchestrator

Samostatný npm balíček pro nasazení backendu (Firestore rules + pending
migrace + Cloud Functions) na dev / prod prostředí. Frontend je mimo
scope — nasazuje se přes git push.

## Setup (jednorázově)

```
cd app/deploy
npm install
```

Nainstaluje `firebase-admin` (pro migrace) a `firebase-tools` (CLI).

Service account JSONy musíš dodat sám:

- `dev.json` — Firebase service account pro dev prostředí
- `ope.json` — Firebase service account pro produkci

Stáhni je z Firebase Console → Project settings → Service accounts →
Generate new private key. Ulož sem. Oba jsou v `.gitignore`.

## Deploy

```
npm run deploy:dev:dry    # náhled na dev
npm run deploy:dev        # ostrý dev — pending/ zůstává
npm run deploy:ope:dry    # náhled na prod
npm run deploy:ope        # ostrý prod — pending/ → archive/
```

Orchestrátor (`deploy.mjs`):

1. Deploy Firestore rules
2. Spustí každý skript v `pending/` (abecedně) se zvoleným env argumentem
3. `npm run build` ve `../functions/` (build TypeScript kódu)
4. Deploy Cloud Functions
5. Pokud env=`ope` a migrace uspěly → přesun pending → archive + řádek
   v `archive/README.md`

Při selhání kdekoli se orchestrátor zastaví, zbytek pending zůstane.

## Ad-hoc deploys

Když chceš nasadit jen jeden kus:

```
npm run rules:deploy:dev       # jen Firestore rules dev
npm run rules:deploy:ope       # jen rules prod
npm run functions:deploy:dev   # jen Cloud Functions dev
npm run functions:deploy:ope   # jen functions prod
npm run storage:deploy:dev     # jen Storage rules dev
npm run storage:deploy:ope     # jen storage prod
```

## Přidat novou migraci

Viz `CLAUDE.md` sekce 6 v rootu projektu. TL;DR:

1. Nový soubor `pending/YYYY-MM-DD-V{verze}-{popis}.mjs`
2. Header JSDoc: `@migration`, `@date`, `@description`
3. První arg = env (`dev`/`ope`), podpora `--dry-run`, idempotentní
4. Guard proti rerunu z `archive/` (basename check)

Šablona: aktuálně proběhlá migrace v `pending/` (po archivaci
v `archive/`) — zkopíruj + uprav.
