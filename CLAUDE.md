# CLAUDE.md — konvence a patterns

Tenhle soubor je pro **Claude** (AI asistenta). Drží condensed soubor patternů, rozhodnutí a pravidel, která musí respektovat při práci na projektu **Chytrý dům na vsi** — PWA pro záznam a řešení nápadů, otázek, úkolů a dokumentace kolem stavby domu mezi OWNER (Stáňa + manželka) a PROJECT_MANAGER.

Když Claude řeší úlohu, projde tenhle soubor **před** implementací a následuje popsané konvence. Když narazí na rozhodnutí, které tu chybí a přijde mu zajímavé pro budoucnost, přidá ho sem.

---

## 1. App tour — co kde žije

### Top-level

```
app/
├── src/                       # React 19 + Vite + TS PWA frontend
├── functions/                 # Firebase Cloud Functions (Node 20)
├── deploy/                    # Deploy orchestrátor + Firestore/Storage rules
├── scripts/                   # Dev utility skripty
├── public/                    # Static assets, manifest, sw.js source
├── PERMISSIONS_GENERATED.md   # Auto-generated permission matrix
└── CLAUDE.md                  # Tenhle soubor
```

### `src/` — frontend

**`components/`** (~50 souborů) — UI primitivy, pickery, modaly, karty.
- Modaly: `DocumentPickerModal`, `DocumentUploadModal`, `OnboardingModal`, `TaskLinkPickerModal`
- Pickery: `CategoryPicker`, `LocationPicker(Inline)`, `AssigneeSelect`, `DeadlinePicker`, `StatusPickerInline`, `PriorityPickerInline`, `PhasePickerInline`
- Karty/seznamy: `NapadCard`, `TaskList`, `TaskGroupedView`, `Composer`
- Editor + komentáře: `RichTextEditor` (Tiptap, lazy), `CommentThread`, `CommentItem`, `CommentComposer`
- Layout: `Shell`, `BusyOverlay`, `NotificationBell`, `Toast`, `Lightbox`, `SwipeReveal`
- Filter chips: `FilterChips`, `StatusFilterChip`, `PriorityFilterChip`, …

**`routes/`** — top-level stránky.
- Listy: `Zaznamy` (nápady), `Ukoly`, `Otazky`, `Dokumentace`, `Events`, `Harmonogram`, `Prehled`
- Detaily: `TaskDetail`, `EventDetail`
- Composer: `EventComposer` (úkoly mají `Composer.tsx` a spawn přes `/t/new`)
- Settings: `Settings`, `Kategorie`, `KategorieDetail`, `Lokace*`, `DocTypes*`, `Phases*`
- Auth: `Auth/Login`
- Misc: `Export`, `Rozpocet`, `Home` (deprecated stub — redirect na `/ukoly`)

**`hooks/`** — Firestore subscriptions + cache + utility hooky.
- Data: `useTask`, `useTasks`, `useEvent`, `useUsers`, `useCategories`, `useLocations`, `usePhases`, `useDocumentTypes`, `useComments`, `useRsvps`, `useInbox`, `useEventsActionCount`, `useVisibleTasks`
- User: `useAuth`, `useUserRole`, `useNotificationPermission`, `useDeviceRegistrationSanity`, `useRegisterFcm`, `useInboxAutoRead`, `useAppBadge`
- Misc: `useTheme`, `useOnline`, `useInstallState`, `useSwNavigate`

Pattern: data hooks vrací **discriminated union state** — `{status: "loading"} | {status: "ready", task: Task} | {status: "error", error}`.

**`lib/`** (~45 souborů) — pure helpers + Firestore wrappery.
- Tasks/Events/Comments: `tasks`, `events`, `comments`, `rsvp`, `inbox`
- Pure helpers: `permissions`, `permissionsConfig`, `authorRole`, `commentTargeting`, `mentions`, `names`, `presence`
- Bridge/format: `status` (legacy → V10 mapper), `deadline`, `eventFormatting`, `eventDateInput`
- Filters/search: `filters`, `eventsFilter`, `search`, `prehled`, `subscriptionStatus`
- I/O: `auth`, `firebase`, `messaging` (FCM), `attachments`, `storage`, `pdf`, `ics`
- Config: `enums`, `limits`, `storageKeys`, `routes`, `theme`, `typeColors`, `pdfTokens`
- Categories/locations/phases/docs: `categories`, `locations`, `phases`, `documentTypes`
- User: `userProfile`, `users`, `calendarToken`, `installPrompt`, `id`
- Composers/text: `createTaskFromComposerInput`, `textExport`, `links`

