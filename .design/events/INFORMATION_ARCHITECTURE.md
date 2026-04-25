# Events — Information Architecture

**Konvence:** kód (routes, types, field names, storage keys, component
names, i18n keys) je **anglicky**. UI texty, které vidí uživatel, jsou
**česky** přes `t()` funkci z `src/i18n/cs.json`. Komentáře v kódu smí
být česky.

Existující routes v appce (`/zaznamy`, `/ukoly`, `/novy`, `/t/:id`,
`/nastaveni`, …) zůstávají česky — to je dědictví, neměníme. Nová
feature jde anglicky.

## 1. Sitemap

```
/                           (auth, mobile-first PWA)
│
├── /events                       ← NEW — events list
│   └── /events/new               ← NEW — new event composer
│
├── /event/:id                    ← NEW — event detail
│
├── /settings                     ← (note: existující route je
│                                    /nastaveni — ale pro novou
│                                    feature přidávám anglickou
│                                    variantu sekce v /nastaveni
│                                    s anchorem #calendar)
│
└── /cal/:uid/:token.ics          ← NEW — server-side endpoint
                                    (Cloud Function HTTP; Apple
                                    Calendar subscription fetchuje
                                    sem)
```

**Krátké cesty:** `/event/:id` paralelí s `/t/:id` (task detail).
`/events` list, `/event/:id` detail — anglický ekvivalent k
`/zaznamy` / `/t/:id` mapping.

**Settings**: stávající route je `/nastaveni` (česky, nerouškujeme).
Přidáváme **novou sekci** s i18n key `settings.calendar` a anchor
`/nastaveni#calendar`.

**Role gating**: všechny routes `auth-gated`. `/cal/:uid/:token.ics`
je veřejně dostupný s token-based autentizací.

## 2. Primary navigation

Header appky se rozšiřuje o **ikonu kalendáře** vedle zvonku
notifikací:

```
┌───────────────────────────────────────────┐
│ [≡]   Chytrý dům         [📅] [🔔] [👤]    │
└───────────────────────────────────────────┘
                           │    │    │
                      Events   │    └── Settings
                          Notifications
```

- **📅 ikona** → `/events`. Badge: počet upcoming events do 7 dní
  (červená bubble, pokud > 0).
- **🔔 zvonek** → notifikace dropdown (bez změny z V16.9).
- **👤 profil** → `/nastaveni`.

Bottom nav (Záznamy / Úkoly / + / Přehled / Nastavení) **beze změny**.

**Mobile**: 44×44 px tap, 8 px gap, badge `99+` cap.

## 3. User flows (top 3)

### Flow A — Create event (primární)

1. User tapne 📅 ikonu v headeru
2. → `/events` — list (upcoming nahoře)
3. Tap FAB "+" dole vpravo
4. → `/events/new` — formulář
5. Vyplní: title, startAt, endAt (default +1h), optional description,
   address, isAllDay toggle; invitees (min. 1 z users appky)
6. Tap `[Uložit]`
7. → `/event/:id` (status `UPCOMING`)
8. **Side effect**: CF `onEventCreate` pošle push + inbox notifikaci
   každému inviteeovi ("Stáňa tě pozval: …")

**Error branches:**
- Missing title → disabled Save
- `endAt <= startAt` → inline error pod endAt pickerem
- `invitees.length === 0` → disabled Save
- Firestore write fail → toast "Nepodařilo se uložit"; local draft se
  drží v `localStorage["draft:event:new"]`

### Flow B — RSVP (pozvaný odpovídá)

1. Push notifikace "Stáňa tě pozval: Elektrikář rozvaděč, 14. 5. 14:00"
2. Tap → deep-link `/event/:id`
3. Vidí detail; dole tlačítka `[Můžu]` / `[Nemůžu]` (i18n:
   `event.rsvp.yes` / `event.rsvp.no`)
4. Tap `[Můžu]` → optimistic UI, Firestore write `rsvp: "yes"`
5. **Side effect**: CF `onRsvpWrite` → autor dostane push + inbox
   "Marie potvrdila účast"

**Error branches:**
- Offline → reject (online-only per brief); toast "Potvrď až budeš
  online"
- Event smazán mezitím → redirect `/events` s toastem "Událost byla
  smazána"

### Flow C — Connect calendar (první setup)

1. User otevře `/nastaveni` → scroll na sekci "Kalendář"
2. Status "Nepřipojeno" + tlačítko `[Připojit do Apple Calendar]`
3. Tap → iOS Safari otevře `webcal://...firebaseapp.com/cal/{uid}/{token}.ics`
4. iOS prompt "Přidat kalendář?" → user tapne "Přidat"
5. Apple Calendar → Account → subscribed kalendář "Chytrý dům –
   Události"
6. **Do 15 min**: events se objeví v nativním Apple Calendar
7. V appce se status mění na "Připojeno"

**Error branches:**
- iOS subscription deep-link nefunguje v PWA standalone → fallback
  modal "Zkopíruj URL a přidej ručně v Apple Calendar"
- Token reset v Settings → warning modal → nový token se vygeneruje,
  starý vrátí HTTP 401; user musí flow opakovat

