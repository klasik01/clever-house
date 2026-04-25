# Události (Events) — Discovery

_Stress-test discovery z grill-me sezení. Sepsáno 2026-04-24._

**Konvence:** kód (routes, types, fields, storage keys, component
names, i18n keys) je **anglicky**. UI texty vidí uživatel **česky**
přes `t()`. Existující české routes (`/zaznamy`, `/ukoly`, `/t/:id`)
jsou dědictví, neměníme.

---

## TL;DR

**Problem Statement.** Účastníci stavby domu potřebují jednotné místo
pro plánování **konkrétních událostí s pevným datem a časem** (schůzka
s PM, návštěva řemeslníka, termín kolaudace), kde lze pozvat ostatní
uživatele aplikace a mít tyto události **automaticky synchronizované do
osobního iOS kalendáře**. Dnes se termíny vyměňují ad-hoc v SMS/WhatsApp
a každý si je ručně přidává do Apple Calendaru — krok navíc a riziko
zapomenutí.

**Primary User.** Každý přihlášený uživatel aplikace (dnes OWNER +
PROJECT_MANAGER), iPhone primárně, Apple Calendar v pozadí.

**Success Metric.** 0 událostí zmeškaných kvůli neinformovanosti +
každá změna v appce se propíše do kalendářů všech pozvaných v řádech
minut (automatická webcal subscription).

**Top 3 Risks.**
1. **RSVP divergence** mezi appkou a Apple Calendar. Řešeno: vypnutím
   `PARTSTAT` v ICS (ATTENDEE bez akce) → Apple nenabízí RSVP dialog,
   appka je single source of truth.
2. **Token v webcal URL úniku.** Řešeno: tlačítkem Reset v Settings
   + automatickou notifikací při resetu (user ví, že musí kalendář
   přenapojit).
3. **iOS PWA quirks** při ICS download + webcal:// subscribe napříč
   verzemi iOS. Mitigace: end-to-end test flow (create → subscribe →
   update → cancel) na reálném iPhone před launch.

---

## 1. Problem & outcome

**a) Jaký problém to řeší:** Událost ≠ úkol. Úkol má
**flexibilní deadline** („nejpozději 15.5."), událost má **konkrétní
moment v čase** („9. května 2026, 14:00, příjezd elektrikáře").
Potřebujeme samostatnou entitu která se propíše do systémového
kalendáře telefonu a informuje všechny účastníky o změnách.

**b) Pro koho:** Uživatelé aplikace — dnes OWNER (Stáňa + manželka) +
PROJECT_MANAGER. V budoucnu další role (out of scope V1).

**c) Success po 90 dnech:** 0 událostí kde někdo „nepřišel protože
o tom nevěděl" + každá změna viditelná v iOS kalendáři (subscription
drží realtime).

**d) Cost nedělat tohle:** Nová feature, neexistuje baseline. Motivace
preventivní — projekt pokračuje, schůzek s řemeslníky bude přibývat.

## 2. Users & jobs-to-be-done

**Primary use case V1:** Schůzka **OWNER + OWNER + PM** na stavbě
(pevný čas, pevné místo, 3 účastníci).

**Secondary:** Informativní „přijede řemeslník/dodávka materiálu" —
uživatelé appky vědí kdy kdo má být doma / na stavbě.

**Recurring:** ❌ V1 neřešíme. Jen one-off events.

**RSVP:** ✅ V1 — pozvaný potvrzuje **2 stavy** („Můžu" / „Nemůžu").
Odpovědi vidí **jen autor**. Automatickou akci nad RSVP nezavádíme —
autor sám rozhoduje (přeplánovat = update eventu, zrušit = ICS CANCEL
propaguje do kalendářů).

**Baseline dnes:** Apple Calendar ručně + SMS/WhatsApp. Replacement
stejné interakce, jen bez ručního krokování.

**Invitee scope:** Pouze uživatelé appky. Žádné externí kontakty
(řemeslníci, architekt, …). Out of scope.

## 3. Scope & non-goals

**Event fieldy:**
- ✅ Název (povinný)
- ⚪ Popis (volitelný, markdown)
- ✅ Začátek (datetime, povinný)
- ✅ Konec (datetime, povinný)
- ⚪ Celodenní toggle (eliminuje čas, jen datum)
- ⚪ Adresa (volitelná, free-text)
- ✅ Pozvaní (min. 1 mimo autora, multi-select z users appky)