**`i18n/`** — `cs.json` (~880 řádků, 49 namespaces) + `useT.ts` hook. Pattern: `t("ns.key")`, vars přes `t("k", { n: 5 })` + `{n}` placeholder.

**`test/`** — sdílené test plumbing.
- `firestoreMock.ts` — in-memory Firestore stand-in (Map<path, data> + calls log)
- `render.tsx` — `renderWithProviders` (MemoryRouter wrapper) + `fakeUser` factory
- `setup.ts` — registruje `@testing-library/jest-dom/vitest` + cleanup po každém testu

**`types.ts`** — všechny shared types: `Task`, `Event`, `Comment`, `UserProfile`, `Category`, `Phase`, `Location`, `DocumentType`, `Rsvp`, `NotificationEventKey`, `NotificationPrefs`, `NotificationDevice`, `NotificationItem`, …

### `functions/src/` — backend

- `index.ts` — exports + Admin SDK init (region `europe-west1`). 11 funkcí: `helloPing` (smoke), 6 event handlers (`onTaskCreated/Updated/Deleted`, `onCommentCreate`, `onEventCreated/Updated`, `onRsvpWrite`, `onUserUpdated`), 2 scheduled (`eventLifecycleTick`, `rsvpReminderTick`), 1 HTTP (`calendarSubscription`)
- `triggers/` — Firestore event handlery (`onTaskWrite`, `onTaskDeleted`, `onCommentCreate`, `onEventWrite`, `onRsvpWrite`, `onUserWrite`)
- `notify/` — push pipeline (14 souborů; viz sekci 4)
- `scheduled/` — cron triggery (`eventLifecycle`, `rsvpReminder`)
- `cal/` — ICS subscription endpoint, ICS generator
- `lib/` — build artefakt (TypeScript output, gitignored)

### `deploy/`

- `deploy.mjs` — orchestrátor (rules → migrace → functions → archivace)
- `firebase-deploy.mjs` — wrapper kolem `firebase` CLI
- `dev.json`, `ope.json` — service account JSONy (gitignored)
- `firestore.rules`, `storage.rules` — bezpečnostní pravidla
- `pending/` — čekající migrační skripty (v steady state prázdný)
- `archive/` — proběhlé migrace + tabulka v `README.md`
- `package.json` — npm scripty `deploy:dev:dry`, `deploy:dev`, `deploy:ope:dry`, `deploy:ope`, ad-hoc `rules:deploy:*`, `functions:deploy:*`, `storage:deploy:*`

### `scripts/`

- `gen-permissions-md.mjs` — generuje `app/PERMISSIONS_GENERATED.md` z `permissionsConfig.ts`. Spouštěno přes `npm run docs:permissions`.

---

## 2. Schema model

Authoritative source: **`app/src/types.ts`**. Bridge funkce (legacy → modern shape) v `lib/tasks.ts/fromDocSnap`, `lib/events.ts`, …

### Task

```ts
type TaskType = "napad" | "otazka" | "ukol" | "dokumentace";

interface Task {
  // ---- core ----
  id, type, title, body, status, createdBy, createdAt, updatedAt
  authorRole?: UserRole          // V17.1 snapshot (cross-OWNER edit gate)

  // ---- taxonomy (legacy + N:M modern) ----
  categoryId?: string | null     // legacy single
  categoryIds?: string[]         // V3 modern
  locationId?: string | null
  phaseId?: string | null        // V23

  // ---- linking (V18-S40 many-to-many) ----
  linkedTaskIds?: string[]       // modern bidirectional
  linkedTaskId?: string | null   // legacy single (bridged)

  // ---- attachments ----
  attachmentImages?: ImageAttachment[]   // S24 modern
  attachmentImageUrl?: string | null     // legacy
  attachmentImagePath?: string | null
  attachmentLinks?: string[]             // S25 modern
  attachmentLinkUrl?: string | null      // legacy

  // ---- actionable (otazka/ukol) ----
  priority?: TaskPriority        // P1/P2/P3, default "P2"
  deadline?: number | null       // ms epoch nebo null
  assigneeUid?: string | null

  // ---- otazka-specific ----
  projektantAnswer?: string | null
  projektantAnswerAt?: string | null

  // ---- ukol-specific ----
  dependencyText?: string | null   // V14

  // ---- napad-specific ----
  vystup?: string | null    // V14 — durable resolution summary

  // ---- dokumentace-specific (V19) ----
  documents?: DocumentAttachment[]
  auditLog?: AuditEntry[]
  linkedDocIds?: string[]

  // ---- sharing (V19) ----
  sharedWithRoles?: UserRole[]   // replaces legacy sharedWithPm

  // ---- comments meta ----
  commentCount?: number          // cached, batch-maintained
}
```

