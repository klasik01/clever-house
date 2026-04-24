# CLAUDE.md — konvence a patterns

Tenhle soubor je pro **Claude** (AI asistenta). Drží condensed soubor
patternů, rozhodnutí a pravidel, která musí respektovat při práci na
projektu **Chytrý dům na vsi** — PWA pro záznam a řešení nápadů,
otázek a úkolů kolem stavby domu mezi OWNER (Stáňa + manželka) a
PROJECT_MANAGER.

Když Claude řeší úlohu, projde tenhle soubor **před** implementací a
následuje popsané konvence. Když narazí na rozhodnutí, které tu chybí
a přijde mu zajímavé pro budoucnost, přidá ho sem.

---

## 1. Architektura stručně

- `app/` — React 19 + Vite + TypeScript + Tailwind PWA
  - `src/components/` — UI komponenty
  - `src/routes/` — top-level stránky (React Router)
  - `src/hooks/` — React hooks (useAuth, useTask, useInbox, useUsers…)
  - `src/lib/` — čistá logika (firebase, tasks, comments, notifications,
    permissions, authorRole, commentTargeting, names, presence, inbox)
  - `src/i18n/` — `cs.json` + `useT.ts` (česká lokalizace; `t("ns.key")`)
- `app/functions/` — Firebase Cloud Functions (Node 20 runtime)
  - `src/triggers/` — Firestore event handlery (`onTaskWrite`,
    `onTaskDeleted`, `onCommentCreate`)
  - `src/notify/` — notifikační pipeline (`catalog`, `send`, `dedupe`,
    `prefs`, `commentFlip`, `protistrana`, `copy`)
  - `src/index.ts` — wiring + exporty CF
  - `scripts/` — deploy orchestrator, jednorázové admin skripty,
    service account JSONy (dev.json, ope.json — gitignored), wrapper
    `firebase-deploy.mjs` pro ad-hoc CLI volání (viz sekci 6)
- `app/deploy/firestore.rules` + `app/deploy/storage.rules` — security
  rules (single source of auth). `firebase.json` v `app/` na ně odkazuje
  relativně.

---

## 2. Permissions model (V17.1/V17.8)

**Zdroj pravdy**: `app/deploy/firestore.rules`. Klientské kontroly
(`canEditTask`) jsou jen UX gating.

### Pravidla edit práv

1. Autor tasku (`createdBy === currentUserUid`) vždy může edit.
2. OWNER může editovat libovolný **OWNER-vytvořený** task
   (cross-OWNER — sdílený domácnostní účet mezi manželi).
3. PM-vytvořené tasky smí editovat **jen autor-PM**.
4. **Delete**: pouze autor — i pro cross-OWNER zachováváme.
5. Jakýkoliv signed-in user smí aplikovat `isCommentSideEffect` diff
   (`commentCount`, `updatedAt`, volitelně `status`, `assigneeUid`) —
   aby `createComment` batch prošel nezávisle na autorovi.

### `authorRole` snapshot

Při create tasku se uloží `authorRole: "OWNER" | "PROJECT_MANAGER"` —
snapshot role autora v ten okamžik. Role se v čase nemění (PM zůstává
PM i kdyby se mu změnila v účtu později), takže snapshot je stabilní.

- Při `createTask`, `convertNapadToOtazka`, `convertNapadToUkol` **vždy**
  předávej `authorRole` třetím argumentem.
- `createTaskFromComposerInput` taky bere `authorRole` explicitně.
- Legacy tasky před V17.1 deploy nemají `authorRole` — **nefallbackuj ho
  na OWNER**, nech `undefined`. Resolver v UI si ho doplní přes user
  lookup (viz níž).

### `resolveAuthorRole({task, usersByUid})`

Helper `app/src/lib/authorRole.ts`. Pořadí fallbacků:

1. `task.authorRole` (pokud field je platný).
2. `users[task.createdBy].role` (z `useUsers` hooku — live).
3. `undefined` → caller musí rozhodnout co s tím. `canEditTask` to bere
   jako "nedovol edit" (safe default proti legacy PM-tasks bez field +
   smazaný user).

### `canEditTask({task, taskAuthorRole, currentUserUid, currentUserRole})`

Helper `app/src/lib/permissions.ts`. **Pure**. Vrací `boolean`.

Signatura bere **resolved** `taskAuthorRole` — neděláme fallback uvnitř.
Caller (`TaskDetail.tsx`) resolvuje přes `resolveAuthorRole` před voláním.

### Migrace legacy tasků

Backfill skript: `app/functions/scripts/pending/2026-04-24-V17.8-authorRole.mjs`
(po úspěšném nasazení se přesune do `archive/`). Doplní `authorRole`
do tasků bez field přes user lookup. Idempotentní, má `--dry-run`.
Nasazuje se přes orchestrátor (viz sekci 6).

---

## 3. Notification pipeline

### Tři soubory, tři zodpovědnosti

| Co | Kde |
|----|-----|
| **KDY** spustit notifikaci (routing) | `app/functions/src/triggers/*.ts` |
| **CO** napsat (title, body, deep-link) | `app/functions/src/notify/catalog.ts` |
| **JAK** doručit (FCM + inbox + prefs) | `app/functions/src/notify/send.ts` |

Když chceš **přidat nový event type**:

1. Rozšiř `NotificationEventKey` union v `app/functions/src/notify/types.ts`
   i v `app/src/types.ts` (mirror).
2. Přidej entry do `NOTIFICATION_CATALOG` v `catalog.ts`:
   `key`, `category` (immediate|debounced), `dedupePriority`, `trigger`
   (dokumentace kdy se spouští), `recipients` (dokumentace komu),
   `renderTitle`, `renderBody`, `renderDeepLink`, `clientLabelKey`,
   `defaultEnabled`.
3. Přidej i18n klíče do `app/src/i18n/cs.json` (`notifikace.events.<key>`
   a `notifikace.events.<key>Hint`).
4. Přidej ikonu do `EVENT_ICONS` v `NotificationPrefsForm.tsx` a
   `EVENT_ICON` v `NotificationList.tsx`.
5. Přidej klíč do `NOTIFICATION_EVENTS` array + `DEFAULT_PREFS.events` v
   `app/src/lib/notifications.ts`.
6. Spusť trigger: `sendNotification({ eventType: "<nový>", recipientUid,
   actorUid, actorName, taskId, task, ... })`.

### Render pipeline

`renderPayload` v `copy.ts` je **tenký wrapper** — deleguje do
`renderNotification` v katalogu. **Neměň switch tam**, uprav katalog.

### Dedupe

`EVENT_PRIORITY` v `dedupe.ts` je **odvozeno** z katalogu
(`eventPriorityList()`). Nejnižší číslo = nejvyšší priorita.

Když nový event musí vyhrát nad ostatními pro konkrétního recipienta
(např. `assigned_with_comment` pro nového assignee), dej mu
`dedupePriority: 0` a v triggeru zavolej
`applyAssignedWithCommentOverride(recipients, ctx)` nebo vlastní override.

### V17.3/V17.5 — comment + assignee flip = jedna notifikace

- Klient při `createComment` **vždy** posílá `priorAssigneeUid:
  task.assigneeUid`. Pokud composer flipnul assignee, posílá taky
  `workflow.assigneeAfter`. Jinak `assigneeAfter = priorAssigneeUid`
  (stejný = no-op flip, uloží se jako obyčejný komentář).
- CF `onCommentCreate` detekuje flip přes
  `applyAssignedWithCommentOverride` a novému assignee přepíše event na
  `assigned_with_comment` (nejvyšší dedupe priorita).
- CF `onTaskUpdated` přes `isCommentBatchUpdate({before, after})`
  přeskočí notifikace pokud update je comment-side-effect
  (`afterCount > beforeCount`). `onCommentCreate` to řeší.