**Default trvání:** pokud user neuvede konec, fill +1 hod.

**Solo events:** ❌ (min. 1 pozvaný).

**UI umístění:**
- Samostatná stránka `/events` (list view, nadcházející nahoře)
- Ikona kalendáře v headeru vedle zvonku notifikací
- Detail events kopíruje layout TaskDetail (header back, title, meta,
  popis, akce)

**Integrace s tasky:** Volitelný link event → task (ne povinně).

**Non-goals V1:**
- ❌ Grid calendar view v appce (měsíc/týden)
- ❌ Google Calendar / Outlook **explicit** support (primárně Apple;
  `ics` balík zajistí RFC 5545 compliance pro oba)
- ❌ Attachments na events (fotky, odkazy)
- ❌ Recurring events (RRULE)
- ❌ Externí kontakty (mimo appku)
- ❌ Past events archive (zůstávají navždy v Firestore)
- ❌ Konflikty („máš už něco ve stejný čas")

**Cut 50% timeline:** neřešeno explicitně. Hobby tempo, žádný hard cut.

## 4. Constraints

- **Deadline:** žádný hard.
- **ICS generování:** npm balík `ics` (~400 kB).
- **Delivery:** webcal:// subscription URL per-user (jedna URL →
  všechny moje events, auto-sync) + paralelně **download ICS**
  per-event (jednorázový share button na detail eventu).
- **Token bezpečnost:** perm token, revoke+regenerate v Settings.
- **Timezone:** Europe/Prague fixní (TZID v ICS).
- **Čas:** hobby, žádný kompromis na polishi.

## 5. Content & data

**Baseline:** Apple Calendar ručně. **Žádný import** existujících
events.

**Firestore schema:**
- Kolekce `/events/{eventId}` (top-level).
- Povinné fieldy: `title`, `startAt`, `endAt`, `inviteeUids[]` (min. 1),
  `createdBy`, `authorRole` (V17.1 snapshot), `status`, `createdAt`,
  `updatedAt`.
- Volitelné: `description`, `isAllDay`, `address`, `linkedTaskId`.
- Subkolekce `/events/{eventId}/rsvp/{uid}` nebo inline `rsvpResponses:
  Record<uid, "yes" | "no">` (TBD v design-brief).

**Lifecycle (status):**
- `UPCOMING` — vytvořen, termín nadchází
- `CANCELLED` — autor zrušil před termínem (ICS CANCEL propaguje)
- `AWAITING_CONFIRMATION` — uplynul termín, autor ještě nepotvrdil
  (červená v UI, vidí všichni pozvaní + autor)
- `HAPPENED` — autor potvrdil „proběhl"
- `CANCELLED` (retro) — autor zpětně zrušil po termínu

**Kdo potvrzuje:** autor. Červená zůstává dokud autor neklikne.
Auto-expire se neřeší.

