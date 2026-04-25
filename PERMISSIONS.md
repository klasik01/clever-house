# PERMISSIONS.md — kdo smí co

Mapa oprávnění napříč rolemi, autorstvím a kolekcemi. Cílem je mít
**jediný přehled**, kterému stačí věřit, místo prolézání rules + UI
větvení rozházeného po komponentách.

> **TL;DR pro budoucí WORKER roli**: skoč na sekci **8. Playbook —
> přidání role WORKER**. Je tam checklist 8 míst k úpravě s konkrétními
> patches.

---

## 1. Role v systému

| Role                | Kdo to je                                          | Charakter         |
|---------------------|----------------------------------------------------|-------------------|
| `OWNER`             | Stáňa + manželka (sdílený household účet)          | Sdílený workspace |
| `PROJECT_MANAGER`   | Externí projektant / PM                            | Jednotlivec       |
| `WORKER` (plánováno)| Řemeslník / dodavatel s úkoly k vykonání           | Jednotlivec       |

**Klíčový pattern (V17.1 cross-OWNER)**: `OWNER` účet je *sdílený
prostor* — co vytvoří jeden OWNER, druhý OWNER může editovat. Naopak
`PROJECT_MANAGER` (a v budoucnu `WORKER`) jsou *jednotlivci* — jejich
záznamy jsou soukromé, edituje je jen autor.

Role je uložena v `users/{uid}.role` a piše se **jen Admin SDK**
(create/delete users je via skript). Klient ji nemůže měnit (rules
diff-gate to blokuje).

---

## 2. Authorship & cross-edit pattern

### `authorRole` snapshot (V17.1)

Při create každého `task` / `event` se uloží `authorRole: UserRole` —
zamrzlá role autora v ten okamžik. Pokud později user změní roli (vzácný
admin scénář), starý záznam tím není ovlivněn.

**Resolve order** (`lib/authorRole.ts → resolveAuthorRole`):

1. `task.authorRole` (snapshot — dostupný od V17.1)
2. `users[task.createdBy].role` (live lookup — fallback pro legacy data)
3. `undefined` → safe-default = nedovol cross-edit

### Server-side helpery (`firestore.rules`)

```
isOwner()           // current user.role === OWNER
isProjectManager()  // current user.role === PROJECT_MANAGER
isTaskAuthor()      // resource.data.createdBy === auth.uid
isCrossOwnerEditable()
                    // isOwner() && (authorRole missing || authorRole == OWNER)
isCommentSideEffect()
                    // diff hasOnly([commentCount, updatedAt, status?, assigneeUid?])
                    // && diff hasAny([commentCount])
```

### Klientské helpery (`lib/permissions.ts`)

```
canEditTask({task, taskAuthorRole, currentUserUid, currentUserRole})
canEditEvent({event, currentUserUid, currentUserRole})
isReadOnlyTask({...})  // opak canEditTask
```

**Caller** (TaskDetail/EventDetail) musí předem resolvnout
`taskAuthorRole` přes `resolveAuthorRole({task, usersByUid})`.

---

## 3. Server-side matrix (Firestore rules)

Legenda: `auth` = signed-in (jakýkoliv), `self` = `auth.uid === path uid`,
`author` = `resource.data.createdBy === auth.uid`,
`OWNER` = `userRole() === 'OWNER'`,
`x-OWNER` = `OWNER && (authorRole == OWNER || authorRole missing)`,
`comment-fx` = `isCommentSideEffect()`.

### `/users/{uid}`

| Akce   | Pravidlo                                                                  | Poznámka |
|--------|---------------------------------------------------------------------------|----------|
| read   | `auth`                                                                    | Pro mention autocomplete + assignee dropdown |
| create | Admin SDK only                                                            | Bootstrap přes skript |
| update | `self` + diff `hasOnly([notificationPrefs, displayName, contactEmail, calendarToken, calendarTokenRotatedAt, calendarLastFetchedAt, onboardingCompletedAt, updatedAt])` | Role a email jen Admin SDK |
| delete | Admin SDK only                                                            |          |