## 4. Page blueprints

### `/events` — Events list

- **Purpose**: Chronologický list events, kde jsem autor nebo pozvaný.
- **Primary action**: Tap na kartu → `/event/:id`.
- **Secondary**: FAB `[+]` = nová událost; filter toggle
  `[Nadcházející] / [Historie]`.

**Content blocks:**
1. Page header: UI "Události" + podtitul "N nadcházejících"
2. Filter pills: `upcoming` (default) / `past` (URL query
   `?filter=past`)
3. **AWAITING_CONFIRMATION banner**: pokud existuje ≥1 event, kde
   jsem autor a status je `AWAITING_CONFIRMATION`, červená banner
   "1 událost čeká na potvrzení"
4. Event cards:
   - Datetime (big levá strana: "PÁ 14. 5. • 14:00–16:00")
   - Title
   - Status badge (barevný dot: modrá UPCOMING / červená AWAITING
     / zelená HAPPENED / šedá CANCELLED)
   - Počet invitees (ikona + číslo)
   - Address (truncated 1 řádek, pokud je)
5. Empty state: ilustrace + "Zatím žádné události. Přidej první přes +"
6. FAB `[+]` dole vpravo (i18n `event.list.addCta` = "Nová událost")

**Data dependencies:**
- `useEvents()` hook → `onSnapshot` na `events` WHERE
  `creatorUid == me` OR `me in inviteeUids` ORDER BY `startAt ASC`
- `useUsers()` pro resolve invitee names

**States:** loading (3 skeleton cards), empty (CTA), error (retry).

### `/events/new` — Event composer

- **Purpose**: Formulář pro vytvoření eventu.
- **Primary action**: `[Uložit]` (i18n `event.composer.save`).
- **Secondary**: `[X]` close s confirm modal pokud má draft data.

