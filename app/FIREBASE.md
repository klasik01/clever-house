# Firebase — ops reference

Všechno, co se týká Firebase konfigurace, skriptů, emulátorů a deployů.
Pokud něco neodpovídá realitě, updatuj to zde — single source of truth.

---

## Projekty

Máš dva samostatné Firebase projekty:

| Alias    | Project ID                | Role                                               |
|----------|---------------------------|----------------------------------------------------|
| `dev`    | `house-dashboard-dev`     | Staging, smoke testy, Pages hosting                |
| `prod`   | `house-dashboard`         | Produkce (Netlify), OPE\_\* secrets                |

Aliasy jsou v `.firebaserc` (vytvoří se `firebase use --add`). Aktivní alias
přepínáš:

```bash
firebase use dev      # pracuješ proti dev
firebase use prod     # proti produkci
firebase use          # vypíše aktuální
```

---

## Layout (vše v `app/`)

```
app/
├── firebase.json              — centrální config (rules, functions, emulators)
├── deploy/firestore.rules            — Firestore pravidla
├── deploy/storage.rules              — Storage pravidla
├── functions/                 — Cloud Functions codebase (CJS, Node 20)
│   ├── src/
│   ├── lib/                   — build output (git-ignored)
│   ├── package.json
│   └── vitest.config.ts
├── .firebaserc                — project aliases (po prvním `firebase use --add`)
└── src/                       — webová app (Vite + React)
```

---

## GitHub secrets mapping

| Secret                          | Kam se propisuje                            | Co dělá |
|--------------------------------|---------------------------------------------|--------|
| `FIREBASE_PROJECT_ID`           | `deploy-functions-dev.yml`                  | Dev project id (house-dashboard-dev) |
| `FIREBASE_SERVICE_ACCOUNT`      | `deploy-functions-dev.yml`                  | Service account JSON pro dev deploy |
| `OPE_FIREBASE_PROJECT_ID`       | `deploy-functions.yml` (prod)               | Prod project id (house-dashboard) |
| `OPE_FIREBASE_SERVICE_ACCOUNT`  | `deploy-functions.yml` (prod)               | Service account JSON pro prod deploy |
| `VITE_FIREBASE_*`               | `validate.yml`, `deploy-pages.yml`          | Env přes Vite pro build → dev frontend |
| `VITE_FIREBASE_VAPID_KEY`       | validate + pages                            | Web Push VAPID key (dev) |
| `OPE_VITE_FIREBASE_*`           | `deploy-netlify.yml`                        | Env přes Vite pro prod build |
| `OPE_VITE_FIREBASE_VAPID_KEY`   | `deploy-netlify.yml`                        | Web Push VAPID key (prod) |
| `NETLIFY_AUTH_TOKEN`            | `deploy-netlify.yml`                        | Netlify deploy auth |
| `NETLIFY_SITE_ID`               | `deploy-netlify.yml`                        | Target Netlify site |

---

## npm skripty (z `app/`)

| Script                   | Co udělá |
|--------------------------|----------|
| `npm run dev`            | Vite dev server na `:5173`, připojuje se na **aktivní** Firebase projekt (ne emulator) |
| `npm run build`          | `tsc --noEmit` + `vite build` → `dist/` |
| `npm run preview`        | Slouží `dist/` lokálně, dobré pro ověření PWA před deployem |
| `npm run lint`           | ESLint (bez `functions/`) |
| `npm run typecheck`      | `tsc --noEmit` nad app codebase |
| `npm test`               | Vitest nad `src/**/*.test.{ts,tsx}` |
| `npm run rules:deploy`   | `firebase deploy --only firestore:rules` na aktivní alias |
| `npm run storage:deploy` | `firebase deploy --only storage` na aktivní alias |
| `npm run emulators`      | `firebase emulators:start --only firestore,auth,functions` |
| `npm run functions:install` | `npm --prefix functions install` — potřeba po N-* změnách v `functions/package.json` |
| `npm run functions:build`   | `tsc` v `functions/` → `functions/lib/` |
| `npm run functions:deploy`  | `firebase deploy --only functions` na aktivní alias |

