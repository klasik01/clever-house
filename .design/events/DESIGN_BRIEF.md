# Události — Design Brief

**Date**: 2026-04-24
**Author**: Stanislav Kasika
**Status**: Draft

**Konvence:** kód (routes, types, field names, storage keys, i18n
keys, component names) anglicky. UI texty česky (přes `t()` z
`src/i18n/cs.json`). Komentáře česky OK. Existující Czech routes
(`/zaznamy`, `/ukoly`, `/t/:id`, `/nastaveni`) zůstávají — dědictví.

## 1. Problem Statement

Uživatelé aplikace **Chytrý dům na vsi** potřebují plánovat konkrétní
časové události (schůzka s PM, návštěva řemeslníka, termín kolaudace)
s pevným datem/časem a **automatickou propagací do svého Apple Calendar**.
Stávající entity (nápad, otázka, úkol) řeší flexibilní deadliny
a workflow, ne "v úterý 14:00 přijede elektrikář". Dnes se termíny
vyměňují ad-hoc v SMS/WhatsApp a každý si je ručně přidává do iOS
kalendáře — extra krok a riziko, že někdo na událost zapomene.

## 2. Primary User

**Každý přihlášený uživatel aplikace** — aktuálně OWNER (Stáňa +
manželka) + PROJECT_MANAGER. iPhone primárně, Apple Calendar v pozadí.
PM může mít i Android (secondary). V budoucnu přibudou další role
(architekt, řemeslník jako user) — out of scope V1.

**Scénář**: Stáňa na stavbě domluví s PM "ve středu 14:00 přijde
elektrikář osadit rozvaděč". Otevře appku na iPhone → `/events` →
vytvoří event "Elektrikář — rozvaděč", 2026-05-14 14:00–16:00, pozve
manželku + PM. Oba dostanou push + inbox notifikaci + event v Apple
Calendar do 15 min. Manželka klikne "Můžu" (bude doma), PM "Můžu" (jede
na stavbu). Stáňa vidí v appce souhrn: 2/2 potvrzeno. Ve středu 16:30 po
události klikne v appce "Proběhlo" → event se změní ze „ČERVENÉ =
potvrdit" na „ZELENÉ = hotovo".

## 3. Success Metrics

- **Primary**: 0 událostí zmeškaných kvůli neinformovanosti (self-report
  retro) — do 90 dnů od launche.
- **Secondary**: Každá změna v appce (update / cancel) viditelná v Apple
  Calendar účastníků do 15 min (Apple Calendar refresh interval).
- **Guardrail**: Notifikační pipeline NEPOSÍLÁ duplicity (jeden event
  update → max 1 push + 1 inbox záznam per-user).

## 4. Scope

### In scope (v1)

- Vytvoření / úprava / zrušení eventu (autor + cross-OWNER per V17.1)
- Fieldy: Název, Popis, Začátek, Konec, Celodenní toggle, Adresa
  (free-text), Pozvaní (min. 1 user appky)
- Lifecycle status: `UPCOMING` → `CANCELLED` | `AWAITING_CONFIRMATION` →
  `HAPPENED` | `CANCELLED` (retro)
- RSVP: 2 stavy "Můžu / Nemůžu", viditelné jen autorovi
- Notifikace: invitation, update, cancel, RSVP reminder (24h před)
- **webcal:// subscription URL** per-user (jedna URL → všechny moje
  events, auto-sync do Apple Calendar)
- **Download ICS** per-event (jednorázový share button na detailu)
- Samostatná stránka `/events` s list view (nadcházející nahoře)
- Ikona kalendáře v headeru appky (vedle zvonku notifikací)
- Volitelný link event ↔ task (nepovinné)
- Token reset v Settings + auto-notifikace při resetu

### Out of scope

- Grid calendar view v appce (měsíc/týden)
- Google Calendar / Outlook **explicit** support (Apple-first; `ics`
  balík zajistí RFC 5545 compliance pro oba, ale neotestujeme ani
  negarantujeme)