### Bridge tabulka (legacy → modern, čte `fromDocSnap`)

| Legacy field | Modern field | Bridge funkce |
|--------------|--------------|---------------|
| `categoryId` (string) | `categoryIds` (string[]) | `bridgeCategoryIds` |
| `attachmentImageUrl/Path` | `attachmentImages[]` | `bridgeImages` |
| `attachmentLinkUrl` | `attachmentLinks[]` | `bridgeLinks` |
| `linkedTaskId` (single) | `linkedTaskIds[]` | `bridgeLinkedTaskIds` |
| `sharedWithPm: true` | `sharedWithRoles: ["PROJECT_MANAGER"]` | inline |
| `priority` undefined (otazka/ukol) | `"P2"` default | `bridgePriority` |

⚠️ **Při zápisu modern field vždy clear legacy field na `null`** (např. `linkedTaskId: null` při zápisu `linkedTaskIds: [...]`). Bez toho bridge re-bridguje legacy zpátky a UI ukáže stav, který "myslel že smazal" — repro V18-S40 unlink bug.

### Status

V10 canonical: `OPEN | BLOCKED | CANCELED | DONE`. Plus legacy: `Nápad | Otázka | Čekám | Rozhodnuto | Ve stavbě | Hotovo | ON_CLIENT_SITE | ON_PM_SITE`. Read-time mapper `mapLegacyOtazkaStatus` v `lib/status.ts`.

⚠️ **CANCELED vs CANCELLED drift:**
- **Tasks** používají `CANCELED` (US, jedno L)
- **Events** používají `CANCELLED` (UK, dvě L) — vyžaduje ICS RFC 5545

Hodnoty se nepoužívají v jedné doméně, takže drift je bezpečný. Když přidáš nové místo se status comparison, mrkni do typu (TS to vynutí).

### Event (V18)

```ts
type EventStatus = "UPCOMING" | "AWAITING_CONFIRMATION" | "HAPPENED" | "CANCELLED";

interface Event {
  id, title, description, startAt, endAt, isAllDay, address
  inviteeUids: string[]               // min 1
  createdBy, authorRole?, status
  linkedTaskId?: string | null        // optional ref na /t/:id
  happenedConfirmedAt?, cancelledAt?
  reminderSentAt?: string             // V18-S13 RSVP reminder
  createdAt, updatedAt
}

interface Rsvp { uid, response: "yes"|"no", respondedAt }
// Subkolekce: /events/{eventId}/rsvps/{uid}, doc id = uid → max 1 RSVP per pozvaný
```

### UserProfile

```ts
interface UserProfile {
  uid, email, role: "OWNER" | "PROJECT_MANAGER"
  displayName?               // "Přezdívka", editovatelná v Settings
  contactEmail?              // V18-S24, pro Apple Calendar matching
  notificationPrefs?: { enabled, events: Record<NotificationEventKey, boolean> }
  calendarToken?             // V18-S12, webcal subscription
  calendarTokenRotatedAt?
  calendarLastFetchedAt?     // V18-S25, throttled CF update
  onboardingCompletedAt?     // V18-S30, modal done flag
}
```

`role` + `email` writable jen Admin SDK. Self-update přes diff-gate v rules: jen `notificationPrefs`, `displayName`, `contactEmail`, `calendarToken*`, `calendarLastFetchedAt`, `onboardingCompletedAt`, `updatedAt`.

### Další modely

- **Comment** (subkolekce `/tasks/{id}/comments/{cid}`) — `body, authorUid, attachments, mentions, reactions, workflowAction?, statusAfter?, assigneeAfter?, priorAssigneeUid?` (V17.5)
- **Category, DocumentType, Phase, Location** — taxonomie, OWNER-managed, jednoduché `{id, label, createdBy, createdAt}` shapes
- **NotificationItem** — subkolekce `/users/{uid}/notifications/`, server-only write (CF)

---

## 3. Permissions model

**Authoritative**: `app/deploy/firestore.rules`. Klientské helpery jsou jen UX gating — rules jsou final word.

### Klient mirror

`app/src/lib/permissionsConfig.ts` — declarative matrix akcí × rolí × ownership. **Single source pro klient**, ale **rules musíš updatovat ručně** (config sám rules nepřegeneruje, jen ukazuje na ně přes `rulesAt` pointer).

