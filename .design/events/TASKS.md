# Events — Build Plan

**Generated from**: DESIGN_BRIEF.md (2026-04-24) +
INFORMATION_ARCHITECTURE.md (2026-04-24)
**Total slices**: 18
**Critical path**: S01 → S02 → S03 → S04 → S05 → S06 (prvně usable V1)
→ S11 → S12 → S14 (webcal + iOS validation) ≈ **9 slices**

**Konvence:** kód anglicky, UI česky (viz DESIGN_BRIEF konvenci).
Každý slice je **vertikální** — protíná data → rules → CF (pokud
potřeba) → UI → test. Žádné "setup database" slices samostatně.

---

## Phase 1 — First usable path

Konečný cíl fáze: **Stáňa vytvoří event s manželkou jako invitee,
manželka dostane push + inbox notifikaci, klikne Můžu/Nemůžu, Stáňa to
vidí. Jednorázový ICS download funguje.**

Po dokončení Phase 1 produkt doručuje primary success metric (nikdo
nezapomíná na schůzky) — jen bez realtime webcal sync.

### S01: Event schema + minimal list route + header icon

- **Goal**: User klikne novou 📅 ikonu v headeru a vidí `/events`
  stránku s prázdným stavem.
- **Scope**:
  - Nový `Event` interface v `app/src/types.ts` (title, description,
    startAt, endAt, isAllDay, address, inviteeUids, creatorUid,
    authorRole, status, linkedTaskId, createdAt, updatedAt,
    happenedConfirmedAt, cancelledAt)
  - Nový `EventStatus` union:
    `"UPCOMING" | "AWAITING_CONFIRMATION" | "HAPPENED" | "CANCELLED"`
  - Firestore rules pro `/events/{id}` (paralelí s V17.1 task rules:
    read = signedIn, create = self + authorRole, update = author ||
    cross-OWNER, delete = author-only)
  - `app/src/lib/events.ts` se `subscribeEvents()`, `getEvent()`,
    `createEvent()`, `updateEvent()`, `deleteEvent()` (pure lib)
  - Route `/events` + komponenta `EventList` + placeholder empty state
  - 📅 `Calendar` lucide ikona v header příslušné komponenty (Shell)
    vedle zvonku, click → `navigate("/events")`
- **Out of scope**: create formulář (S02), detail (S03), RSVP (S05)
- **Dependencies (blockedBy)**: none
- **Acceptance criteria**:
  - [ ] `Event` + `EventStatus` typy v `types.ts`
  - [ ] `firestore.rules` validuje nový `/events/{id}` path
  - [ ] `app/src/lib/events.ts` exportuje CRUD helpers s Firestore
    mock testy
  - [ ] Route `/events` renderuje prázdný list s CTA "Zatím žádné
    události"
  - [ ] 📅 ikona v headeru navigation works, badge je zatím vždy 0
  - [ ] Typecheck + ESLint čisté
- **Size**: M
- **Demo**: Stáňa klikne 📅 → vidí "Zatím žádné události. Přidej
  první přes +".

### S02: Create event composer `/events/new`

- **Goal**: Autor vyplní formulář a nový event se uloží + objeví
  v listu.
- **Scope**:
  - Route `/events/new` + komponenta `EventComposer`
  - Form fields: `title`, `startAt`, `endAt`, `isAllDay` toggle,
    `address`, `description`, `invitees` multi-select
  - Validations:
    - `title.trim().length > 0`
    - `startAt < endAt`
    - `invitees.length >= 1` (min. 1 user mimo autora)
  - `endAt` auto-update na `startAt + 1h` pokud user změní `startAt`
    a `endAt <= startAt`
  - `localStorage["draft:event:new"]` pro draft persistence
  - `createEvent()` zapíše do `/events/{id}` s `authorRole` snapshot
    (z V17.1)
  - FAB `+` na `/events` listu → `/events/new`
  - Invitee picker z `useUsers()` (min. 1 non-self)
