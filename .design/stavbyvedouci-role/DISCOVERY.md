# DISCOVERY — Role `STAVBYVEDOUCÍ` (CONSTRUCTION_MANAGER)

> Skill: `designer-skills:grill-me`
> Date: 2026-04-29
> Author: Stáňa Kasika (interview), Claude (interviewer + writer)
> Status: Discovery dokončeno, připraveno na `design-brief`.

---

## Problem Statement

Stavbyvedoucí pracuje pro PM a je externí dodavatel pod NDA. Dnes by, kdyby
dostal stávající `PROJECT_MANAGER` roli, viděl všechny brainstorming nápady
mezi OWNER (Stáňa + manželka) a PM — což je trapas a smluvní problém. Cílem
je zavést třetí roli `CONSTRUCTION_MANAGER` (CM), která má scope omezený
na vlastní úkoly a otázky, vidí jen explicitně sdílenou dokumentaci, smí
zakládat události, a **vůbec nesmí** do `Zaznamy` (nápady).

## Primary User

Externí stavbyvedoucí (1–2 lidé, **z jedné firmy → tým**), kteří plní úkoly
zadané OWNER/PM, kladou otázky a tvoří události na stavbě. Vysoká frekvence
použití — celý den (ráno, na stavbě, večer, na push).

## Success Metric (90 days)

> **Stavbyvedoucí dokončí 80 % zadaných úkolů bez ptaní se OWNERa "kde co najít".**

## Top 5 Risks

1. **Scope bez priorit** — uživatel řekl "chci všechno" + bez deadline + Claude
   implementuje komplet. Hrozí, že sprint se utopí v 17 notifikačních event
   recipientech. Brief musí explicitně označit prioritu vertikálních slices.
2. **Hard cutover** — žádný feature flag, deploy přes git push. Manželka i PM
   dostanou novou verzi bez varování. Mitigace: PWA update toast s textem
   změny + i18n stringy v `cs.json` před nasazením.
3. **Tým-předpoklad (α)** — celá architektura read scope a cross-CM edit stojí
   na předpokladu, že "dva CM jsou z jedné firmy". Když dorazí druhý nezávislý
   externista, current design ho vystaví ostatnímu CM.
4. **Bootstrap user doc** — CM se přihlašuje Googlem, ale jeho `users/{uid}`
   musí existovat dřív, než se přihlásí. Kdo zakládá `uid`? Auth Google login
   ho zná až po prvním přihlášení. **Open question** v briefu: buď ručně po
   prvním login, nebo trigger `onUserCreated` Cloud Function s lookupem
   pre-seedovaného profilu podle emailu.
5. **Notification recipient explosion** — 17 event types, každý potřebuje
   revizi recipient logiky pro novou roli. Vysoká bug surface area. Mitigace:
   pure-helper test per event s `CONSTRUCTION_MANAGER` recipient case.

---

## Block 1 — Problem & outcome

**1.1 Problém:** Bezpečnost / smluvní hranice. CM je externí dodavatel pod
NDA. Pokud by dostal `PROJECT_MANAGER` roli, viděl by všechny brainstorming
nápady OWNER+PM. To je trapas + porušení NDA hranic.

**1.2 Kolik CMs:** 2 lidé, identifikovaní (jména nesdělena). **Fungují jako
tým z jedné firmy** (analog OWNER+manželka).

**1.3 Měřitelný cíl:** "Stavbyvedoucí dokončí 80 % zadaných úkolů bez ptaní
se mě, kde co najít."

**1.4 Cena nedělání:** "CM uvidí všechny moje a manželčiny brainstorming
nápady — to je trapas, není to jeho byznys."

**1.5 Architektura role:** Třetí role v `UserRole` union (NE flag, NE
hard-coded email gate). `UserRole = "OWNER" | "PROJECT_MANAGER" |
"CONSTRUCTION_MANAGER"`. Mirror v `firestore.rules`.

---

## Block 2 — Users & jobs-to-be-done

**2.1 Konkrétní lidé:** 2 identifikovaní stavbyvedoucí, jedna firma.

**2.2 Den v životě (vybráno):**
- Ráno v autě (6:30) — co dnes řešit
- Na stavbě před zedníkem — rychlé ověření
- Po práci (18:00) — odbavení, report
- Při problému — rychlá eskalace
- Na push — reaktivně