### 20 aktuálních akcí

```
tasks:    read, create.napad, create.otazka, create.ukol, create.dokumentace,
          edit, delete, comment, changeType (V18-S40), link (V18-S40)
events:   read, create, edit, delete, rsvp
taxonomy: categories.manage, locations.manage, documentTypes.manage
settings: profile, calendarToken
```

Po změně automaticky regen: `npm run docs:permissions` → `app/PERMISSIONS_GENERATED.md`.

### Ownership patterny

- `anyone` — jen role check (např. `task.read`, `task.comment`)
- `author` — striktně autor `createdBy === me` (např. `task.delete`, `event.delete`)
- `author-or-cross-owner` — autor + (OWNER edituje OWNER-created task). V17.1 cross-OWNER pattern; PM-created tasky může editovat jen PM-autor.

### V17.1 cross-OWNER edit (klíčový pattern)

OWNER účet je sdílený prostor (manželé). Co vytvořil jeden OWNER, druhý OWNER smí editovat. PM-created tasky jsou soukromé jen pro PM-autora. Snapshot role autora je v `task.authorRole` (zaznamenaný při create); pro legacy tasky se resolvuje přes `resolveAuthorRole({task, usersByUid})` v `lib/authorRole.ts`.

### Postup změny permissions

1. Rozšiř `ActionKey` union v `permissionsConfig.ts`
2. Přidej entry do `PERMISSIONS` (`roles`, `ownership`, `description`, `rulesAt`)
3. Updatuj `firestore.rules` přesně tam, kam ukazuje `rulesAt`
4. `npm run docs:permissions` — regen markdown
5. `npm test` — invariant testy v `permissionsConfig.test.ts` ověří, že každá rule má `rulesAt`, `description`, neprázdné `roles[]`
6. Commit všechno (config + rules + generated MD) v jednom PR

### V18-S40 — `task.changeType` + `task.link`

- **`task.changeType`** — mutace `type` pole (otazka ↔ ukol). Stejný permission pattern jako edit. Napad/dokumentace nelze měnit.
- **`task.link`** — bidirectional update `linkedTaskIds` na obou tasích (otazka/ukol ↔ napad). Klient gates přes `canLinkTasks(both sides)`. Server: každý update musí projít edit rule individuálně; když nemá oprávnění na jeden, batch atomicky padne.

### `isCommentSideEffect` rule

Kdokoli signed-in smí aplikovat diff `{commentCount, updatedAt, status?, assigneeUid?}` na task — aby `createComment` batch prošel i když není autor. Diff-gate v rules zajišťuje, že tahle escape hatch nemůže flipnout status nezávisle.

---

## 4. Notification pipeline

### Tři zodpovědnosti, tři místa

| Co | Kde |
|----|-----|
| **KDY** spustit (routing) | `functions/src/triggers/*.ts` |
| **CO** napsat (title, body, deep-link) | `functions/src/notify/catalog.ts` |
| **JAK** doručit (FCM + inbox + prefs) | `functions/src/notify/send.ts` |

### Catalog (single source)

`NOTIFICATION_CATALOG` v `notify/catalog.ts`. Pro každý event:
- `category` — `immediate` | `debounced`
- `dedupePriority` — nižší číslo = vyšší priorita
- `trigger` — dokumentace kdy se posílá
- `recipients` — dokumentace komu
- `renderTitle/Body/DeepLink` — pure functions
- `clientLabelKey` — i18n key pro toggle v Settings
- `defaultEnabled` — opt-in/out default

### 17 event types

```
mention, assigned, comment_on_mine, comment_on_thread,
shared_with_pm, priority_changed, deadline_changed,
task_deleted, assigned_with_comment,
event_invitation, event_rsvp_response, event_update,
event_uninvited, event_cancelled, event_calendar_token_reset,
event_rsvp_reminder, document_uploaded
```

### Render pipeline

`renderPayload` v `copy.ts` je **tenký wrapper** — deleguje do `renderNotification` v katalogu. Switch v `copy.ts` neměníme; uprav katalog.

### Klíčové patterny