**Historie:** Zůstává v Firestore navždy. UI zobrazuje (schované pod
filter „proběhlé").

**Permissions** (dědí z V17.1 modelu):
- Autor vždy edit + delete.
- Cross-OWNER: OWNER autor → jiný OWNER smí editovat (sdílený
  household); PM autor → jen on sám.
- Delete: pouze autor.

## 6. Context of use

**Device mix:**
- Primárně iPhone mobilní (Stáňa + manželka).
- PM: iPhone / Android (Android fallback — ICS standard, mělo by
  fungovat v Google Calendar).
- Desktop čtení občas (manželka na notebooku večer).

**Offline:** Online-only pro vytvoření events. Read cached (Firestore
offline persistence drží).

**Notifikace** (stávající V15.x pipeline, nový event-scope katalog):
- **Invitation** (byl jsi pozván) → inbox + push
- **Update** (změnil se čas / místo / popis / pozvaní) → inbox + push
- **Cancel** → inbox + push
- **RSVP reminder** — 24h před eventem, pokud pozvaný nepotvrdil →
  inbox + push
- **iOS VALARM** — připomínku před eventem si řeší Apple Calendar
  sám (z ICS)

## 7. Tone, brand, aesthetic

**Visual status colors** (návrh, finalizace v design-brief):
- `UPCOMING` — neutrální (`text-ink`, žádná akční barva)
- `AWAITING_CONFIRMATION` — červená (status-danger token)
- `HAPPENED` — zelená (status-success) nebo šedá (nerušit)
- `CANCELLED` — přeškrtnutý text + šedá

**Ikona sekce:** `Calendar` (lucide-react).

**Layout detail:** Kopíruje TaskDetail (header back, title textarea,
meta chips, body rich text, akce dole).

## 8. Competitors & references

**Apple Calendar** (baseline). Co mimicujeme:
- Rychlé přidání události (3 klepnutí: datum → čas → název → hotovo).
- Natural datetime pickery (iOS scroll wheels).
- Invitee picker.
- Česky lokalizované datum/čas.

**Google Calendar** (sekundární, protože „používají všichni okolo"):
- Musí fungovat subscription URL i v Google — ICS standard, balík
  `ics` toto zvládne. Testovat.

**Unique pro naši appku** (co Apple/Google nemá):
- „Proběhl / nakonec nezproběhl" retrospective confirmation (autor
  po termínu potvrzuje stav).
- Organizátor vidí **tabulku RSVP** (Apple ukazuje jen tvoji vlastní
  odpověď, ne ostatních).
- Kontext projektu (event ↔ task link).

## 9. Risks & unknowns

**R1 — RSVP divergence (critical):**
Apple Calendar nabízí pozvanému RSVP dialog („Yes / No / Maybe")
přímo v systému. Pokud Marie klikne „No" v Apple Calendar, Apple pošle
reply e-mail — **appka to nevidí**. Tedy v appce autor vidí „Marie
ještě neodpověděla", ale reálně už odhlásila.

**Řešení: varianta A.** Appka je single source of truth. V ICS
**vypneme `PARTSTAT`** atributu u `ATTENDEE` polí — Apple Calendar pak
nenabízí RSVP prompt. RSVP se dělá **v appce** přes deep-link
notifikaci.

Trade-off: Pozvaný musí otevřít appku pro RSVP, nemůže odpovědět
z kalendáře. Uživatelé to asi akceptují protože appku používají denně.

**R2 — Token v webcal URL úniku:**
webcal URL obsahuje perm token. Pokud unikne (screenshot, sdílený
přístroj), kdokoliv s linkem čte všechny budoucí plány.

**Řešení:** Tlačítko „Reset calendar token" v Settings → vygeneruje
nový token, starý přestane fungovat. **Auto-notifikace** (push +
inbox) při resetu, aby user věděl že musí Apple Calendar subscription
obnovit.

**R3 — iOS PWA quirks:**
Safari PWA standalone mode má specifická omezení pro `<a download>`
a webcal:// protocol handling. Testovat na reálném iPhone (min. iOS
16.4+, v ideálním případě i 17 a 18).

**Mitigace:** End-to-end test flow před launch:
1. Vytvořit event v appce
2. Otevřít Settings → „Připojit kalendář" → webcal URL
3. iPhone prompt → Add subscription
4. Ověřit: event se objeví v Apple Calendar do 15 min
5. Update event v appce → Apple Calendar refresh → změna vidí
6. Cancel event v appce → Apple Calendar odstraní

Dokud tento flow netřeba-click-by-click nepracuje, V1 nelze shippovat.

**R4 — Secondary risks:**
- Cross-OWNER edit flow na events (kopíruje V17.1 pravidla, OK).
- Notifikační copy pro invitation / update / cancel / RSVP reminder —
  musí být jasné a nepřetížit uživatele. Design-brief to vyřeší.
- iOS Safari download limit (blob URL — 500 MB max, naše ICS <1 KB).

---

## Unanswered / deferred

**[UNANSWERED]** Frequency eventů (blok 2a) — user neodhadl kolik
events za měsíc / za rok. Předpoklad pro MVP: low-volume (<10/měsíc),
takže UX není stress-tested na „kalendář plný 200 events".

**[UNANSWERED]** Cut 50% scenario (blok 3e) — co by user vyhodil
pokud se seklo 50% času. Předpoklad: hobby tempo, žádný cut.

**[DEFERRED]** Grid calendar view v appce — explicitně out of scope
V1, přichází v úvahu v V2.

**[DEFERRED]** RSVP "Možná" třetí stav — V1 jen 2 stavy. Může se přidat.

**[DEFERRED]** Externí kontakty (řemeslník získá e-mail s ICS) — V2.