### `/users/{uid}/devices/{deviceId}` — FCM tokeny

| Akce       | Pravidlo |
|------------|----------|
| read/write | `auth && self` |

### `/users/{uid}/notifications/{notifId}` — inbox

| Akce   | Pravidlo                                  | Poznámka |
|--------|-------------------------------------------|----------|
| read   | `auth && self`                            |          |
| update | `auth && self` + diff `hasOnly([readAt])` | Mark-read, nic víc |
| create | Admin SDK only (CF píše)                  |          |
| delete | nikdo                                     | Audit trail |

### `/tasks/{taskId}`

| Akce   | Pravidlo                                       | Poznámka |
|--------|------------------------------------------------|----------|
| read   | `auth`                                         | V15.2 — kdokoliv |
| create | `auth && createdBy=self && type ∈ {napad, otazka, ukol} && status is string && authorRole ∈ {OWNER, PROJECT_MANAGER}` | Snapshot autora |
| update | `author` OR `x-OWNER` OR `(auth && comment-fx)`| V17.1 model |
| delete | `author`                                       | I cross-OWNER smí jen autor |

### `/tasks/{taskId}/comments/{commentId}`

| Akce   | Pravidlo |
|--------|----------|
| read   | `auth` |
| create | `auth && authorUid=self && body is string` |
| update | `(authorUid=self && diff hasOnly [body, editedAt, reactions])` OR `(auth && diff hasOnly [reactions])` |
| delete | `auth && authorUid=self` |

### `/events/{eventId}`

| Akce   | Pravidlo                                                       | Poznámka |
|--------|----------------------------------------------------------------|----------|
| read   | `auth`                                                         | Listing filtrujeme klientsky |
| create | `auth && createdBy=self && title non-empty && authorRole ∈ {OWNER, PROJECT_MANAGER} && status ∈ {UPCOMING, AWAITING_CONFIRMATION, HAPPENED, CANCELLED} && inviteeUids: list(>=1)` | |
| update | `author` OR `x-OWNER`                                          | Žádný comment-fx (events nemají komenty) |
| delete | `author`                                                       | |

### `/events/{eventId}/rsvps/{userId}`

| Akce       | Pravidlo |
|------------|----------|
| read       | `auth` |
| write      | `auth && self` (= `auth.uid === userId`) |

### `/categories/{categoryId}` & `/locations/{locationId}`

| Akce  | Pravidlo |
|-------|----------|
| read  | `auth` |
| write | `OWNER` (jen vlastník hosp. domácnosti spravuje taxonomy) |

### `/attachments/{attachmentId}` (legacy metadata)

| Akce          | Pravidlo |
|---------------|----------|
| read          | `auth` |
| create/update | `OWNER && taskId is string` |
| delete        | `OWNER` |

### Default

```
match /{document=**} { allow read, write: if false; }
```

---

## 4. Storage rules (`deploy/storage.rules`)

| Path                            | Akce  | Pravidlo |
|---------------------------------|-------|----------|
| `images/{uid}/{taskId}/{file}`  | read  | `auth` |
| `images/{uid}/{taskId}/{file}`  | write | `auth && self` && `<5 MB` && `contentType =~ image/*` |
| `**/*` (default)                | r/w   | nikdo |

Uploady jsou přivlastněné podle uid v cestě (uploader má vlastní
sandbox), ale read je workspace-wide.

---

## 5. Klientské UI gates (kde se role kontroluje)