- **Dedupe** — `EVENT_PRIORITY` array z katalogu (`eventPriorityList()`). `buildRecipientMap(sources)` zajišťuje max 1 event per recipient.
- **V17.5 comment+flip merge** — když komentář flipuje assignee, `applyAssignedWithCommentOverride` přepíše event na `assigned_with_comment` (nejvyšší dedupe priority). Klient v `createComment` posílá `priorAssigneeUid` (= `task.assigneeUid` před batch).
- **`isCommentBatchUpdate({before, after})`** v `onTaskUpdated` — detekuje comment-side-effect (afterCount > beforeCount) a skipne notifikaci, kterou už `onCommentCreate` pokryje.
- **V16.4 protistrana self-filter** — pro change events (priority/deadline na assignutém tasku): recipient = ten z `{createdBy, assigneeUid}`, kdo NENÍ actor. `protistrana.ts`.
- **V16.9 presence suppression** — SW `onBackgroundMessage` přes `clients.matchAll` zjistí jestli je app visible. Pokud ano, skip `showNotification()`. Na `/t/{taskId}` navíc pošle `INBOX_AUTO_READ` postMessage — `useInboxAutoRead` mark-readne okamžitě.

### Push vs. inbox vs. badge

- **Inbox** (`/users/{uid}/notifications/`) — zapisuje se serverově **i** když user nemá FCM token. Bell ve UI bere přes `useInbox` Firestore snapshot.
- **Push FCM** — jen když je zaregistrované zařízení (`/users/{uid}/devices/{deviceId}`).
- **Badge** (červené číslo) — `useInbox` + `useAppBadge` z unread inbox items.

### Přidání nového event type

1. Rozšiř `NotificationEventKey` union v `functions/src/notify/types.ts` **i** `app/src/types.ts` (mirror)
2. Entry do `NOTIFICATION_CATALOG` (`catalog.ts`)
3. i18n klíče v `cs.json` (`notifikace.events.<key>` + `<key>Hint`)
4. Ikona v `EVENT_ICONS` (`NotificationPrefsForm.tsx`) + `EVENT_ICON` (`NotificationList.tsx`)
5. Klíč v `NOTIFICATION_EVENTS` array + `DEFAULT_PREFS.events` (`lib/notifications.ts`)
6. Trigger pošle `sendNotification({ eventType, recipientUid, actorUid, actorName, taskId, task, ... })`

---

## 5. Pure helpers + state patterns

### Pure helper extraction (V17.7+)

Logiku, která se dá izolovat od React state a Firestore, vytahuj do **pure funkcí** v `lib/` (nebo `functions/src/notify/`) a piš k nim unit testy.

Příklady: `canEditTask`, `canChangeTaskType`, `canLinkTasks`, `resolveAuthorRole`, `applyAssignedWithCommentOverride`, `isCommentBatchUpdate`, `protistrana`, `resolveUserName`, `shouldAutoReadOnPath`, `taskIdFromPath`, `bridgeLinkedTaskIds`, …

**Postup**:
1. Identifikuj inline logiku v komponentě / triggeru
2. Extrahuj do `lib/<téma>.ts` s jasnou input/output signaturou (žádný implicitní state, I/O)
3. Caller volá helper místo inline kódu
4. Napiš `<téma>.test.ts` ve stejném adresáři — vitest, describe/it/expect. Snap scénáře: happy path, edge case, null/undefined inputs, self-loop

### State pattern: discriminated union

Pro async stavy (Firestore subscriptions):
```ts
type State =
  | { status: "loading" }
  | { status: "ready"; task: Task }
  | { status: "error"; error: Error };
```
Použito v `useTask`, `useEvent`, `useUserRole`, `useCategories`, `useLocations`, `usePhases`, `useDocumentTypes`. Caller pak `if (state.status !== "ready") return ...`.

### Lazy loading + Suspense

Heavy komponenty lazy import, fallback `<Suspense fallback={null}>` (nebo skeleton):
- `RichTextEditor` (Tiptap) — TaskDetail
- `CommentThread`, `AuditTimeline` — TaskDetail
- `DocumentUploadModal`, `DocumentPickerModal`, `TaskLinkPickerModal` — TaskDetail
- `EventComposer` — Events route

### Auto-save (TaskDetail blur-driven)

`BLUR_SAVE_DELAY_MS = 1000ms`. Pattern:
- `pendingRef` drží diff (title/body/vystup)
- `flushOnBlur()` schedule timer
- Refocus do editoru cancelluje timer
- Unmount + `pagehide` flushne pending
- `isReadOnlyRef.current` safety — nikdy save z read-only view

### Read-only gating

```ts
const canEdit = canEditTask({task, taskAuthorRole, currentUserUid, currentUserRole});
const isReadOnly = !canEdit;
isReadOnlyRef.current = isReadOnly;
```
Disabled na všech inputech, RichTextEditor `disabled` prop.

---

## 6. Test stack + playbook

### Stack