**2.3 Konektivita:** Offline NEvyžadováno. Default Firebase queue stačí.
**No explicit offline UI** — pokud write selže, queueuje se a syncne.

**2.4 Co dělá dnes:** Volá si s PM. Appka **doplňuje telefon, NE nahrazuje**.
Telefon zůstává primární kanál — appka je deník/audit/permanent record.

**2.5 Top 3 JTBD:**
1. **(a)** "Když přijdu ráno na stavbu, chci za 10s vidět, co dnes řešit."
2. **(e)** "Když je problém naléhavý, chci vědět, že mě někdo uslyšel —
   notifikace dorazila."
3. **(d)** "Když potřebuji info o materiálu/postupu, chci si stáhnout
   dokumentaci, kterou jsem dostal."

**Důležitá implikace:** Top 3 jsou všechny **konzument-mode**. Tvorba
úkolů, otázek, eventů je secondary. Default screen pro CM = `/ukoly`
s filtrem `assigneeUid === me`. Composer NENÍ ve foreground.

**2.6 Sekundární uživatelé / úprava workflow:**
- `AssigneeSelect` ukazuje CM jako další volbu (potvrzeno).
- Sharing dokumentace s CM uděluje **autor dokumentu** (OWNER nebo PM).
- V úkolu se zobrazuje konkrétní jméno přiřazeného člověka.

**2.7 Anti-uživatel:** OWNER workflow se mírně zkomplikuje (musí přemýšlet
o sharingu, když nahrává dokumentaci).

---

## Block 3 — Scope & non-goals

### IN-SCOPE V1

- `UserRole` union rozšíření o `CONSTRUCTION_MANAGER` v `app/src/types.ts`
  + mirror v `functions/src/notify/types.ts`.
- Update všech 20 permission akcí v `app/src/lib/permissionsConfig.ts` pro
  CM podle níže uvedené permission matrice.
- `firestore.rules` přepsání:
  - `tasks` read rule s composite check: `type != "napad"` AND
    (`type != "dokumentace"` OR `"CONSTRUCTION_MANAGER" in
    sharedWithRoles`) AND (pro otazka/ukol: `assigneeUid ==
    request.auth.uid` OR `createdBy == request.auth.uid` OR
    creator/assignee role je `CONSTRUCTION_MANAGER` (cross-CM tým)).
  - `tasks` edit rule: `author-or-cross-CM` (analog k cross-OWNER patternu).
  - `tasks` create gates: `napad` a `dokumentace` zakázané pro CM.
- `Shell.tsx` skrytí tabu **Zaznamy** pro CM (Tight option (a)). Vidí:
  Ukoly, Otázky, Dokumentace, Events. Skryto: Zaznamy, Harmonogram, Prehled.
- `AssigneeSelect`:
  - Pro `napad` typ: CM se nezobrazuje jako volba.
  - Pro `otazka/ukol`: CM se zobrazuje normálně.
- `Composer.tsx` pro CM: jen `otazka` a `ukol` create. `napad` a
  `dokumentace` skryté nebo disabled.
- `RichTextEditor` v read-only režimu pro CM na dokumentaci.
- Notification catalog: revize 17 event types — recipient logika musí brát
  v potaz, že CM nesmí dostat notifikaci o tasku, který nevidí. Specifické
  revize:
  - `mention` — pokud někdo @CM v komentu na napad → notifikace SE NEPOSÍLÁ.
  - `comment_on_thread` — gate na `canReadTask(cm, task)`.
  - `document_uploaded` — jen pokud `sharedWithRoles` obsahuje CM roli.
  - `task_deleted` — CM dostane jen pokud byl assignee/creator.
- Workflow akce na komentech:
  - CM **smí** flipnout svůj úkol z `OPEN` → `DONE` ✅
  - CM **NEsmí** flipnout otázku z `OPEN` → `BLOCKED` (Q2 b = ne)
  - CM **NEsmí** reassignnout úkol (Q2 c = ne)
- Linked task UI pro CM: pokud `linkedTaskIds` obsahuje skrytý nápad,
  link se **úplně nezobrazí** (Q3 (a) Hide entirely). UI implementace v
  `TaskDetail.tsx` filtruje `linkedTaskIds` přes `canReadTask` před
  vykreslením link chips.