| Soubor                          | Co rozhoduje                                   |
|---------------------------------|------------------------------------------------|
| `App.tsx`                       | Top-level `useUserRole`, předává do Shell      |
| `components/Shell.tsx`          | BottomTabs viditelnost (`isPm = role === PROJECT_MANAGER`) |
| `routes/Settings.tsx`           | Lokace/Kategorie linky jen pro non-PM (`{!isPm && …}`) |
| `routes/NewTask.tsx`            | `allowedTypes: isPm ? ['otazka','ukol'] : undefined` (PM nesmí napad), `authorRole: isPm ? 'PROJECT_MANAGER' : 'OWNER'` |
| `routes/TaskDetail.tsx`         | `canEdit = canEditTask({...resolveAuthorRole(...)})` — gate na inputy + Save tlačítka |
| `routes/EventDetail.tsx`        | `canEdit = canEditEvent({event, uid, role})` |
| `routes/EventComposer.tsx`      | `authorRole` snapshot při create |
| `lib/permissions.ts`            | Pure helpers `canEditTask`, `canEditEvent`, `isReadOnlyTask` |
| `lib/authorRole.ts`             | `resolveAuthorRole({task, usersByUid})` |

UI gates jsou **UX-only** (chovají se hezky, neukazují tlačítka, která
by stejně failnula). Authoritative jsou rules.

---

## 6. Speciální patterny

### Cross-OWNER edit
Manželé sdílí workspace. Co vytvoří jeden OWNER, druhý smí editovat,
ale nesmí smazat (delete je vždy jen autor — ochrana proti omylu).

### `isCommentSideEffect`
Když PM komentuje OWNER-tasku, batch write z `createComment` musí
update-nout parent task (`commentCount`, `updatedAt`, případně `status`
a `assigneeUid` při workflow akci). Jakýkoliv signed-in to smí, ale jen
v rámci comment-batche — diff je gate-ovaný.

### `assigned_with_comment` (V17.5)
Dedupe priorita 0 — pokud při komentáři dojde k flipnutí assignee,
nový assignee dostane jednu sloučenou notifikaci místo dvou.

### Notification inbox (V15.1)
Server (CF) zapisuje, klient jen mark-readuje. Read-permission je per-uid
(`self`), nikdo jiný do cizí inbox nevidí.

### Calendar token (V18-S12)
User si v Settings vygeneruje token pro webcal subscription. Token žije
v `users/{uid}.calendarToken` a CF endpoint `/cal/:uid/:token.ics`
ho ověří přes Admin SDK. Klient může token rotovat (diff-gate dovoluje
update `calendarToken` + `calendarTokenRotatedAt`).

### `authorRole` legacy fallback
Před V17.1 deployem žádný task neměl `authorRole`. Backfill skript
(`functions/scripts/archive/2026-04-24-V17.8-authorRole.mjs`) doplnil
hodnotu přes user lookup. UI helpery pro jistotu fallbackují přes
`resolveAuthorRole` na live `users[createdBy].role`.

---

## 7. Decision flow — "smí to tenhle user?"

```
1. Je user signed-in?
   NE → ❌
   ANO ↓

2. Read?
   tasks / events / users / categories / locations / comments / rsvps
   → ✅ kdokoliv signed-in (V15.2+)
   notifications / devices
   → musí být self
   storage attachments
   → ✅ auth (write je self-only)

3. Create?
   tasks → createdBy=self, validní type/status, authorRole ∈ {OWNER,PM}
   events → createdBy=self, title, status, authorRole, ≥1 invitee
   comments → authorUid=self, body
   categories/locations → OWNER
   notifications/devices → self (notif jen Admin SDK)

4. Update task/event?
   author?           → ✅
   isCrossOwnerEditable (OWNER edits OWNER-created)? → ✅
   tasks comment-fx? → ✅
   else              → ❌

5. Delete task/event?
   pouze author      → ✅
   nikdo jiný        → ❌

6. Update users?
   self + diff hasOnly([whitelist 8 fieldů])
   → ✅ jinak ❌

7. Update categories/locations?
   OWNER             → ✅
   PM                → ❌
```

---

## 8. Playbook — přidání role `WORKER`

Cíl: workers (řemeslníci, dodavatelé) mají vlastní login a vidí jen
úkoly, kde jsou přiřazeni jako `assigneeUid`. Nemůžou tvořit nápady,
nemůžou spravovat lokace/kategorie. Smí komentovat a měnit status na
přiřazených úkolech.