- **Vitest** v `app/` i `app/functions/` (samostatné balíčky)
- **@testing-library/react** + `@testing-library/jest-dom` pro komponentní testy
- `@/test/firestoreMock` — in-memory Firestore stand-in
- `@/test/render` — `renderWithProviders` (MemoryRouter wrapper) + `fakeUser`

### Decision tree

| Co testuju | Typ | Příklad |
|-----------|-----|---------|
| Pure logika bez state/I/O | Pure helper test | `permissions.test.ts`, `authorRole.test.ts`, `deadline.test.ts`, `names.test.ts` |
| Firestore wrapper (`createTask`, `linkTaskToNapad`) | firestoreMock | `tasks.test.ts`, `events.test.ts`, `comments.test.ts` |
| UI komponenta s providery | RTL + `renderWithProviders` | `Composer.test.tsx`, `NapadCard.test.tsx`, `CategoryPicker.test.tsx` |
| Backend trigger / notify pipeline | Pure helper test | `catalog.test.ts`, `dedupe.test.ts`, `commentFlip.test.ts` |

**Preference**: pure helper test > firestoreMock test > komponentní test. Pure jsou nejrychlejší, nejstabilnější, nejlépe lokalizované.

### firestoreMock pattern

```ts
import { vi } from "vitest";
vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
beforeEach(() => __firestoreState.reset());

it("...", async () => {
  __firestoreState.store.set("tasks/t1", { ... });
  await myFunc();
  const updated = __firestoreState.store.get("tasks/t1");
  expect(updated.field).toBe(...);
});
```
`__firestoreState.calls` — array of `{op, path, data}` pro assertion na write shape.

### renderWithProviders pattern

```tsx
import { renderWithProviders } from "@/test/render";

it("...", () => {
  renderWithProviders(<MyComp ... />, { route: "/t/123" });
  expect(screen.getByRole("button", { name: /label/i })).toBeInTheDocument();
});
```

### Invariant-based aserce

Místo pozicionálních (`expect(KEYS[0]).toBe("x")`) preferuj invariant — odolnost proti sort order / Object.keys insertion order:
```ts
expect(catalog["mention"].dedupePriority).toBeLessThan(catalog["comment_on_mine"].dedupePriority);
```

### Spuštění

```
cd app && npm test                # frontend
cd app/functions && npm test      # backend
```

CI: `validate` pipeline spouští oboje.

---

## 7. Deploy + migrace

### Orchestrátor (kanonická cesta)

```
cd app/deploy
npm run deploy:dev:dry        # dev dry-run (echo only)
npm run deploy:dev            # dev ostrý — pending zůstává po úspěchu
# ...ověř na dev environmentu
npm run deploy:ope:dry        # prod dry-run
npm run deploy:ope            # prod ostrý — pending → archive + záznam v README
```

### Co dělá `deploy.mjs`

1. Resolvuje project ID ze service account (`dev.json` / `ope.json`)
2. `firebase deploy --only firestore:rules`
3. `firebase deploy --only storage`
4. Spustí každý pending skript: `node <script> <env>`. Selže → orchestrátor zastaví.
5. Functions build + `firebase deploy --only functions`
6. Pokud env=`ope` a vše OK: pending → archive + řádek v `archive/README.md` (parsuje JSDoc tagy `@migration`, `@date`, `@description`)

### Flagy

- `--dry-run` — echo only, nic se nezapíše
- `--skip-firebase` — jen migrace, přeskočí rules + functions deploy. Užitečné pro data fixlety bez code change.

### Deploy pořadí (proč rules → migrace → functions → frontend)

Při schema změnách:
1. **Rules** musí vědět o novém field před tím, než klient zapíše (jinak `create` validation padne)
2. **Migrace** doplní field do historických tasků (jinak nová rule by je zamítla)
3. **Functions** zpracují data podle nové logiky
4. **Frontend** nakonec — přes git push (`develop` → dev environment, `main` → prod)

### Ad-hoc deploy (mimo orchestrátor)

```
npm run rules:deploy:dev / rules:deploy:ope
npm run functions:deploy:dev / functions:deploy:ope
npm run storage:deploy:dev / storage:deploy:ope
```

### Migrace — kdy psát pending skript?

#### NUTNÝ skript:
- Nová rule by zamítla writes nad existujícími daty (povinný field)
- Aplikace by spadla nebo špatně renderovala bez backfillu
- Runtime bridge nemůže problém řešit lazily

#### NEPSAT skript, když:
- Runtime bridge ve `fromDocSnap` / `bridge*` funkce stačí
- Data se postupně samy migrují normální interakcí (např. unlink clear `linkedTaskId: null`)
- Nejistota → **zeptej se uživatele**, nikdy nepiš preemptivně "pro jistotu"