- **Out of scope**: linkedTaskId picker (S16), notifikace (S04)
- **Dependencies**: S01
- **Acceptance criteria**:
  - [ ] `/events/new` route + composer
  - [ ] Formulář validuje povinné fieldy
  - [ ] Save úspěšný → redirect `/event/:id` (bude existovat v S03 — do
    té doby redirect na `/events`)
  - [ ] Draft se ukládá v localStorage, restore při refreshi
  - [ ] Event se objeví v listu na `/events`
  - [ ] Unit testy pro `createEvent()` validační logiku
- **Size**: L (biggest slice v Phase 1)
- **Demo**: Stáňa tapne +, vyplní "Elektrikář 14.5. 14:00", pozve
  manželku, Uložit → vidí v listu.

### S03: Event detail `/event/:id` (read-only)

- **Goal**: Zobrazení eventu pro kohokoliv kdo je invitee nebo autor
  (rules V15.2 styl — read = signedIn).
- **Scope**:
  - Route `/event/:id` + komponenta `EventDetail`
  - Layout kopíruje TaskDetail (header back, big datetime, title,
    address, invitees list, description)
  - Pro `isAllDay` zobraz "CELÝ DEN" místo časů
  - Invitees list s avatarama (`AvatarCircle` reuse) + placeholdery RSVP
    (zatím šedé "?")
  - Meta: "Vytvořil {creatorName} před {relative}"
  - Žádné akce zatím (button groupy přidá S05+)
  - Loading / not-found / error states
- **Out of scope**: RSVP actions (S05), edit (S07), cancel (S08)
- **Dependencies**: S01, S02
- **Acceptance criteria**:
  - [ ] Route `/event/:id` renderuje event snapshot
  - [ ] Klik v listu → detail
  - [ ] Loading skeleton před snapshot načte
  - [ ] Not found state při smazaném eventu
  - [ ] Invitees vidím s jejich jmény (resolved přes `useUsers`)
  - [ ] Autor tlačítko delete v headeru (pro testing)
- **Size**: M
- **Demo**: Stáňa klikne event v listu → vidí detail se všemi fieldy.

### S04: Invitation notification (push + inbox)

- **Goal**: Pozvaný dostane push + inbox o pozvání.
- **Scope**:
  - Rozšířit `NotificationEventKey` union o `event_invitation`
    (types.ts + functions/notify/types.ts)
  - Přidat do `NOTIFICATION_CATALOG` (catalog.ts):
    - `category: "immediate"`, `dedupePriority: 10` (nižší než
      comment events — events jsou důležitější)
    - Copy: "{actor} tě pozval na {eventTitle}: {datetime}"
    - Deep-link: `/event/{eventId}`
  - Cloud Function trigger `onEventCreate` (firestore.onDocumentCreated
    na `/events/{eventId}`)
  - Trigger pošle push + inbox každému v `inviteeUids` kromě `creatorUid`
  - Rozšířit UI Settings Notifikace o nový toggle (i18n
    `notifications.events.invitation`)
  - Icon `UserPlus` nebo `CalendarPlus` v NotificationPrefsForm
- **Out of scope**: update/cancel notifikace (S07/S08), RSVP
  reminder (S13)
- **Dependencies**: S01, S02, S03 (deep-link musí vést někam)
- **Acceptance criteria**:
  - [ ] Nový event type v katalogu + i18n
  - [ ] CF trigger exportován z index.ts
  - [ ] Stáňa vytvoří event → manželka dostane push + inbox
  - [ ] Deep-link push → otevře `/event/:id`
  - [ ] Unit test recipient logic (actor excluded, min 1 recipient)
- **Size**: M
- **Demo**: Na dvou iPhone účtech: Stáňa vytvoří event s Marií →
  Marie dostane push "Stáňa tě pozval…"

### S05: RSVP "Můžu / Nemůžu" + reply notifikace