### Decision matrix (návrh — uprav podle product směru)

| Akce                                  | OWNER | PM  | WORKER |
|---------------------------------------|:-----:|:---:|:------:|
| Read tasks/events                     | ✅    | ✅  | ✅ (auth) — listing filtrovat klientsky na "moje" |
| Create napad                          | ✅    | ❌  | ❌ |
| Create otazka                         | ✅    | ✅  | ❌ |
| Create ukol                           | ✅    | ✅  | ❌ |
| Create event                          | ✅    | ✅  | ❌ (zatím) |
| Edit OWNER-created task/event         | ✅ (cross-OWNER) | ❌ | ❌ |
| Edit PM-created                       | ❌ (jen autor) | ✅ (jen autor) | ❌ |
| Edit WORKER-created                   | ❌    | ❌  | ✅ (jen autor) |
| Comment kdekoliv                      | ✅    | ✅  | ✅ |
| Workflow status flip (comment-fx)     | ✅    | ✅  | ✅ |
| Delete vlastní                        | ✅    | ✅  | ✅ |
| Manage categories / locations         | ✅    | ❌  | ❌ |
| Settings (přezdívka, contactEmail, kalendář) | ✅ | ✅ | ✅ |

### 8 míst k úpravě (checklist)

#### 1. `app/src/types.ts`

```ts
export type UserRole = "OWNER" | "PROJECT_MANAGER" | "WORKER";
```

#### 2. `app/deploy/firestore.rules`

```
function isWorker() {
  return isSignedIn() && userRole() == 'WORKER';
}

// Tasks/events create — rozšířit allow list:
allow create: if isSignedIn()
              && request.resource.data.createdBy == request.auth.uid
              && request.resource.data.authorRole in ['OWNER','PROJECT_MANAGER','WORKER']
              ...;

// Pokud worker NESMÍ create napad:
allow create: if ...
              && (
                request.resource.data.type != 'napad'
                || (userRole() in ['OWNER','PROJECT_MANAGER'])
              );

// Pokud worker NESMÍ create event:
allow create: if ...
              && userRole() in ['OWNER','PROJECT_MANAGER'];
```

*Cross-WORKER edit pattern* obvykle nepotřebujeme (worker je
jednotlivec) — current `isCrossOwnerEditable` filtruje na OWNER, takže
WORKER tam automaticky nepadne. Edit zajistí stávající `isTaskAuthor`.

#### 3. `app/src/lib/permissions.ts`

```ts
// Žádná úprava není nutná — pure helper už `OWNER && OWNER`
// matchne jen mezi OWNER. Test ale doplň:
//   WORKER edits OWNER-task → false
//   WORKER edits vlastní task → true (přes createdBy === me větev)
```

#### 4. `app/src/lib/authorRole.ts`

```ts
if (input.task.authorRole === "OWNER"
    || input.task.authorRole === "PROJECT_MANAGER"
    || input.task.authorRole === "WORKER") {
  return input.task.authorRole;
}
const user = input.usersByUid.get(input.task.createdBy);
if (user?.role === "OWNER" || user?.role === "PROJECT_MANAGER" || user?.role === "WORKER") {
  return user.role;
}
```

#### 5. `app/src/components/Shell.tsx`

```tsx
function BottomTabs({ role }: { role: UserRole }) {
  const isPm = role === "PROJECT_MANAGER";
  const isWorker = role === "WORKER";
  // worker vidí jen Úkoly + Settings (žádný Záznamy / Lokace / Kalendář?)
  // → upravit array tabů podle role
}
```

#### 6. `app/src/routes/NewTask.tsx`

```tsx
const isPm = role === "PROJECT_MANAGER";
const isWorker = role === "WORKER";
const allowedTypes: TaskType[] | undefined =
  isWorker ? [] :          // worker zatím nemůže vůbec; redirect na /ukoly
  isPm ? ["otazka","ukol"] :
  undefined;
const authorRole: UserRole =
  isWorker ? "WORKER" :
  isPm ? "PROJECT_MANAGER" :
  "OWNER";
```