> Zkušenost: V18-S40 — psal jsem skript, který nebyl potřeba. Bridge řešil legacy reads, unlink clearoval per-task. Nepiš zbytečně.

#### Šablona pending skriptu

- Cesta: `app/deploy/pending/YYYY-MM-DD-V{verze}-{popis-kebab-case}.mjs`
- Header — JSDoc tagy:
  ```
  @migration V17.8
  @date 2026-04-24
  @description Krátký popis co dělá
  ```
- První positional arg: `dev | ope` → service account z `../{env}.json`
- `--dry-run` flag (echo only)
- **Idempotentní** (druhé spuštění nic nezapíše)
- Guard na začátku: pokud `basename(dirname(__filename)) === "archive"` → `console.error` + `process.exit(2)`
- Po `ope` úspěchu: orchestrátor přesune do `archive/`

Šablona — viz `app/deploy/archive/2026-04-27-V19-sharedWithRoles.mjs` (nejčistší příklad).

---

## 8. i18n + a11y

### i18n (`cs.json`)

Single soubor, jediný jazyk (čeština). 49 top-level namespaces, ~880 řádků.

**Hlavní namespaces** (každý 5–110 klíčů): `app`, `tabs`, `composer`, `detail`, `settings`, `ukoly`, `otazky`, `events`, `notifikace`, `inbox`, `comments`, `dokumentace`, `kategorie`, `locations`, `phases`, `docTypes`, `role`, `common`, `aria`, `toast`, `priority`, `deadline`, `status`, `auth`, `onboarding`, `prehled`, `export`, `install`, `update`, `filter`, `card`, `editor`, `list`.

**Pravidla**:
- Klíče: `namespace.key` (tečka). Nested: `notifikace.events.mention`
- Vars: `t("card.minutesAgo", { n: 5 })` — `{n}` placeholder
- **Nikdy** hardcoded text v komponentě — vždy přes `t()`. Připravený na V2 i18n stack.

### a11y konvence

#### Modaly

```jsx
<div
  onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 pt-safe pb-safe"
  role="dialog"
  aria-modal="true"
  aria-label={t("...")}
>
```
- ESC keydown → close (handler v komponentě)
- Backdrop click → close (`target === currentTarget`)
- Focus trap nedoporučeno víc než dlouhé form modaly; jednoduché dialogy se obejdou.

#### Tlačítka

- Icon-only button: vždy `aria-label`
- Decorative icons (uvnitř buttonu/labelu): `aria-hidden`
- Min tap target: Tailwind utility `min-h-tap` (44px) + `min-w-tap`

#### Status indikátory

Color isn't sole channel — vždy color **+** text label. Status border-left + text label.

### Tone konvence

- Komentáře v kódu: česky OK, směs s angličtinou dovolena (historicky)
- UI text: česky, neformálně-zdvořile (tykání)

---

## 9. Konvence jmen + Node/TS

| Doména | Konvence | Příklad |
|--------|----------|---------|
| User role | UPPER_SNAKE | `OWNER`, `PROJECT_MANAGER` |
| TaskType | lowercase, bez diakritiky | `napad`, `otazka`, `ukol`, `dokumentace` |
| Status (task) | UPPER (V10) + Czech (legacy) | `OPEN`, `BLOCKED`, `CANCELED`, `DONE`, `Nápad`, … |
| Status (event) | UPPER s 2-L | `UPCOMING`, `CANCELLED` |
| Feature flag | `V{N}.{m}` nebo `V{N}-S{NN}` | `V17.1`, `V18-S40` |
| File `.test.ts` | Vitest unit (lib) | `permissions.test.ts` |
| File `.test.tsx` | Component test (RTL) | `Composer.test.tsx` |
| File `.mjs` | Node ES module | `deploy.mjs`, migrace |

### Node + TypeScript

- **Node 24.15.0** pro `app/` (přes `.nvmrc`)
- **Node 20** pro `app/functions/` (Cloud Functions runtime)
- TS config functions: `"module": "Node16"` + `"moduleResolution": "Node16"` (TS 5.7+ deprecated `node10`/`node`)
- `tsx` není dostupný v sandbox bez instalace — pro ad-hoc skripty použij `npx tsc` build + `node ./lib/...`

---

## 10. Co NEDĚLAT