### Self-filter "protistrana" (V16.4)

`app/functions/src/notify/protistrana.ts` — pure helper. Pro change
events (priority/deadline na assignutém tasku): recipient = ten z
{createdBy, assigneeUid}, kdo NENÍ actor. Vrací null pokud není
assignee nebo actor = oba.

### Push vs. inbox vs. badge

- **Inbox** (`/users/{uid}/notifications/`) — zapisuje se serverově v
  `send.ts` **i když user nemá FCM token**. Bell v appce se rozsvítí
  přes Firestore snapshot.
- **Push FCM** — jde jen když má user zaregistrované zařízení.
- **Badge** (červené číslo) — počítá se z unread inbox items přes
  `useInbox` + `useAppBadge`.
- **V16.9 presence suppression** — SW `onBackgroundMessage` přes
  `clients.matchAll` zjistí jestli je app visible. Pokud ano, skip
  `showNotification()`. Na `/t/{taskId}` navíc pošle `INBOX_AUTO_READ`
  postMessage — klientský `useInboxAutoRead` ho mark-readne okamžitě.

---

## 4. Pure helpers pattern (V17.7)

Logiku, která se dá izolovat od React stavu a Firestore, vytahuj do
**pure funkcí** v `app/src/lib/` (nebo `app/functions/src/notify/`) a
piš k nim unit testy.

Příklady: `canEditTask`, `resolveAuthorRole`, `pickDefaultPeer`,
`isRealFlip`, `applyAssignedWithCommentOverride`,
`isCommentBatchUpdate`, `protistrana`, `resolveUserName`,
`shouldAutoReadOnPath`, `taskIdFromPath`.

**Postup**:

1. Identifikuj inline logiku v komponentě / triggeru.
2. Extrahuj do `lib/<téma>.ts` s jasnou vstup/výstup signaturou (žádný
   implicitní state, žádné I/O).
3. Caller zavolá helper místo inline kódu.
4. Napiš `<téma>.test.ts` ve stejném adresáři — vitest, describe + it +
   expect. Snap scenáře: happy path, edge case, null/undefined vstupy,
   self-loop.

Benefit: testy jsou rychlé (žádný jsdom ani firebase mock), regrese
zachyceny, refaktor bezpečnější.

---

## 5. Test stack

- **Vitest** v `app/` i `app/functions/` (samostatné balíčky).
- `vi.mock("firebase/firestore", () => import("@/test/firestoreMock"))`
  pro integrační testy co sahnou přes `firestoreMock`.
- `vi.mock("@/lib/firebase", () => ({ db: {} }))` obejde real firebase init.
- **Preferuj pure funkce** (sekce 4) — testy bez mocků jsou nejrobustnější.
- **Invariant-based** assertace místo pozicionálních: `expect(catalog[k].dedupePriority).toBeLessThan(...)` místo
  `expect(KEYS[0]).toBe("x")`. Odolné proti sort order / Object.keys
  insertion order změnám.
- Spouští se `npm test` v příslušném balíčku.
- CI: pipeline `validate` job spouští oboje.

---

## 6. Jednorázové migrační skripty + deploy orchestrátor

Celý flow je automatizovaný přes `app/functions/scripts/deploy.mjs`.
Claude když potřebuje napsat migraci (jakýkoliv backfill nebo data
cleanup na Firestore), vytvoří ho jako **pending skript** v správném
tvaru — orchestrátor se postará o spuštění, archivaci a záznam.

### Struktura adresářů

```
app/functions/scripts/
├── deploy.mjs          — orchestrátor (nesmí se měnit jen tak)
├── pending/            — čekající migrace (run pořadí = alfabetické)
│   └── YYYY-MM-DD-Vxx-popis.mjs
└── archive/            — proběhlé migrace + README tabulka
    └── YYYY-MM-DD-Vxx-popis.mjs
```