Pokud worker NESMÍ vůbec tvořit, přidej guard v komponentě nebo redirect
v App.tsx routeru.

#### 7. `app/src/routes/Settings.tsx`

```tsx
const isPm = roleState.profile.role === "PROJECT_MANAGER";
const isWorker = roleState.profile.role === "WORKER";

{!isPm && !isWorker && <LocationsLink />}
{!isPm && !isWorker && <CategoriesLink />}
```

Plus přidej `t("role.WORKER")` klíč do `cs.json`.

#### 8. i18n — `app/src/i18n/cs.json`

```json
{
  "role": {
    "OWNER": "Klient",
    "PROJECT_MANAGER": "Projektant",
    "WORKER": "Řemeslník"
  },
  "novy": {
    "pageTitleWorker": "Nový úkol",
    "pageHintWorker": "..."
  }
}
```

### Bonus — server-side filtry pro listing

Pokud chceš, aby worker viděl **jen úkoly, kde je assignee** (ne celý
workspace), nemůžeš to vyjmout v Firestore rules pro listing
(query rules nepodporují per-doc filtr na `assigneeUid` bez index
gymnastiky). Místo toho:

- klientsky filtruj `useTasks()` přes `assigneeUid === uid` pro WORKER role,
- v UI skryj `/zaznamy` a `/napady` taby,
- list query přidat `where assigneeUid == auth.uid`, server-side rule
  klientsky vyžadovat tu klauzuli (`request.query.limit/where` —
  pokročilé, většinou stačí UI-only).

### Migrace pro existující data

Žádná není potřeba — `authorRole` už mají všechny záznamy (V17.8
backfill), nový enum jen rozšiřuje union. Existující OWNER/PM hodnoty
zůstávají platné.

### Test plan

1. `lib/permissions.test.ts` — přidej scénáře:
   - WORKER autor edituje vlastní task → ✅
   - WORKER edituje OWNER-task → ❌
   - WORKER edituje WORKER-task jiného workera → ❌
   - OWNER edituje WORKER-task → ❌
2. `lib/authorRole.test.ts` — fallback na `WORKER` ze user lookupu
3. Manuální E2E: vytvoř workera (admin skript), přihlaš, ověř, že tabs
   ukazují jen Úkoly + Settings, že composer nedovolí napad.

### Deploy pořadí

Stejné jako vždy (CLAUDE.md sekce 7):

```
cd app
npm run rules:deploy:dev   # rules nejdřív (přijmou WORKER hodnotu v authorRole)
# Frontend přes git push develop → CI
# Functions úprava není potřeba (notification routing roli neřeší)
```

---

## 9. Kde je tahle pravda

| Vrstva                  | Soubor(y)                                                  | Role oprávnění |
|-------------------------|------------------------------------------------------------|----------------|
| Authoritative server    | `app/deploy/firestore.rules`, `app/deploy/storage.rules`   | Single source of truth |
| Pure logika (klient)    | `app/src/lib/permissions.ts`, `app/src/lib/authorRole.ts`  | UI gating, mirror rules |
| UI integrace            | `App.tsx`, `Shell.tsx`, `Settings.tsx`, `NewTask.tsx`, `TaskDetail.tsx`, `EventDetail.tsx`, `EventComposer.tsx` | Skryj/zakaž tlačítka |
| Type union              | `app/src/types.ts → UserRole`                              | Compile-time gate |
| i18n                    | `app/src/i18n/cs.json → role.*`                            | Display |

**Vždy** uprav rules **a** klient helper **a** typ ve stejném commitu —
jinak hrozí, že UI dovolí akci, která rules failne (špatná UX), nebo
naopak rules pustí akci, kterou UI neumí postavit.

---

*Aktualizováno: 2026-04-25 (V18-post). Při každém přidání nové role
nebo změně permission patternu prosím updatuj tuhle matici dřív, než
začneš měnit rules.*