---

## Lokální vývoj — běžný scénář (proti dev Firebase)

Toto je **default flow**: běžíš na localhost, ale všechna data jdou
reálně do `house-dashboard-dev` Firebase projektu.

```bash
cd app
firebase use dev         # jednorázově, nebo po switchi
npm run dev              # Vite na :5173
# → webová app se připojí k dev Firebase přes VITE_FIREBASE_* z .env.local
```

Hotovo. Editace → HMR → vidíš lokálně, data persistují v dev Firebase.

### Jak si vygeneruj `.env.local` (jednou)

V `app/.env.local` (git-ignored) potřebuješ:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=house-dashboard-dev.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=house-dashboard-dev
VITE_FIREBASE_STORAGE_BUCKET=house-dashboard-dev.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=921428642860
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=B...
```

Hodnoty vezmeš z Firebase Console → Project settings → General + Cloud
Messaging tab.

---

## Lokální vývoj s emulátory (offline, rychlé, bezpečné)

Tohle je pro scénáře, kdy **nechceš** sahat na dev Firebase — třeba
zkoušíš destruktivní trigger change, reverse-engineering nějaké kraviny
nebo offline práci.

```bash
cd app
npm run functions:build         # emulator potřebuje lib/ existovat
npm run emulators               # zapne Firestore + Auth + Functions na localhost
```

Emulátor UI najdeš na `http://localhost:4000`. Porty:

| Service   | Port  |
|-----------|-------|
| Firestore | 8080  |
| Auth      | 9099  |
| Functions | 5001  |
| UI        | 4000  |

### Omezení (přečti si, ať tě to neštve)

- **Web app se default NEpřipojuje k emulátoru.** Vite dev server stále
  jezdí proti dev Firebase projektu. Pokud chceš plnou emulátor
  integraci (Firestore + Auth volání z React appky → localhost, ne
  cloud), je potřeba přidat do `src/lib/firebase.ts` `connectXxxEmulator`
  volání podmíněně přes ENV flag. Není to hotovo — řekni si, udělám to
  jako samostatný slice.
- **Emulátor Functions nepřijímá reálné push zprávy** (FCM není
  emulovaný). Pro ověření push infrastruktury musíš deploynout na dev
  projekt a testovat proti reálnému FCM.
- **Emulátor Firestore se spouští prázdný.** Data z dev cloudu
  neimportuje automaticky. Lze exportovat + importovat (`--import` /
  `--export-on-exit`), ale pro casual debug je jednodušší si nasypat
  pár dokumentů přes UI.

### Kde je emulátor pohodlný

- Testování Cloud Function triggerů přes `firebase functions:shell` nebo
  `firebase emulators:exec`. Můžeš triggery volat manuálně bez fyzického
  zápisu do Firestore.
- Cvičné úpravy Firestore rules bez rizika, že rozbíjíš dev produkční
  data.
- Rychlé iterativní smyčky pro typescript-level Cloud Functions změny
  (build → emulator reload).

---

## Deploy — kompletní přehled

Všechny deploye jsou **manuální** (`workflow_dispatch`). Ty rozhoduješ,
kdy co nasadíš. Žádný automatický deploy na push.

### Frontend (React bundle)

| Cíl                    | Pipeline                          | Kde spouštíš                                              |
|------------------------|-----------------------------------|-----------------------------------------------------------|
| **Dev — GitHub Pages** | `deploy-pages.yml`                | GitHub → Actions → "Deploy · GitHub Pages" → Run workflow (libovolná branch) |
| **Prod — Netlify**     | `deploy-netlify.yml`              | GitHub → Actions → "Deploy · Netlify (OPE)" → Run workflow (main only, auto-tag `v{version}`) |