**Content blocks:**
1. Header: `[X]` close • "Nová událost" • (empty right)
2. `titleInput` (textarea auto-grow, placeholder "Elektrikář —
   rozvaděč")
3. `startAtInput` (`<input type="datetime-local">`, iOS native picker)
4. `endAtInput` (default = `startAt + 1h`, auto-update pokud user změní
   startAt na hodnotu ≥ endAt)
5. `isAllDayToggle` (když ON, skryje čas v oba pickery)
6. `addressInput` (text, volitelný)
7. `descriptionTextarea` (markdown hint, volitelný)
8. `inviteePicker` — multi-select z users (min. 1 mimo autora)
9. `linkedTaskId` — volitelný picker (search tasky autor / assignee)
10. `[Uložit]` primary button — disabled dokud nejsou splněny
    validace

**Draft persistence:** `localStorage["draft:event:new"]` JSON snapshot
form state. Clear po successful save nebo explicit X close +
confirm.

### `/event/:id` — Event detail

- **Purpose**: Zobrazit event, role-dependent akce.
- **Primary action** (dle role + stavu):
  - Invitee + `UPCOMING`: `[Můžu]` / `[Nemůžu]`
  - Author + `UPCOMING`: `[Upravit]` / `[Zrušit]`
  - Author + `AWAITING_CONFIRMATION`: `[Proběhlo]` / `[Zrušilo se]`
  - Kdokoli + `HAPPENED` nebo `CANCELLED`: read-only
- **Secondary**: `[Přidat do kalendáře]` (jednorázový ICS download),
  `[←]` back.

**Content blocks:**
1. Header: `[←]` back • `[🗑]` delete (jen autor)
2. Velký datetime display (big accent font):
   - `ÚT 14. KVĚTNA 2026`
   - `14:00 – 16:00`
   - Nebo: `CELÝ DEN` pokud `isAllDay`
3. Status badge (skryté pokud `UPCOMING`):
   - `AWAITING_CONFIRMATION` — červená "Čeká na potvrzení"
   - `HAPPENED` — zelená "Proběhlo"
   - `CANCELLED` — šedá "Zrušeno" (title má strike-through)
4. Title (h1)
5. Address (ikona + text, pokud je)
6. Invitees list (avatary s RSVP ikonkou):
   - ✅ "yes" (zelená)
   - ❌ "no" (červená)
   - ⚪ pending (šedá)
7. Description (markdown render, pokud je)
8. Meta: "Vytvořil {actor} • {před 2 hod}" + optional
   "Propojeno s úkolem: {taskTitle}"
9. Actions bar (role-dependent, viz výš)
10. `[Přidat do kalendáře]` (ICS download) — vedlejší link

**Data:** `useEvent(id)` + `useUsers()` + `useAuth()`.

**States:** loading (skeleton), not found ("Událost neexistuje"),
error.

### `/nastaveni#calendar` — rozšíření Settings

Nová collapsible sekce přidaná do existující Settings page (layout
dědí V16.3 collapsible pattern).

**Content blocks:**
1. Section title: i18n `settings.calendar` = "Kalendář"
2. Status indicator: "🟢 Připojeno" / "⚪ Nepřipojeno"
3. Description: "Propoj aplikaci se svým Apple Calendar a uvidíš
   všechny události tam. Změny se synchronizují automaticky."
4. Primary button: `[Připojit do Apple Calendar]` — opens
   `webcal://...` URL
5. Pokročilé (collapsible "Detaily"):
   - URL (zobrazená mono font + `[Kopírovat]` button)
   - "Token vytvořen {date}. URL obsahuje unikátní token —
     nesdílej ho."
6. Destruktivní: `[Resetovat kalendář token]`
   - Confirm modal "Po resetu přestane Apple Calendar fungovat…"
   - Post-reset: push notifikace "Tvůj kalendář token byl resetován,
     přepoj Apple Calendar" (inbox + push)

### `/cal/:uid/:token.ics` — HTTP Cloud Function endpoint

- **Method**: GET
- **URL**: `https://{projectId}.cloudfunctions.net/cal/{uid}/{token}.ics`
  (nebo přes Firebase Hosting rewrite `/cal/:uid/:token.ics`)
- **Auth**: token v URL musí matchovat
  `users/{uid}.calendarToken`.
- **Response**: `Content-Type: text/calendar; charset=utf-8`, body =
  ICS (RFC 5545). Obsahuje events, kde `uid` je author nebo invitee
  A `status ∈ {UPCOMING, AWAITING_CONFIRMATION, HAPPENED}` (cancelled
  se odfiltrují → v Apple Calendar zmizí).
- **Cache**: `Cache-Control: max-age=0, must-revalidate`.
- **Errors**:
  - 401 pokud token nematchuje
  - 404 pokud `uid` neexistuje

## 5. Content inventory

| Type | Fields | Source | Owner |
|------|--------|--------|-------|
| **Event** | `id`, `title`, `description?`, `startAt`, `endAt`, `isAllDay`, `address?`, `inviteeUids[]`, `creatorUid`, `authorRole`, `status`, `linkedTaskId?`, `createdAt`, `updatedAt`, `happenedConfirmedAt?`, `cancelledAt?` | `/events/{eventId}` | Author + cross-OWNER |
| **Rsvp response** | `response: "yes" \| "no"`, `respondedAt` | `/events/{eventId}/rsvps/{uid}` | Každý user self-edit svého |
| **Calendar token** | `calendarToken: string`, `calendarTokenRotatedAt: timestamp` | `/users/{uid}` (inline fields) | User sám (rotate) |
| **Inbox notification** (rozšíření V16.7 katalogu) | eventType ∈ `event_invitation` / `event_update` / `event_cancel` / `event_rsvp_reminder` / `event_rsvp_response` / `event_happened_prompt` | `/users/{uid}/notifications/{id}` | Cloud Function |

## 6. URL & state model

**Routes:**
- `/events` — list (query `?filter=upcoming|past`, default upcoming)
- `/events/new` — composer
- `/event/:id` — detail (deep-linkable z push, ICS, e-mailu)
- `/nastaveni` (existing Czech route) s anchor `#calendar`

**State rozdělení:**
- **URL**: filter v `/events` query (`?filter=past`), eventId v detailu
- **Server state**: Firestore `onSnapshot` přes React hooks
  (`useEvents`, `useEvent(id)`, `useRsvp(eventId, uid)`)
- **Local state**: composer draft v `localStorage["draft:event:new"]`
- **Session state**: Settings "Kalendář" collapsible expand
  v `sessionStorage["settings:calendar:expanded"]`

**Deep-linkability:**
- ✅ `/event/:id` — notifikace, ICS metadata, e-mail
- ✅ `/events?filter=past`
- ❌ `/events/new` — transient (pokud draft je v localStorage, auto
  reopen po refreshi)

## 7. Navigation patterns

**Breadcrumbs:** none. Max 2 levely (list → detail).

**Back behavior:**
- iOS swipe-back: native React Router support
- Header `[←]`: `navigate(-1)` fallback na parent route

**Persistence:**
- Filter `/events?filter=...`: URL query je source of truth
- Composer draft: `localStorage` (clear po save / explicit close)
- Settings section expand: `sessionStorage`

## 8. Open structural questions

- [ ] **Kalendář ikonu do bottom nav jako 5. tab?** Hypotéza: ne
  (low-frequency, header ikona stačí).
- [ ] **Filter "Moje / Všechny"** (z `/ukoly`)? Events, kde jsem
  pozvaný ale ne autor vs. kde jsem autor. V1: jeden list bez filtru.
- [ ] **Link na task v composer** — autocomplete z všech tasků vs.
  top 20 podle `updatedAt`. Design-brief říká "volitelné", tedy
  implementujeme jednodušší variantu (top 20 nedávných mých).
- [ ] **Apple Calendar — zobrazit CANCELLED?** V ICS je filtrujeme
  pryč (subscription je clean). V appce zůstávají v historii.
- [ ] **Multi-day events** — `14.–28. května`. V1 asi jen 1-day;
  multi-day = out of scope per brief (přichází s recurring v V2).
- [ ] **Webcal deep-link z iOS Safari PWA standalone** — není zaručeno
  že `<a href="webcal://">` funguje; fallback je "copy URL + add
  manually". E2E test řeší.