- **Goal**: Pozvaný v detailu potvrdí, autor dostane push.
- **Scope**:
  - Sub-collection `/events/{eventId}/rsvps/{uid}` s fieldy
    `response: "yes" | "no"`, `respondedAt`
  - Firestore rules: create/update/delete rsvp = self (uid ==
    request.auth.uid)
  - `src/lib/rsvp.ts` se `subscribeRsvps(eventId)`, `setRsvp(eventId,
    uid, response)`
  - V EventDetail komponentě: pokud jsem invitee a status UPCOMING,
    zobraz 2 buttons `[Můžu]` / `[Nemůžu]` (i18n
    `event.rsvp.yes/no`)
  - RSVP updatuje invitees list zobrazením barev (zelená ✓ / červená
    ✗ / šedá pending)
  - Autor vidí souhrn "2 potvrzeno z 3 pozvaných"
  - CF trigger `onRsvpWrite` (firestore.onDocumentWritten
    `/events/{eventId}/rsvps/{uid}`)
  - Pošle push + inbox autorovi (pokud response se změnil)
  - Nový event type `event_rsvp_response` v katalogu
- **Out of scope**: RSVP reminder (S13)
- **Dependencies**: S01, S03, S04
- **Acceptance criteria**:
  - [ ] RSVP subcollection rules pass
  - [ ] Invitee vidí buttony, klik ukládá RSVP
  - [ ] Autor vidí souhrn responses
  - [ ] CF trigger pošle notifikaci autorovi
  - [ ] Self-filter: autor sám pro sebe nedostane notifikaci (edge
    case pokud se pozve)
- **Size**: M
- **Demo**: Marie v detailu tapne Můžu → zelený ✓ u jejího avataru,
  Stáňa dostane push "Marie potvrdila".

### S06: ICS download per-event ("Přidat do kalendáře" button)

- **Goal**: Tap "Přidat do kalendáře" na detailu → iOS nabídne "Add
  to Calendar" prompt s jednorázovým eventem.
- **Scope**:
  - `npm install ics` ve `app/`
  - `src/lib/ics.ts` pure function `buildEventIcs(event, inviteeUsers)`
    vrátí string (RFC 5545)
  - Klíčové: `ATTENDEE` pole bez `PARTSTAT` (mitigace R1 — Apple
    nenabídne RSVP prompt)
  - `TZID:Europe/Prague` v všech DTSTART/DTEND
  - `METHOD:PUBLISH` (ne REQUEST — nechceme RSVP z Apple Calendar)
  - Detail button `[Přidat do kalendáře]` → generate blob → `<a
    download>` trigger
  - Pokud iOS Safari PWA standalone nedovoluje `<a download>`, fallback
    je zobrazit ICS string s "Kopíruj a přidej ručně"
  - Unit testy pro `buildEventIcs()` — snapshot ICS output
- **Out of scope**: webcal subscription (S11), RSVP via ICS reply (viz
  brief R1 — záměrně vypnuté)
- **Dependencies**: S01, S03
- **Acceptance criteria**:
  - [ ] `buildEventIcs()` testován (RFC 5545 compliant, testy snapshot)
  - [ ] Detail button existuje, klik generuje blob download
  - [ ] iOS Safari (ne PWA mode, normal tab): tap → iOS nabídne Add
    to Calendar, event se přidá
  - [ ] Apple Calendar NEnabídne RSVP tlačítka (PARTSTAT vypnutý)
  - [ ] Google Calendar import funguje (bonus test)
- **Size**: M
- **Demo**: Stáňa v detailu → "Přidat do kalendáře" → iOS prompt →
  event je v Apple Calendar.

---

## Phase 2 — Lifecycle management

Konečný cíl fáze: **Autor umí event upravit, zrušit, a po termínu
potvrdit že proběhl nebo nebyl.**

### S07: Edit event (author + cross-OWNER) + update notifikace

- **Goal**: Autor změní čas/popis/invitee, všichni pozvaní dostanou
  push + update v kalendáři (ale v Apple Calendar se to synchronizuje
  až po S11 webcal).
- **Scope**:
  - `[Upravit]` button v detail (visible pokud `canEditEvent` =
    reuse V17.1 `canEditTask` permissions logic, jen s events)
  - Edit flow: přepoužití `EventComposer` v edit mode (pre-fill +
    "Uložit změny")
  - `updateEvent()` v `src/lib/events.ts`
  - CF trigger `onEventUpdate` (firestore.onDocumentUpdated) detekuje
    změny `title`, `startAt`, `endAt`, `address`, `inviteeUids`,
    `description`, `isAllDay`
  - Nový event type `event_update` v katalogu
  - Pokud přibudou noví invitees → `event_invitation` (ne update) pro ně
  - Pokud ubudou invitees → `event_uninvited` pro ty (nebo jen
    "event zrušen pro tebe" copy)