### Jak vytvořit novou migraci

1. Nový soubor v `app/functions/scripts/pending/` s naming
   **`YYYY-MM-DD-V{verze}-{popis-kebab-case}.mjs`**. Datum je datum
   vytvoření (ne deploy). Prefix datem zajistí chronologické pořadí.
2. Header musí obsahovat JSDoc tagy (orchestrátor je parsuje do
   archivní tabulky):
   ```
   @migration V17.8
   @date 2026-04-24
   @description Krátký popis co to dělá
   ```
3. První positional arg = `dev | ope` → skript si načte service account
   z `app/functions/scripts/{env}.json` (cesta z pending/: `../`).
4. Volitelný `--dry-run` flag — vypíše co by zapsal bez actual write.
5. **Idempotentní** — druhé spuštění nic nezapíše. Safe i kdyby
   orchestrátor skript spustil omylem vícekrát.
6. **Guard** na začátku: pokud
   `basename(dirname(__filename)) === "archive"`, skript
   `console.error` a `process.exit(2)`. Ochrana proti omylovému rerunu
   po archivaci.
7. Exit 0 při úspěchu → orchestrátor skript přesune do `archive/` a
   doplní řádek do tabulky v `archive/README.md`.

Šablona je v `archive/2026-04-24-V17.8-authorRole.mjs` (po prvním
deployi) — zkopíruj + uprav.

### Jak nasadit (owner/dev pustí ručně)

```
cd app/functions
npm run deploy:dev:dry        # dry-run na dev — ověř co se stane
npm run deploy:dev            # ostrý deploy na dev
npm run deploy:ope:dry        # dry-run na prod
npm run deploy:ope            # ostrý deploy na prod
```

Orchestrátor:

1. Resolvuje project ID ze service account JSON.
2. `firebase deploy --only firestore:rules --project <id>`
3. Pro každý pending skript: `node <script> <env>`.
4. `npm run build` (functions) → `firebase deploy --only functions`.

**Archivace jen po `ope`**: pending skripty se přesouvají do
`archive/` a zapisují do README tabulky **pouze** když je env `ope`
(prod). Pro `dev` pending zůstává — stejný skript ještě musí běžet
proti produkční DB. Idempotence skriptů zajistí, že druhý dev deploy
nic nezapíše podruhé.

Typický flow pro jednu migraci:
```
npm run deploy:dev        # testovací, pending zůstává
# ... ověř na dev že vše OK ...
npm run deploy:ope        # prod, pending → archive + README tabulka
```

Když některý pending skript selže, orchestrátor se zastaví (zbytek
pending zůstane neběhlý, už archivované zůstanou v archive). Oprav,
pusť znovu — idempotence zajistí že už úspěšně proběhlé kroky nic
nezapíší podruhé.

**Frontend je mimo scope** — nasazuje se přes git push (develop → dev
prostředí, main → prod).

**`--skip-firebase` flag** — spustí jen pending migrace, přeskočí rules
+ functions deploy. Užitečné když chceš migrovat data aniž bys
aktualizoval code.

---

## 7. Deploy pořadí

**Při schema změnách**: rules → functions → frontend.

Preferovaná cesta — orchestrátor (rules + migrace + functions
v jednom kroku):

```
cd app/functions
npm run deploy:dev         # nebo deploy:ope
```

Ad-hoc (jednotlivé kroky):

1. Rules: `npm run rules:deploy:dev` / `rules:deploy:ope` (z `app/functions/`).
2. Functions: `npm run functions:deploy:dev` / `functions:deploy:ope`.
3. Storage: `npm run storage:deploy:dev` / `storage:deploy:ope`.
4. Frontend: push na `develop` (dev) nebo `main` (prod) → CI/CD.

Všechny npm scripty v `functions/package.json` používají wrapper
`scripts/firebase-deploy.mjs` co vyčte project ID ze service account
JSON a předá `--project <id>` firebase CLI. Není potřeba globální
`firebase login` ani `.firebaserc`.