### UI / komponenty
- ❌ Hardcoded text — vždy přes `t()`
- ❌ Inline `role === "PROJECT_MANAGER"` checky → použij `roleHas("…", role)` nebo `canActOn(...)` z `permissionsConfig` (výjimka: layout decisions, např. které taby v `Shell.tsx`)
- ❌ Modal bez `role="dialog"` + `aria-modal`
- ❌ Icon-only button bez `aria-label`

### Permissions / rules
- ❌ Permissions jen v UI bez mirroru v `firestore.rules`
- ❌ Editovat `PERMISSIONS_GENERATED.md` ručně — jen přes `npm run docs:permissions`
- ❌ Vynechat `rulesAt` v nové `PermissionRule` — invariant test selže

### Schema / Firestore
- ❌ `priority: undefined` (nebo jakýkoli `field: undefined`) v Firestore payloadu → vyhodí `FirebaseError: Unsupported field value: undefined`. Vynech klíč úplně.
- ❌ Při zápisu modern field zapomenout legacy clear (např. `linkedTaskIds: []` bez `linkedTaskId: null` → bridge fall-through ukáže smazaný link dál)
- ❌ Fallback na `"OWNER"` pro missing `authorRole` — nech `undefined`, caller resolvuje přes `resolveAuthorRole({task, usersByUid})`

### Notification pipeline
- ❌ Switch v `copy.ts` — uprav `catalog.ts`
- ❌ Editovat `NOTIFICATION_EVENT_KEYS` ručně — derivováno z catalog sortu
- ❌ Nový event type bez i18n klíčů + ikony + `DEFAULT_PREFS` entry (5 míst, nezapomenout)

### Deploy / migrace
- ❌ Service account JSON do gitu (`.gitignore` chrání, ale dvakrát kontroluj)
- ❌ Spustit migrační skript na prod bez předchozího dev testu
- ❌ Nechávat jednorázové skripty v `pending/` po dokončení — orchestrátor archivuje sám, ale ověř
- ❌ **Preemptive migrační skript** pro něco, co řeší runtime bridge (zkušenost V18-S40)
- ❌ **Přepisovat / mazat skripty v `archive/`** — historie a audit trail

### Testy
- ❌ Mockovat Firebase tam, kde stačí pure-helper extrakce
- ❌ Pozicionální aserce (`KEYS[0]`) místo invariant (`expect(catalog[k].priority).toBeLessThan(...)`)

---

## 11. Version history (changelog)

- **V3** — N:M categories, priority/deadline/assignee na otázce
- **V4** — workflow actions na komentářích (flip, close)
- **V5** — multi-author ready (createdBy)
- **V7** — locations editable, 3-group taxonomy
- **V10** — canonical status (OPEN/BLOCKED/CANCELED/DONE), assignee-driven ball-on-me
- **V14** — `ukol` task type, dependency, vystup, `convertNapadToUkol`
- **V15** — FCM push pipeline (CF + client + SW)
- **V15.1** — in-app inbox bell
- **V15.2** — read permissions uvolněny pro všechny signed-in
- **V16** — notification catalog single source (V16.7), debounce (V16.5), presence suppression (V16.9), self-filter (V16.4), task_deleted event (V16.6)
- **V17.1** — cross-OWNER edit + `authorRole` snapshot
- **V17.2** — composer assignee povinný
- **V17.3 / V17.5** — comment+flip merged → `assigned_with_comment`
- **V17.7** — pure helpers extraction
- **V17.8** — backfill skript pro legacy authorRole
- **V17.9 – V17.11** — deploy orchestrátor + pending/archive workflow
- **V18-S04 – S08** — Events feature (invitations, RSVP, update, cancel)
- **V18-S09** — event lifecycle scheduled CF
- **V18-S11** — webcal ICS subscription (HTTP CF)
- **V18-S12** — calendar token rotation
- **V18-S13** — RSVP reminder scheduled
- **V18-S24 / S25** — `contactEmail` (Apple Calendar match), `calendarLastFetchedAt`
- **V18-S30** — onboarding modal
- **V18-S38** — `permissionsConfig.ts` single source
- **V18-S39** — `limits.ts`, `storageKeys.ts` consolidation
- **V18-S40** — task `changeType` (otazka↔ukol) + many-to-many `linkedTaskIds`, default route `/ukoly`
- **V19** — `sharedWithRoles` (replaces `sharedWithPm`), `dokumentace` task type, audit log
- **V20** — `document_uploaded` notification, OWNER-managed document types
- **V21** — collapsible diskuse pro nápady/dokumentace
- **V22** — `updateTask` strip undefined, `isReadOnlyRef` safety
- **V23** — phases (configurable build phases), `canViewTask` visibility gate