- **Out of scope**: webcal sync (S11)
- **Dependencies**: S01, S03, S04 (notification pipeline pattern)
- **Acceptance criteria**:
  - [ ] Edit mode v composer, pre-fill data
  - [ ] Save → update Firestore + notifikace invitees
  - [ ] Cross-OWNER: druhý OWNER smí editovat první OWNER event
  - [ ] Unit test pro detekci fieldových změn (pure function)
- **Size**: L
- **Demo**: Stáňa změní čas ze 14:00 na 15:00, Marie + PM dostanou
  push "Stáňa posunul čas na 15:00".

### S08: Cancel event + notifikace

- **Goal**: Autor zruší event, status = `CANCELLED`, pozvaní dostanou
  push. V Apple Calendar zmizí (až po S11 webcal).
- **Scope**:
  - `[Zrušit]` button v detail (author only, status UPCOMING)
  - Confirm modal
  - `cancelEvent(eventId)` set status=CANCELLED, cancelledAt=now
  - CF trigger `onEventCancelled` (detekuje status change UPCOMING→
    CANCELLED)
  - Nový event type `event_cancelled` v katalogu
  - Push + inbox invitees "Stáňa zrušil {eventTitle}"
  - V UI: CANCELLED event má strike-through title, šedá barva
- **Out of scope**: retro cancellation z AWAITING (S10)
- **Dependencies**: S01, S03, S04
- **Acceptance criteria**:
  - [ ] Cancel button + confirm modal
  - [ ] Status flip UPCOMING → CANCELLED
  - [ ] Invitees dostanou push
  - [ ] UI vizualizuje CANCELLED (strike-through)
- **Size**: S
- **Demo**: Stáňa zruší event, Marie vidí v detailu "Zrušeno" +
  dostala push.

### S09: AWAITING_CONFIRMATION auto-transition

- **Goal**: Event jehož `endAt` uplynul a status je `UPCOMING`,
  automaticky přejde na `AWAITING_CONFIRMATION` (červený v UI).
- **Scope**:
  - Scheduled CF `onSchedule("every 1 hour")`:
    - Query events WHERE `endAt < now` AND `status == "UPCOMING"`
    - Update na `status = "AWAITING_CONFIRMATION"`
    - Batch do 200
  - UI v EventList: červená tečka na card pro AWAITING events
  - Červená banner "N událostí čeká na potvrzení" nahoře v listu
    (pokud ≥1 kde jsem autor)
  - Zatím žádná notifikace — autor to vidí až otevře app (V2 možná
    "připomeň potvrzení" push, ale out of scope V1)
- **Out of scope**: confirm flow (S10)
- **Dependencies**: S01
- **Acceptance criteria**:
  - [ ] Scheduled CF funguje, cron každou hodinu
  - [ ] Test (unit): pure function `findAwaitingEvents(allEvents,
    now)`
  - [ ] UI červená banner + červená tečka
- **Size**: S
- **Demo**: Po manuálním posunutí času v test DB: event přejde na
  červený, banner se zobrazí.

### S10: HAPPENED / CANCELLED retro confirm

- **Goal**: Autor v AWAITING_CONFIRMATION klikne "Proběhlo" nebo
  "Zrušilo se", event přejde do finální status.
- **Scope**:
  - Dvě tlačítka v detail (author + status=AWAITING_CONFIRMATION):
    `[Proběhlo]` → status=`HAPPENED`, happenedConfirmedAt=now
    `[Zrušilo se]` → status=`CANCELLED`, cancelledAt=now
  - UI po transition:
    - HAPPENED → zelený badge "Proběhlo"
    - CANCELLED (retro) → šedý badge "Zrušeno" (strike-through title)
  - Červená banner zmizí
  - Žádné notifikace (retro confirm je audit, invitees už to vědí)
- **Out of scope**: nic
- **Dependencies**: S09
- **Acceptance criteria**:
  - [ ] Dvě tlačítka visible jen pro autora + AWAITING status
  - [ ] Status flip funguje
  - [ ] UI vizualizuje HAPPENED vs CANCELLED rozdílně