- `cs.json` rozšíření:
  - `role.CONSTRUCTION_MANAGER = "Stavbyvedoucí"` (krátká forma:
    "Stavbyved.").
  - i18n stringy pro nové empty states / read-only banners.
  - Update notification stringů, kde je role výslovně uvedena.
- `permissionsConfig.test.ts` invariants pass — všech 20 akcí má
  `description`, `rulesAt`, neprázdné `roles[]`.
- `npm run docs:permissions` regenerace `PERMISSIONS_GENERATED.md`.
- PWA update toast / i18n string oznamující "nového kolegu Stavbyvedoucího".

### Permission matrix (CM column added)

| Action | OWNER | PROJECT_MANAGER | CONSTRUCTION_MANAGER |
|---|---|---|---|
| `tasks.read` | anyone signed-in | anyone signed-in | scoped (typ + sharedWithRoles + assignee/creator + cross-CM team) |
| `tasks.create.napad` | yes | yes | **no** |
| `tasks.create.otazka` | yes | yes | yes |
| `tasks.create.ukol` | yes | yes | yes |
| `tasks.create.dokumentace` | yes | yes | **no** |
| `tasks.edit` | author-or-cross-OWNER | author-or-cross-PM | author-or-cross-CM |
| `tasks.delete` | author | author | author |
| `tasks.comment` | anyone (kde má read) | anyone (kde má read) | anyone (kde má read) |
| `tasks.changeType` | edit-pattern | edit-pattern | edit-pattern |
| `tasks.link` | edit-pattern | edit-pattern | edit-pattern |
| `events.read` | yes | yes | yes |
| `events.create` | yes | yes | yes |
| `events.edit` | author | author | author |
| `events.delete` | author | author | author |
| `events.rsvp` | invitee | invitee | invitee |
| `categories.manage` | yes | no | no |
| `locations.manage` | yes | no | no |
| `documentTypes.manage` | yes | no | no |
| `settings.profile` | yes | yes | yes |
| `settings.calendarToken` | yes | yes | yes |

### OUT-OF-SCOPE V1

- **(a)** Admin panel pro správu CM userů. CM vznikají ručně přes Firestore
  Console.
- **(d)** Audit log read accesses. Žádné read tracking.
- **(h)** Audit log změn role. Není potřeba.
- **(i)** Heartbeat notifikace "byl přidán nový CM" pro OWNER/PM.

### Co cutneš při polovičním deadline

**[UNANSWERED — applied default]** Uživatel řekl "chci všechno". Aplikuji
default doporučení pro budoucí brief: prioritní pořadí vertikálních slices
od backendu (rules + permissions) → frontend route gates → notification
recipient revize → i18n labels → PWA toast.

---

## Block 4 — Constraints

| Položka | Stav |
|---|---|
| Deadline | Žádný hard. Soft pace. |
| Implementuje | Claude komplet. |
| Deploy okno | Hot deploy přes git push. Žádný feature flag. |
| Legal | NDA s CM. Smluvní hranice, ne jen komfort. |
| Tech | Žádný nový npm dependency. Žádný nový Firebase produkt. Node 24.15 (app), Node 20 (functions). |

---

## Block 5 — Content & Data

**5.1 Migrace existujících tasků:** Žádná. CM po prvním loginu vidí 0
dokumentace. Sharing musí Stáňa/PM přidat ručně do každého dokumentu.

**5.2 Default sharing nově nahrané dokumentace:** `sharedWithRoles:
["PROJECT_MANAGER"]` (default). Autor musí explicitně zaškrtnout
`CONSTRUCTION_MANAGER` v sharing UI při uploadu. **Nikdy automaticky**.

**5.3 Off-boarding CM (CM odejde):** Smaže Stáňa user dokument ve Firestore
Console. Tasky a komenty zůstanou s `createdBy: <broken uid>`, UI je
zobrazí jako "neznámý uživatel". Žádné cleanup, žádná anonymizace.

**5.4 Photo / attachment quota:** Existuje 10MB/foto limit. Žádný nový
quota cap.