- Attachments na events (fotky, odkazy)
- Recurring events (RRULE)
- Externí kontakty (mimo uživatele appky)
- Past events archive / cleanup (zůstávají navždy ve Firestore)
- Upozornění na konflikt v kalendáři ("máš už event ve stejný čas")

### Explicit non-goals

- **Nereplikujeme** Apple Calendar UI — není cílem plnohodnotný
  kalendářový nástroj, jen plánovač s ICS exportem v doméně stavby.
- **Neřešíme** RSVP přes Apple Calendar reply e-maily. Appka je single
  source of truth; Apple Calendar subscription je read-only view.
- **Neposíláme** e-maily řemeslníkům / externím osobám — ti nejsou
  uživatelé appky.

## 5. Constraints

- **Timeline**: žádný tvrdý deadline, hobby tempo.
- **Budget**: žádný — solo developer + AI asistent.
- **Tech stack**: React 19 + Vite + TypeScript + Tailwind (dědí z app) /
  Firebase (Firestore + CF + Auth + Storage) / `ics` npm balík (~400 kB
  přidává do bundle). Node 24 app / Node 20 functions.
- **Accessibility**: stejná baseline jako stávající app — 44px tap,
  kontrast WCAG AA, iOS Safari PWA. Nic navíc.
- **Brand / legal**: stávající design tokens (stone-50 / olive-700).
  Žádné legal/GDPR nové otázky (data zůstávají v stávajícím Firestore
  s existujícími users).
- **Team**: Stáňa (owner+dev) + Claude. Manželka + PM jako beta
  testeři.

## 6. Tone & Aesthetic

- **Feel (3 adjectives)**: klidný, čitelný, rutinní (denní nástroj, ne
  nárazovka).
- **Reference products (with reason)**:
  - **Apple Calendar** — rychlé přidání 3 klepnutími, iOS native
    datetime wheely, standardní kalendářová UX.
  - **Apple Reminders** — minimalistický layout, důraz na obsah nad
    chromem.
- **Anti-references (with reason)**:
  - **Outlook Calendar** — přetížené toolbary, business-enterprise feel
    nepatří do hobby stavebního deníku.
  - **Fantastical** — příliš feature-heavy, overkill pro "pár eventů
    měsíčně".
- **Named aesthetic philosophy**: **Dieter Rams** (stávající app-wide,
  dědíme — stone background, olive akcent, žádný zbytečný chrom).

## 7. Content & Data

- **Co existuje**: žádný obsah. Nová feature, začínáme od čisté.
- **Co chybí**: žádný import ze stávajícího Apple Calendaru — user tvrdí
  že dnes používá Apple Calendar ručně, neexistuje seznam "zprávných"
  events k migraci.
- **Kdo vlastní**: Firestore kolekce `/events/{id}` — stávající
  permission model (autor + cross-OWNER edit, delete jen autor).
  Webcal token žije na `/users/{uid}.calendarToken` (nebo subcollection,
  rozhodne IA).

## 8. Competitors & References

| Product | What we match | What we avoid |
|---------|---------------|---------------|
| Apple Calendar | 3-tap event create, datetime wheely, invitee picker, české locale | RSVP přes email reply (neumíme zachytit), multi-calendar (work/personal split), natural language input |
| Google Calendar | ICS compatibility (subscription URL musí parsovat v Google Calendar taky) | Event discovery ("interesting events"), AI time suggestions, gmail parsing |
| Microsoft Outlook Calendar | (nic) | Ribbon toolbar, zasedací místnosti, Teams integrace |

## 9. Risks & Unknowns

1. **RSVP divergence mezi appkou a Apple Calendar** —
   *Likelihood: High* / *Impact: Medium* / **Mitigace**: V ICS vypnout
   `PARTSTAT` atributu u `ATTENDEE` polí. Apple Calendar pak nenabízí
   RSVP prompt; uživatel odpovídá **pouze v appce**. Dokumentovat v UI
   (tooltip na pozvaných: "RSVP se dělá v appce, ne v Apple Calendar").