- **Size**: S
- **Demo**: Event po termínu je červený, Stáňa klikne Proběhlo →
  zelený, banner pryč.

---

## Phase 3 — Webcal subscription (realtime sync do Apple Calendar)

Konečný cíl fáze: **Uživatel v Settings jednou klikne "Připojit", a od
té doby se všechny jeho události v Apple Calendar automaticky
synchronizují (změna v appce = změna v kalendáři do 15 min).**

### S11: Cloud Function HTTP endpoint `/cal/:uid/:token.ics`

- **Goal**: GET request na URL vrátí valid ICS s events pro uživatele.
- **Scope**:
  - `app/functions/src/cal/calendarSubscription.ts` — `onRequest`
    HTTP CF
  - URL pattern: `/cal/:uid/:token.ics` (path param via split nebo
    regex)
  - Validace: token in URL == `users/{uid}.calendarToken`
  - Query: events WHERE (`creatorUid == uid` OR `uid in inviteeUids`)
    AND `status ∈ {UPCOMING, AWAITING_CONFIRMATION, HAPPENED}`
  - Render ICS (reuse `buildEventIcs()` z S06, ale s multi-event
    VCALENDAR wrapper — adjust helper)
  - Response headers: `Content-Type: text/calendar; charset=utf-8`,
    `Cache-Control: max-age=0, must-revalidate`
  - Firebase Hosting rewrite v `firebase.json`: `"/cal/**" → CF
    "calendarSubscription"`
- **Out of scope**: UI v Settings (S12), scheduled reminder (S13)
- **Dependencies**: S01, S06 (ics builder)
- **Acceptance criteria**:
  - [ ] `curl https://{host}/cal/{uid}/{token}.ics` vrátí valid ICS
  - [ ] `curl` s bad token → 401
  - [ ] Unit test: `buildCalendarIcs(events, uid)` pure
  - [ ] CANCELLED events jsou odfiltrované (subscription je clean)
- **Size**: M
- **Demo**: Dev mašina curl → ICS output; Apple Calendar subscribe URL
  z devtools → events se objeví (bez UI zatím).

### S12: Settings "Kalendář" sekce + token management

- **Goal**: User v Settings klikne "Připojit" a napojí Apple Calendar.
  Umí token resetovat.
- **Scope**:
  - Rozšířit `users/{uid}` o `calendarToken: string` +
    `calendarTokenRotatedAt: timestamp` (generovat při prvním
    přihlášení / migrace pro existing users)
  - `src/lib/calendarToken.ts` — `generateCalendarToken(uid)`,
    `rotateCalendarToken(uid)` (přes CF admin call? nebo client write
    s rules?)
  - Rules: self-update `calendarToken` field OK (užvedu je diff
    pattern)
  - Migrace v `app/deploy/pending/YYYY-MM-DD-Vxx-calendar-tokens.mjs`
    — generuje token pro všechny existing users
  - Settings page: nová collapsible sekce "Kalendář" (reuse V16.3
    collapsible pattern)
  - Sekce obsahuje:
    - Status indicator (UI jen "Připojeno" vs "Nepřipojeno" — track
      explicit v users/{uid}.calendarConnected bool?)
    - `[Připojit do Apple Calendar]` → `<a href="webcal://...">`
    - Collapsible "Detaily" s URL copy
    - `[Resetovat kalendář token]` s confirm modal
    - Auto-notifikace po reset (`event_calendar_token_reset` event
      type — toto je meta notifikace, catalog entry)
- **Out of scope**: reminder CF (S13)
- **Dependencies**: S11
- **Acceptance criteria**:
  - [ ] Existing users mají vygenerované tokeny (migrace)
  - [ ] Settings sekce + UI layout
  - [ ] webcal:// link klik na iPhone → iOS prompt → subscribe
  - [ ] Reset token → push notifikace user "Token resetován…"
  - [ ] Rules pass: self-update calendarToken field
- **Size**: L
- **Demo**: Stáňa v Settings → "Připojit" → Apple Calendar subscribe
  → events se objeví do 15 min.

### S13: RSVP reminder 24h před eventem

