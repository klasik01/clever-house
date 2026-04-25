# V18 Events — Performance & cleanup report (S18)

Kontrola jestli Phase 1-3 škáluje pro target (~10 users, ~100 events/rok)
a Firebase billing zůstane v Spark free tier nebo těsně pod Blaze $10/měsíc.

## Assumptions

- **Users**: 3 dnes (Stáňa, manželka, PM), plánováno až 10 (rozšíření rodiny, další řemeslníci).
- **Events**: ~2-5 za měsíc aktivně, historie naroste lineárně.
- **Komentáře na event**: MVP nemá, nepočítá se.
- **RSVP records**: ≤invitees per event.
- **Subscription refresh interval**: Apple Calendar default 15 min = 4× za hodinu / user = 96/den.

## List rendering — EventList (`/events`)

**Dotazy**:
- `subscribeEvents()` snapshot listener — all events v `/events`. Klient pak filtruje podle `createdBy == me || uid in inviteeUids`.

**Skálování**:
- 10 users × 5 events/měsíc × 12 měsíců = 600 events/rok. Plně načítat celou kolekci per snapshot update je na 600 docs acceptable (Firestore snapshot ~1-2 MB, update <500ms).
- Po 5 letech: 3000 events. Listener už začíná být těžký. Mitigace: přidat server-side `where("inviteeUids", "array-contains", uid)` query v `subscribeEvents`, nebo paginate.

**Akční**: `subscribeEvents` v `app/src/lib/events.ts` fetchuje všechny — refactor na per-user query (2 concurrent subscribers + dedupe v hook) by pomohl, ale teď overkill. **Skip pro V1, revisit při 500+ events**.

## Detail rendering — EventDetail

**Dotazy**:
- `useEvent(id)` — 1 doc listener.
- `useRsvps(eventId)` — sub-collection listener (typicky 1-5 docs).
- `useUsers()` — all users (pro resolveName).
- `useTask(linkedTaskId)` — podmíněný, jen pokud event má link.

**Skálování**: 4 concurrent listeners per view. Po leave route se all odhlásí (useEffect cleanup). Acceptable. iOS PWA zvládne 10+ listeners bez throttle.

## Firestore writes — reading reservoir

| Akce | Reads | Writes | Notes |
|------|-------|--------|-------|
| Vytvořit event | 1 (auth) | 1 (event) + notifications×invitees | |
| Edit | 1 (re-read) | 1 (event) + notif×kept invitees | |
| Cancel | 1 | 1 + notif×invitees | |
| RSVP set | 1 | 1 (rsvp) + notif×autor (1) | |
| RSVP clear | 1 | 1 (delete) | |
| Lifecycle tick | 1 query | ≤200 batch update | hourly |
| RSVP reminder tick | 1 query + N rsvp subcolls | ≤N × (1 notif + 1 event update) | hourly |

**Odhad (10 users, worst month)**:
- 50 events created/edited × avg 3 invitees = 150 notification writes/měsíc
- 100 RSVPs = 100 writes
- Lifecycle ticks: 24×30 = 720 executions, ale většina no-op (skip log)
- Reminder ticks: stejné
- Subscribe fetches: 10 users × 96 GET/day × 30 = 28 800 CF invocations/měsíc

**Spark free tier limity**:
- Firestore: 50 000 reads/day, 20 000 writes/day, 1 GiB storage → dost široko pod
- Cloud Functions: 125 000 invocations/měsíc, 40 000 GB-seconds, 2M API calls
- Cloud Scheduler: 3 jobs zdarma (máme 2: lifecycle + reminder) → 0 cost

**Výsledek**: S 10 users a 50 events/měsíc jsme hluboko ve Spark free tier. Blaze by začal stát až při 50+ users, kde subscribe fetches (96/day/user × 50 users = 4800/day = 144 000/měsíc) překročí free tier. Pak začne účtovat ~$0.40 za každý milion volání mimo free tier = **~$0.06/měsíc** overhead při 50 users.

## Cloud Function resource budget

| CF | Region | Memory | Timeout | Invocations/měsíc (10 users) |
|----|--------|--------|---------|---------|
| `onTaskCreated/Updated/Deleted` | europe-west1 | 256MB | 60s | ~200 |
| `onCommentCreate` | europe-west1 | 256MB | 60s | ~300 |
| `onEventCreated/Updated` | europe-west1 | 256MB | 60s | ~50 |
| `onRsvpWrite` | europe-west1 | 256MB | 60s | ~100 |
| `onUserUpdated` | europe-west1 | 256MB | 60s | ~20 (mostly token changes) |
| `eventLifecycleTick` | europe-west1 | 256MB | 60s | 720 |
| `rsvpReminderTick` | europe-west1 | 256MB | 60s | 720 |
| `calendarSubscription` (HTTP) | europe-west1 | 256MB | 60s | 28 800 |