2. **Token v webcal URL úniku** — *Likelihood: Low* / *Impact: Medium* /
   **Mitigace**: Perm token v `/users/{uid}/calendarToken`, tlačítko
   "Reset calendar token" v Settings → vygeneruje nový, starý přestane
   fungovat. Při resetu auto-notifikace (push + inbox) user, aby věděl
   že musí Apple Calendar subscription obnovit.

3. **iOS PWA quirks pro ICS download + webcal:// subscribe** —
   *Likelihood: Medium* / *Impact: High* / **Mitigace**: E2E test flow
   před launch na reálném iPhone (min. iOS 17 a 18):
   1. Vytvořit event v appce
   2. Otevřít Settings → "Připojit kalendář" → webcal URL
   3. iPhone prompt → Add subscription
   4. Ověřit event v Apple Calendar do 15 min
   5. Update eventu v appce → Apple Calendar automaticky refresh
   6. Cancel eventu v appce → Apple Calendar odstraní

## 10. Open Questions

- [ ] **Frequency events** — kolik events reálně za měsíc? MVP designem
  pro "pár (<10)", pokud by přerostlo na "desítky", potřebujeme
  sekundární grid view.
- [ ] **Cut 50% scenario** — kdyby se seklo 50% timeline, co vyhodit?
  Nerozhodnuto (hobby tempo eliminuje potřebu).
- [ ] **RSVP reminder copy** — přesné znění push notifikace 24h před
  eventem, pokud ještě nebylo odpovězeno. Design-tokens / IA rozhodne.
- [ ] **Webcal subscription deep-link** — zda `<a href="webcal://...">`
  funguje na iOS Safari PWA standalone, nebo nutno otevřít v normálním
  Safari tabu. Test v E2E flow.
- [ ] **Past events view** — zůstávají navždy; potřebuje ale UI filter
  "skrýt proběhlé" default? (TBD v IA.)

## 11. Definition of Done

Testable kontrola před launch:

- [ ] Vytvoření eventu s minimálními fieldy (Název, Začátek, Konec,
  1 pozvaný) uloží do Firestore s korektním schématem (`authorRole`
  snapshot, `status: UPCOMING`).
- [ ] Každý pozvaný dostane **invitation notifikaci** (push + inbox)
  s deep-linkem na detail eventu.
- [ ] Pozvaný v detailu eventu klikne "Můžu" / "Nemůžu" → RSVP se uloží,
  autor to vidí v RSVP seznamu.
- [ ] **24 hod před eventem** se pošle RSVP reminder pozvaným, kteří
  nepotvrdili.
- [ ] User v Settings → "Připojit kalendář" vidí webcal URL. Klik na ni
  na iPhone → Apple Calendar prompt → "Subscribe".
- [ ] **Apple Calendar zobrazí event** do 15 min po vytvoření v appce.
- [ ] **Update eventu** v appce (čas / popis / pozvaní) se propíše do
  Apple Calendar do 15 min.
- [ ] **Cancel eventu** v appce → event zmizí z Apple Calendar do 15 min.
- [ ] Po termínu nepotvrzený event je **červený** v UI. Autor klikne
  "Proběhlo" → status `HAPPENED`, zelený. Nebo "Zrušilo se" → status
  `CANCELLED`, šedý přeškrtnutý.
- [ ] **Cross-OWNER pravidla**: OWNER (ne-autor) může editovat event
  vytvořený jiným OWNEREM. PM (ne-autor) nesmí editovat cizí event.
- [ ] **Download ICS** per-event generuje valid ICS (RFC 5545), importuje
  bez erroru v Apple Calendar + Google Calendar.
- [ ] Token **reset** v Settings → starý webcal přestane fungovat
  (stavový kód 410/401), user dostane push notifikaci o resetu.
- [ ] E2E test flow proběhne end-to-end na reálném iPhone (min. iOS 17)
  bez chyb.
- [ ] Typecheck + ESLint + vitest projdou bez errors v `app/` i
  `app/functions/`.
- [ ] CLAUDE.md aktualizován (nová sekce popisující events architekturu
  a notifikační katalog rozšířen o event eventy).