**Proč pořadí**: rules musí vědět o novém field před tím, než klient
začne zapisovat (jinak `create` validation padne). Functions pak
zpracují data podle nové logiky. Frontend nakonec.

**Při čistě-client změně** (žádný schema ani CF): stačí frontend deploy.

**Migrace dat** (jako V17.8): mezi rules deploy a frontend deploy
spusť migrační skript z sekce 6, aby nová rule měla co gate-ovat.

---

## 8. Node + TypeScript

- **Node 24.15.0** pro `app/` (přes `.nvmrc`). **Node 20** pro
  `app/functions/` (Cloud Functions runtime).
- `tsconfig`: `"module": "Node16"` + `"moduleResolution": "Node16"` v
  functions (TS 5.7+ deprecated node10/node).
- `tsx` není dostupný v sandbox bezinstalace — pro ad-hoc testy použij
  `npx tsc` build + `node ./lib/...`.

---

## 9. i18n

Jediný jazyk: **čeština** (`app/src/i18n/cs.json`).

- Klíče formát: `namespace.key` s tečkou (`t("detail.back")`).
- Nested: `t("notifikace.events.mention")`.
- Vars: `t("card.minutesAgo", { n: 5 })` — `{n}` placeholder.
- Když přidáš nový string, **vždy** přes `t()` — nikdy hardcoded text
  v komponentě. Tím je připravené na V2 i18n stack pokud přijde.

---

## 10. Konvence jmen

- `OWNER` / `PROJECT_MANAGER` (všechny caps, underscore) — `UserRole`.
- `napad` / `otazka` / `ukol` (lowercase, bez diakritiky) — `TaskType`.
- Status: `"OPEN" | "BLOCKED" | "CANCELED" | "DONE"` (V10 canonical) +
  legacy (Nápad, Otázka, Rozhodnuto, Ve stavbě, Hotovo…).
- Feature flags: `V{N}.{m}` (`V17.1`, `V16.9`) — shoda s task listy a
  commit messages.
- Komentáře v kódu: česky je OK, směs s angličtinou dovolena (historické).

---

## 11. Co NEDĚLAT

- ❌ Neměň `switch` v `copy.ts` — jen v `catalog.ts`.
- ❌ Neřeš permissions "jen v UI" — vždy mirror v `firestore.rules`.
- ❌ Neházej service account JSON do gitu. `**/scripts/*.json` v
  `.gitignore` chrání před omylem, ale pohlídej si i manuálně.
- ❌ Nespouštěj migrační skript na prod bez předchozího dev testu.
- ❌ Nenechávej jednorázové skripty v `scripts/` — archivuj po run.
- ❌ Neupravuj `NOTIFICATION_EVENT_KEYS` ručně — je derivováno ze sortu
  katalogu.
- ❌ Netvoř fallback na "OWNER" pro missing `authorRole` — nech
  `undefined`, caller resolvuje přes user lookup.

---

## 12. Historie verzí (stručný changelog)

- **V10** — canonical status (OPEN/BLOCKED/CANCELED/DONE), assignee-driven ball-on-me, multi-OWNER
- **V14** — ukol type, dependencyText, vystup field, convert napad→ukol
- **V15** — FCM push pipeline (CF + client + SW), data-only payload
- **V15.1** — in-app inbox (bell v headeru)
- **V15.2** — read permissions uvolněny pro všechny signed-in users
- **V16** — `notification catalog` single source (V16.7), debounce
  plánováno ale nezapojeno (V16.5 pending), presence suppression (V16.9),
  přezdívka, collapsible settings, změny v change-detection triggerech
- **V17** — nový permissions model (authorRole + cross-OWNER +
  delete-just-author), TaskDetail canEdit refactor, composer assignee
  povinný, merged `assigned_with_comment`, device sanity hook, pure
  helpers extracted + testy, backfill skript pro legacy tasks