**5.5 Notification inbox seed:** Nový CM má prázdné
`/users/{cmUid}/notifications/`. Žádné historické notifikace. Intended.

---

## Block 6 — Context of use

**[UNANSWERED — applied defaults]**

- Mobile-first design (yes default)
- `min-h-tap` 44px convention zachována
- WCAG AA baseline zachována
- Žádný specifický stavební edge case

---

## Block 7 — Tone, brand, aesthetic

N/A pro tuto feature. Reuse existujícího `theme.ts` a UI primitivů.

---

## Block 8 — Competitors & references

N/A — interní aplikace. Reference patternů (read-scope, role-based gating)
viz `CLAUDE.md` sekce 3 (V17.1 cross-OWNER, V19 sharedWithRoles, V18-S40
changeType/link).

---

## Block 9 — Risks & unknowns

### 9.1 Biggest failure mode

**Bootstrap problem.** CM se přihlásí Googlem. `useUserRole` hook se
zeptá Firestore na `users/{cmUid}`. Pokud Stáňa zapomene
pre-seedovat profil → CM dostane "no role" empty state nebo crash.
**Mitigace v briefu:** explicit error state "Tvůj účet ještě není
nastaven, kontaktuj OWNER".

### 9.2 Most uncertain assumption

**"Dva CM jsou z jedné firmy = tým."** Cross-CM read+edit pattern stojí
na tomto. Pokud realita = dva nezávislí externí dodavatelé, design vystaví
jednoho druhému.

### 9.3 Co prototypovat první

Vertikální slice: `tasks.read` rules + permissionsConfig pro CM + Shell tab
hide pro Zaznamy + AssigneeSelect filter. To je kompletní funkční smyčka.

### 9.4 Další rizika

- **Notification recipient bugs.** 17 event types × revize per event.
- **Hard cutover bez warningu pro stávající uživatele.**
- **Plain-text mention nápadu v komentu.** Akceptováno jako known limitation.

---

## Otevřené otázky pro `design-brief` fázi

1. **Bootstrap CM user doc:** ručně po prvním login vs. pre-seed dokument
   přes migraci. Kterou cestou?
2. **Storage budget alarm:** je nastaven? Pokud ne, kdy nastavit?
3. **PWA toast + i18n strings:** seznam přesných textů.
4. **Empty state texty:** "Žádný úkol", "Žádná otázka", "Žádná dokumentace
   ti zatím nebyla sdílena" pro CM.
5. **`AssigneeSelect` filter logic:** kde přesně v komponentě?
6. **Cross-CM team: limit 2 lidé nebo n?**

---

**You're ready for `design-brief`.**

---

## Update — 2026-04-29 (post-interview clarification)

**Důležitý dodatek k Bloku 2.1:**

> PM **a** oba stavbyvedoucí jsou ze stejné firmy.

To znamená, že celá externí strana = **jedna firma**:
- PM (vedení projektu z firmy)
- 2× CM (stavbyvedoucí z firmy, tým mezi sebou)

OWNER (Stáňa + manželka) je **zákazník**.

### Důsledky pro design

1. **Tým-assumption α potvrzeno trojnásobně.** Cross-CM read+edit pattern
   je bezpečný. Risk #3 (Tým-předpoklad) zmírněn.
2. **PM jako "boss" CMs.** PM už dnes dostává `tasks.read = anyone signed-in`,
   takže vidí všechno. Implicit oversight nad CM tasky je zachován bez
   úprav.
3. **NDA hranice je čistá.** OWNER vs. firma. Brainstorming OWNER+PM je
   sdílený **uvnitř NDA**, ale nápady mezi OWNER+manželka před zapojením
   PM/firmy jsou stále interní rodinný prostor — to bude důvod, proč CM
   nesmí do `Zaznamy` (OWNER+manželka tam dál tvoří soukromý brainstorming
   bez PM a bez firmy).
4. **Dokumentace sharing pattern:** OWNER nahraje dokument →
   `sharedWithRoles: ["PROJECT_MANAGER"]` defaultně → autor zaškrtne CM
   ručně. Vzhledem k tomu, že je to jedna firma, **defaultní očekávání může
   být, že PM rovnou klikne CM checkbox** (ale ručně, ne automaticky —
   OWNER si musí být jistý, že daný dokument nesahá za hranice).