- **Goal**: Invitees, kteří ještě nepotvrdili do 24h před eventem,
  dostanou push "Zítra máš schůzku X, odpověz prosím".
- **Scope**:
  - Scheduled CF `onSchedule("every 1 hour")`:
    - Query events WHERE `startAt in [now+23h, now+25h]`
    - Pro každý event: find invitees bez rsvp record
    - Pošli push + inbox `event_rsvp_reminder` každému
  - Nový event type v katalogu
  - Dedupe: flag `reminderSent: true` na /events/{id}/rsvps/{uid}
    pending doc? Nebo separate /events/{id}.reminderSentAt? Jednodušší
    per-event flag (all-or-nothing) — pokud user nepotvrdil, dostane
    reminder jednou.
- **Out of scope**: connaught reminder "za 1 hodinu máš schůzku" (V2)
- **Dependencies**: S05 (RSVP data)
- **Acceptance criteria**:
  - [ ] Scheduled CF funguje
  - [ ] Unit test: `findEventsNeedingReminder(events, now)` pure
  - [ ] Test: invitee s RSVP response reminder nedostane
  - [ ] Test: reminder se pošle max 1x per event per invitee
- **Size**: M
- **Demo**: Test scénář: event zítra 14:00, Marie nepotvrdila →
  dostane push "Zítra máš schůzku…"

---

## Phase 4 — Polish, edge cases, hardening

### S14: E2E test flow na reálném iPhone

- **Goal**: Ověřit end-to-end že všechno funguje v real-world iOS
  PWA setting.