### Cloud Functions (backend)

| Cíl       | Pipeline                        | Kde spouštíš                                              |
|-----------|---------------------------------|-----------------------------------------------------------|
| **Dev**   | `deploy-functions-dev.yml`      | GitHub → Actions → "Deploy · Firebase Functions (dev)" → Run workflow (libovolná branch) |
| **Prod**  | `deploy-functions.yml`          | GitHub → Actions → "Deploy · Firebase Functions (prod)" → Run workflow (main only) |

**Lokální alternativa** (užitečná v průběhu vývoje):

```bash
firebase use dev
npm run functions:deploy
```

### Firestore + Storage rules

| Cíl       | Pipeline                        | Kde spouštíš                                              |
|-----------|---------------------------------|-----------------------------------------------------------|
| **Dev**   | `deploy-rules-dev.yml`          | GitHub → Actions → "Deploy · Firestore + Storage rules (dev)" → Run workflow (libovolná branch) |
| **Prod**  | `deploy-rules.yml`              | GitHub → Actions → "Deploy · Firestore + Storage rules (prod)" → Run workflow (main only) |

Workflow nasadí **obě** sady (`deploy/firestore.rules` + `deploy/storage.rules`) v
jednom běhu. Jsou to malé soubory, deploy trvá pár vteřin.

**Lokální alternativa** (rychlejší pro ad-hoc testy na dev):

```bash
firebase use dev
npm run rules:deploy              # deploy/firestore.rules
npm run storage:deploy            # deploy/storage.rules
```

Lokální prod deploy bych nedoporučil — nic ti nebrání v tom, ale CI má
audit trail a tight main-only guard.

---

## Kompletní deploy release nové verze (checklist)

Když release obsahuje změny v **jedné i více** z {frontend, functions,
rules}, tohle je správné pořadí:

1. **Commit + push na main.** GitHub Actions `validate` proběhne
   automaticky — pokud spadne, neposouvej se dál.
2. **Deploy rules** (pokud se měnily):
   - Actions → **Deploy · Firestore + Storage rules (prod)** → Run workflow.
3. **Deploy functions** (pokud se měnily):
   - Actions → **Deploy · Firebase Functions (prod)** → Run workflow.
4. **Deploy frontend** (pokud se měnil):
   - Actions → **Deploy · Netlify (production / OPE)** → Run workflow.
   - Auto-tag `v{version}` se přidá na `main` HEAD.

**Pravidlo order of operations:** rules + functions **před** frontend.
Frontend by se mohl pokusit číst ještě neexistující schéma nebo volat
ještě nedeployované triggery. Opačně funguje — functions běží, frontend
čeká, vše OK.

---

## Troubleshooting

### `HTTP 403 The caller does not have permission` při rules deploy

Tvůj `firebase login` account nemá roli **Owner** / **Editor** /
**Firebase Rules Admin** na daném projektu. Ověř:

```bash
firebase login:list            # kdo jsem přihlášený?
firebase logout && firebase login   # pokud špatný účet
```

Pak Firebase Console → Project settings → **Users and permissions**
→ ověř, že tvoje Google konto má Owner roli.

### `Eventarc Service Agent: Permission denied` při prvním functions deploy

První v2 functions deploy na novém projektu potřebuje 5–10 min na
propagaci service agent oprávnění. Počkej, retry. Viz chat N-4 log.

### `Invalid applicationServerKey` při kliknutí "Povolit" v Nastavení

VAPID key v `.env.local` je špatný. Je to 88-znakový base64 string
z Firebase Console → Project settings → **Cloud Messaging** tab →
**Web configuration** → "Key pair" public key.

### Emulator se nespouští — port is in use

Máš jiný proces na `:8080` / `:9099` / `:5001` / `:4000`. Kill:

```bash
lsof -i :8080    # zjisti PID
kill <pid>
```

Nebo upravit porty v `app/firebase.json` → `emulators`.