**Pesimistická suma**: ~30 910 invocations/měsíc při 10 users. Free tier má 125 000 → 4× hlava.

**Memory / time budget**:
- Subscribe endpoint fetchuje 2 queries + users batch. Průměrná latence ~200-500ms. GB-seconds = 500ms × 256MB = 0.125. × 28 800 = 3 600 GB-s/měsíc. Free tier má 40 000 → 9% využití.

**Výsledek**: CF běží pohodlně ve free tier, prostor pro 100+ users bez financial impact.

## iOS PWA / client performance

| Operace | Cíl | Aktuální |
|---------|-----|---------|
| Events list initial render | <500ms | OK (Firestore snapshot + React render ~200-300ms) |
| Event detail render | <400ms | OK |
| Composer save | <1s | OK (single write + redirect) |
| Webcal fetch server-side | <2s | Testováno v S11 |
| Apple Calendar refresh | ≤15 min | Apple TZ handled |

**Waterfall analýza** (ručně projdená, ne Lighthouse):
- PWA shell + Firebase SDK: ~200KB gzipped (loaded async)
- Events route chunk: ~15KB (lazy)
- ICS library: 0 — custom (no npm dep)
- Lucide icons: tree-shaken, ~5KB pro Events-specific ikony
- Tailwind purged: ~30KB

**Total initial bundle**: ~250KB gzipped, fine na 4G.

## CF cold start

Scheduled CFs (`eventLifecycleTick`, `rsvpReminderTick`) běží jen hodinově, takže každý invocation je cold start (Node 20 ~2-3s). HTTP `calendarSubscription` při 96/day per user drží instance warm pro většinu dne, cold start jen po delších přestávkách.

Acceptable. Pokud někdy zrychlíme scheduled, můžeme použít `minInstances: 1` (stojí $, skip pro V1).

## Memory leaks / cleanup

Prošel jsem useEffect cleanups ve všech Event-related routes:
- `Events.tsx` — `unsub` z subscribeEvents ✓
- `EventDetail.tsx` — `useEvent` + `useRsvps` mají cleanup ✓
- `EventComposer.tsx` — `useEvent` (edit mode), `useTasks` oba cleanup ✓
- `useEvent`, `useRsvps`, `useTasks`, `useTask` hooks — všechny vracejí `unsub` ✓

Inbox + badge sync: fire-and-forget, ale bez setInterval, žádný leak.

## Log noise

CF logs jsou multi-level:
- `logger.debug` — routine skip (no invitees, only status change)
- `logger.info` — akce (fan-out done, event flipped)
- `logger.warn` — recoverable (inbox write failed, device send failed transient)
- `logger.error` — fatal bug paths

Produkční log retention 30 dní = OK pro debugging, nestojí peníze ve free tier.

## Cleanup TODO (identifikovaný při reviewu)

1. **`Events.tsx` stale komentář u FAB** (S17 L1) — smazat "FAB přijde v S02".
2. **Scheduled CF cron syntax** — `"every 1 hours"` je v pořádku pro v2 scheduler, stejné jak eventLifecycle i rsvpReminder. OK.
3. **Dead code**: žádný — komentáře "S16 přidá" atd. jsou legit historie, nesmazat.
4. **Dependencies audit** — `app/functions/package.json`: `firebase-admin`, `firebase-functions`. Bez scheduler je potřeba `firebase-functions/v2/scheduler` = součást core balíčku, OK.

## Recommendation summary

Ship Phase 1+2 bez performance obav. Při nárůstu na 50+ users:
- Přidat paginate na events list
- Approximate caching pro `calendarSubscription` (S17 M3)
- Případně Blaze plan upgrade (stojí pennies/měsíc)

## Billing estimate

| Scale | Spark | Blaze (pokud bys musel přejít) |
|-------|-------|--------|
| 10 users, 50 events/měs | $0 | $0 (stále ve free) |
| 50 users, 250 events/měs | $0-2/měs | ~$1-3/měs |
| 100 users, 1000 events/měs | over limits | ~$5-10/měs |

Under target $10/měsíc pro 10-users MVP i pro 100-users expansion.