- **Scope**:
  - Test scénář (dokumentovaný v `.design/events/E2E_RESULTS.md`):
    1. Nainstaluj PWA na iPhone (Add to Home Screen)
    2. V Settings připoj kalendář (subscribe webcal://)
    3. Vytvoř event, pozvi druhý account
    4. Ověř že druhý account dostane push + inbox
    5. Druhý account klikne Můžu → první dostane push + vidí ✓
    6. Edit event (změna času) → ověř push + update v Apple Calendar
    7. Download ICS per-event → ověř že Apple Calendar otevře prompt
    8. Cancel event → ověř push + event zmizí z Apple Calendar
    9. Event po termínu → červený + autor potvrdí Proběhlo
  - Min. iOS 17 a 18 (dle zařízení co user má)
  - Výsledky → dokument s screenshots a issues
- **Dependencies**: S01–S13
- **Acceptance criteria**:
  - [ ] Všech 9 kroků proběhne bez errors
  - [ ] Apple Calendar zobrazí event do 15 min po vytvoření
  - [ ] Update v appce se projeví v Apple Calendar (do 15 min)
  - [ ] Cancel v appce event odstraní z Apple Calendar
  - [ ] Dokument `.design/events/E2E_RESULTS.md` obsahuje log +
    případné workaroundy
- **Size**: M (převážně ověřování, málo kódu)
- **Demo**: Dokument s checklistem, Stáňa + manželka + PM testují.

### S15: Link event ↔ task (volitelný field)

- **Goal**: V composer je volitelný picker "Propojit s úkolem". V
  detail se zobrazí "Propojeno s úkolem: {taskTitle}".
- **Scope**:
  - `linkedTaskId?: string | null` field už je ve schemátu S01
  - V composer: autocomplete picker ze zřetelných tasků
    (createdBy==me OR assigneeUid==me, top 20 podle updatedAt)
  - V detail: pokud linkedTaskId, render chip "Propojeno s úkolem:
    {title}" → klik naviguje na `/t/:taskId`
  - Na task detail pattern → najde related event? (optional — může
    být jen jednosměrný link pro V1)
- **Out of scope**: bidirectional link (obousměrná navigace)
- **Dependencies**: S02, S03
- **Acceptance criteria**:
  - [ ] Picker v composer
  - [ ] Detail zobrazuje link
  - [ ] Klik na link naviguje na `/t/:id`
- **Size**: S
- **Demo**: Event "schůzka s PM" má linked úkol "Zkontrolovat rozvody",
  detail zobrazí chip.

### S16: Notification preferences pro event events

- **Goal**: V Settings → Notifikace user může vypnout jednotlivé
  event notifikační toggles.
- **Scope**:
  - Rozšíření `NotificationPrefsForm` o 5 nových event types:
    `event_invitation`, `event_update`, `event_cancelled`,
    `event_rsvp_response`, `event_rsvp_reminder`
  - `DEFAULT_PREFS` (lib/notifications.ts) rozšířit
  - i18n popisky v `cs.json` (`notifikace.events.event_invitation`
    atd.)
  - Ikony v `EVENT_ICONS` dictionary (`Calendar`, `CalendarClock`,
    `CalendarX`, `Check`, `Bell`)
- **Dependencies**: S04, S05, S07, S08, S13
- **Acceptance criteria**:
  - [ ] Settings zobrazuje nové toggles
  - [ ] Vypnutí zabraní doručení (test unit pro
    `applyNotificationPrefs()`)
- **Size**: S
- **Demo**: Vypni "Připomenutí RSVP" → zítrejší event reminder nedorazí.

### S17: Design review pass

- **Goal**: Spustit `/design-review` skill na live build, zachytit
  all-issues a rozdělit do follow-up slices.
- **Scope**:
  - Run skill, save `DESIGN_REVIEW.md`
  - Pro každý finding s severity high/medium: nový slice v backlogu
- **Dependencies**: S01–S14
- **Acceptance criteria**:
  - [ ] `.design/events/DESIGN_REVIEW.md` existuje
  - [ ] Follow-up slices vytvořeny pro severity ≥ medium
- **Size**: S (skill běží sám, hodně review)
- **Demo**: Markdown s findings.

### S18: Performance + cleanup check

- **Goal**: Ověřit že list se škáluje, ICS subscription nezahlcuje
  Firebase Functions billing, cron CF nejsou greedy.
- **Scope**:
  - Test: 100+ events v Firestore, list se stále renderuje pod 100ms
  - Test: scheduled CF per hour = 720/měsíc = v rámci free tier
  - Test: webcal endpoint hit rate (Apple Calendar fetch every 15min
    = 96/den/user = ~3000/měsíc/user = also v free tier)
- **Dependencies**: S14
- **Acceptance criteria**:
  - [ ] List perf test
  - [ ] CF billing estimate pod 10 $/měsíc pro 10 users
- **Size**: S
- **Demo**: Report.

---

## Out-of-phase backlog

Věci co vyplynuly z discovery/brief ale nejsou v V1:

- **Grid calendar view** v appce (měsíc/týden) — V2
- **Google Calendar explicit testing** (currently jen Apple-first,
  Google bonus) — V2
- **Multi-day events** — V2
- **Recurring events** (RRULE) — V2
- **External invitees** (email-only pozvaný mimo app users) — V2
- **RSVP "Maybe" 3. stav** — V2
- **Past events archive / cleanup** (např. delete events starší
  12 měsíců) — V2+
- **Natural language input** ("schůzka zítra ve 3") — V2+
- **Conflict detection** ("máš už event ve stejný čas") — V2+

---

## Risks & mitigations

Přeneseno z DESIGN_BRIEF §9, aktualizace dle slicing:

**R1 — RSVP divergence (critical)** — řešíme v S06 (ICS bez PARTSTAT)
a S11 (subscription taky bez PARTSTAT). Mitigace: testovat v S14 na
reálném iPhone že Apple Calendar nenabízí RSVP prompt.

**R2 — Token v webcal URL úniku** — mitigace v S12 (reset token
tlačítko + auto-notifikace). Trade-off: user musí reset dělat
manuálně.

**R3 — iOS PWA quirks** — zcela pokryto S14. Pokud E2E flow selže,
vrhnout follow-up slice(s) pro fallback (např. "copy URL + add
manually" modal).

**Nový R4 odhalen slicingem:**

**R4 — Scheduled CF billing** — S09 (AWAITING transition) + S13 (RSVP
reminder) běží každou hodinu. S18 ověří že to je v rámci free tier. Pokud
scale roste (>100 events/user), zvážit posunout na daily cron s
batchem.

**R5 — Migrace kalendář tokenů pro existing users** — S12 vyžaduje
migraci. Řešíme přes existující `deploy/pending/` pattern (V17.10).
Idempotentní skript vygeneruje token pro každý user bez tokenu.
