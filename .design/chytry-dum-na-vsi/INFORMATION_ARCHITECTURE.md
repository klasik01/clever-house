# Chytrý dům na vsi — Information Architecture

**Date**: 2026-04-20
**Status**: Draft

## User jobs drawn from the brief

| ID | User | Job |
|---|---|---|
| J1 | OWNER | Zachytit nápad / otázku mezi životem za **< 5 s** od otevření appky |
| J2 | OWNER | Převést nápad na otázku pro Projektanta, když je připraven |
| J3 | OWNER | Před schůzkou s Projektantem projít otevřené otázky a zaktualizovat stavy |
| J4 | OWNER | Vygenerovat PDF otevřených otázek (plán B pro Projektanta) |
| J5 | OWNER | Před předávkou etapy ověřit, že všechny úkoly dané lokace jsou *Rozhodnuto* / *Ve stavbě* / *Hotovo* |
| J6 | OWNER | Přidat / přejmenovat / smazat kategorii bez deploye |
| J7 | OWNER | Filtrovat a prohlížet seznamy podle stavu, kategorie, lokace |
| J8 | OWNER | Připojit k záznamu obrázek nebo externí odkaz |
| J9 | PM | Přečíst si otevřené otázky adresované OWNER-em |
| J10 | PM | Odpovědět na otázku a označit ji jako vyřešenou |
| J11 | PM | Požádat OWNER-a o doplnění (bez vytváření nového tasku) |

Každá trasa v sitemape dále musí ukazovat na aspoň jedno `J*`.

---

## 1. Sitemap

```
/                           (auth, both)      — Smart home: OWNER→Zachyt+Nápady, PM→Otázky
/otazky                     (auth, both)      — Seznam otázek pro Projektanta
/t/:id                      (auth, both)      — Detail záznamu (nápad i otázka)
/kategorie                  (auth, OWNER)     — Správa kategorií
/export                     (auth, OWNER)     — Export otevřených otázek do PDF
/nastaveni                  (auth, both)      — Téma, jazyk, účet, odhlášení
/auth/prihlaseni            (public, both)    — Firebase Auth (email + Google)
```

**Hloubka:** max 2 úrovně (seznam → detail). Mobile-friendly.
**Smart root `/`:** po přihlášení server/client router přesměruje podle role:
- OWNER → `/` renderuje **Zachyt + seznam Nápadů** (neredirectujeme na /napady, je to výchozí screen)
- PROJECT_MANAGER → redirect na `/otazky?stav=cekam`

**Proč oddělená trasa `/otazky` ale Nápady žijí na `/`:** protože Stanislav má Nápady jako primární capture cíl (J1) — chceme je mít už na home. Otázky jsou pracovní list, který otevírá záměrně (J3, J4). Technicky obě entity žijí ve stejné Firestore collection `tasks` s polem `type`.

**Fixní lokace a workflow konverze (J2):** převod Nápad → Otázka je akce uvnitř `/t/:id` (viz Flow B). Nezakládáme zvláštní trasu.

---

## 2. Primary navigation

**Mobile (primární, 80 %):** **bottom tab bar**, iOS/Material hybridní.

Role OWNER — 3 taby:
1. **📝 Zachyt** → `/` (home, výchozí)
2. **❓ Otázky** → `/otazky`
3. **⚙️ Více** → `/nastaveni` (obsahuje odkaz na Kategorie, Export, účet, téma)

Role PROJECT_MANAGER — 2 taby:
1. **❓ Otázky** → `/otazky` (home)
2. **⚙️ Více** → `/nastaveni`

**Proč 3 taby, ne 5?** Apple HIG max 5; pro MVP preferujeme **hustší hierarchii přes „Více"** než 5 plochých tabů, protože:
- 3 taby mají větší tap targety (třetina šířky místo pětiny)
- Sekundární akce (Kategorie, Export) nepotřebují viditelnost po celou session — stačí 1× za týden
- Méně kognitivní zátěže ⇒ méně risku "uživatel se ztratí" (9.2 v DISCOVERY)

**Desktop (20 %):** levý sidebar s týmiž položkami + identickými ikonami. Minimalistický; šířka 240 px.

**FAB (+):** **NE.** Primární akce `/` je rovnou textarea composer — FAB by byl duplicita. Na `/otazky` primární akce je listen-filter-answer workflow, ne capture. Pokud OWNER chce zapsat otázku, kterou rovnou ví (ne z nápadu), otevře `/` + composer + "rovnou jako otázka" toggle.

---

## 3. User flows (top 3)

### Flow A — Quick capture nápadu (J1) — nejkritičtější

**Budget: < 5 sekund od tapu na home-screen ikonu.**

1. Tap PWA ikony → **`/`** se otevírá, textarea má **auto-focus**, klávesnice nahoře, persistent login platí.
2. OWNER píše text. (Nepovinně: tap ikony obrázku / odkazu → připne appendix.)
3. Tap **Uložit** nebo dvojitý Return (keyboard shortcut) → záznam saved s `type='napad'`, `status='napad'`, bez kategorie, bez lokace.
4. Composer se vyčistí, záznam se objevuje **na vrchu** seznamu pod composerem (live z Firestore). Focus zůstává v composeru.

**Friction redukce:**
- Stanislav může uložit nápad bez vyplnění kategorie nebo lokace ("inbox zero" — doplní později).
- Draft je uložen do `localStorage` při každém keystroku, takže předčasné zavření neztrácí data.
- Žádné povinné pole kromě text.

**Decision branch:** Pokud OWNER vědomě píše otázku, ne nápad → toggle "jako otázku" nad composerem přepne `type='otazka'` před uložením.

---

### Flow B — Review před schůzkou s Projektantem (J3, J4) — Primary metric

1. OWNER otevře app → `/` (Zachyt view).
2. Tap tabu **Otázky** → `/otazky`. Výchozí filtr: `stav ∈ {Otázka, Čekám}` (= otevřené).
3. Projíždí seznam. Tapne otázku → `/t/:id`.
4. Upraví text otázky, případně mění `status` segmented controlem (Nápad / Otázka / Čekám / Rozhodnuto / Ve stavbě / Hotovo), doplní kategorii/lokaci.
5. Tap zpět na `/otazky`. Opakuje pro další otázky.
6. Vytvoří PDF export: tap **Více** → **Export PDF** → `/export`.
7. Na `/export` vybere scope (default: stav = Otázka + Čekám), preview, tap **Vygenerovat PDF** → stáhne / sdílí přes iOS share sheet na WhatsApp.

**Error branch:** Pokud se PDF nepodaří vygenerovat (neznámá risk — viz DISCOVERY 9.3), zobrazí se fallback "Zkopírovat jako text" — plain text seznam otázek do schránky.

---

### Flow C — Projektant odpovídá (J10, J11) — druhotný success metric

1. Projektant dostane **WhatsApp** notifikaci od Stanislava (mimo app).
2. Otevře PWA → `/` → router ho jako PROJECT_MANAGER přesměruje na `/otazky?stav=cekam`.
3. Tapne otázku → `/t/:id`.
4. Scrolluje na sekci **„Odpověď Projektanta"** → píše odpověď.
5. **Zvolí jednu ze dvou akcí:**
   - **"Odpovídám — uzavřít"** → uloží, status → `Rozhodnuto` automaticky.
   - **"Potřebuji doplnit"** → uloží, status zůstane `Čekám`, ale odpověď je viditelná s popiskem *"Projektant čeká na doplnění"*. OWNER přepíše otázku, status → `Čekám` (reset), PM re-answers. (Toto je J11 beze vztahu novému tasku — jeden task, dvě otáčivá pole.)
6. Při dalším otevření app vidí PM aktualizovaný seznam s méně otázkami k vyřízení.

**Decision branch — proč ne vlákno:** komentářové vlákno je CUT (DISCOVERY). Dva-field model (otázka ↔ odpověď) stačí pro 3 uživatele; pokud iterace > 2, OWNER nejlépe otevře nový task a starý označí `Hotovo`.

---

### (Pocket flow D — Předávka řemeslníkům, J5)

1. OWNER otevře **`/otazky`** → filter `lokace = Kuchyň` + `stav ∈ {Rozhodnuto, Ve stavbě, Hotovo}`.
2. Zkontroluje vizuálně, že neobsahuje žádný `Nápad` ani `Čekám` v té lokaci.
3. Pokud ano → klikne, doklepe.
4. (Volitelně) Export PDF se stejným filtrem jako "zápis z předávky".

Tento flow nemá vlastní obrazovku — používá filtrový query string. Měřitelné: "všechny úkoly lokace = *Rozhodnuto / Ve stavbě / Hotovo*".

---

## 4. Page blueprints

### `/` — Home (Zachyt + Nápady)

- **Purpose**: Zachytit nový nápad rychleji než v Apple Notes a vidět nedávné nápady.
- **Primary action**: **Napsat text v composeru a uložit.**
- **Secondary actions** (max 3):
  1. Přepnout type "jako otázku" (toggle nad composerem)
  2. Přidat přílohu (obrázek / link) tlačítky vedle composer
  3. Filtrovat seznam (chip strip: stav, kategorie, lokace)
- **Content blocks** (priorita shora):
  1. **Composer** — multiline textarea `auto-focus`, submit button, 2 ikony (obrázek, link), type toggle *"Nápad / Otázka"* (default Nápad)
  2. **Filter chips** — scrollable horizontal strip, default: `stav ≠ Hotovo`
  3. **Seznam nápadů** — Firestore query `type=napad` seřazeno `createdAt desc`. Každá karta: titulek (prvních 80 znaků textu), status badge, kategorie/lokace chipy (pokud vyplněny), attachment ikony, relativní čas (*"před 2 h"*)
  4. **Empty state** — "Tady začne tvůj seznam nápadů. Začni psát nahoře."
- **Data dependencies**: `tasks where type='napad'` (realtime), `categories` (pro chipy), `locations` (pro chipy), user role.
- **Loading state**: skeleton karet (3 placeholder).
- **Error state**: toast "Nepodařilo se načíst, zkus to znovu" + retry button.

### `/otazky` — Seznam otázek

- **Purpose**: Proběhnout otevřené otázky pro Projektanta a aktualizovat jejich stav.
- **Primary action**: **Tapnout otázku a přejít na detail.**
- **Secondary actions**:
  1. Filtrovat podle stavu / kategorie / lokace (chip strip)
  2. Přepnout pohled "Jen otevřené" ↔ "Všechny" (segmented control)
  3. Sdílet PDF export (top-right icon, vede na `/export` s předvyplněným scope)
- **Content blocks**:
  1. **Segmented control** — *"Otevřené / Zodpovězené / Vše"* (default: Otevřené)
  2. **Filter chips** — kategorie, lokace
  3. **Seznam otázek** — Firestore query `type=otazka` + filtr + seřazeno `createdAt desc`. Karta: text otázky, **status badge prominentně** (Čekám = žlutá, Rozhodnuto = zelená), kategorie/lokace chipy, ikona odpovědi (vyplněno ANO/NE), relativní čas.
  4. **Empty state** — "Žádné otázky neodpovídají filtru."
- **Data dependencies**: `tasks where type='otazka'` (realtime), `categories`, `locations`, user role.
- **Role visibility**: PM vidí tuto trasu jako home; OWNER vidí také. Pro PM je `/napady` (= `/`) skryta.
- **Loading state**: skeleton.
- **Error state**: toast + retry.

### `/t/:id` — Detail záznamu

- **Purpose**: Zobrazit a upravit jeden záznam (nápad nebo otázka).
- **Primary action**: **Upravit obsah nebo aktualizovat stav.**
- **Secondary actions**:
  1. Převést Nápad na Otázku (pouze `type=napad`, OWNER)
  2. Smazat záznam (OWNER)
  3. Přidat přílohu
- **Content blocks**:
  1. **Top bar** — zpět arrow, typ (ikona Nápad / Otázka), overflow menu (Delete, Duplicate)
  2. **Status** — segmented control: Nápad · Otázka · Čekám · Rozhodnuto · Ve stavbě · Hotovo (barevně označená aktuální)
  3. **Titulek + body** — inline editable text fields, auto-save on blur
  4. **Kategorie / Lokace** — dva dropdown picker chips
  5. **Přílohy** — grid / list: obrázky s thumb, linky s titulkem (fetch OG meta nepovinné)
  6. **Pokud `type=otazka`**: sekce **„Odpověď Projektanta"**
     - Pro PM: editable textarea + 2 tlačítka *"Odpovídám — uzavřít"* / *"Potřebuji doplnit"*
     - Pro OWNER: read-only (pokud vyplněno) s timestamp odpovědi
  7. **Pokud `type=napad` a existuje `linkedTaskId`**: card *"Vytvořená otázka: [link]"*
  8. **Pokud `type=napad` a žádný `linkedTaskId`**: tlačítko *"Převést na otázku pro Projektanta"*
  9. **Metadata** — autor, created, last updated (malým písmem na spodku)
- **Data dependencies**: `tasks/{id}` (realtime), `attachments` subcollection, `categories`, `locations`.
- **Loading state**: skeleton s top barem.
- **Error state**: "Záznam nenalezen" + tlačítko zpět.

### `/kategorie` — Správa kategorií (OWNER)

- **Purpose**: Seznam vlastních kategorií; přidat / přejmenovat / smazat.
- **Primary action**: **Přidat novou kategorii** (v hlavním polovém inputu).
- **Secondary actions**:
  1. Přejmenovat existující (tap → inline edit)
  2. Smazat (swipe left na mobilu, ikona na desktopu)
- **Content blocks**:
  1. **Nová kategorie** — text input + "+" button
  2. **Seznam** — alfabeticky seřazené. Seedované položky (11 z DISCOVERY 5.3) jsou pre-loaded, ale editovatelné.
  3. **Info hint** — "Smazání kategorie neodstraňuje záznamy, jen je odznačí."
- **Data dependencies**: `categories` (realtime).
- **Empty state**: seznam nikdy nebude plně prázdný kvůli seed, ale pokud by byl: "Začni vytvořením první kategorie."

### `/export` — Export do PDF (OWNER)

- **Purpose**: Nakonfigurovat a vygenerovat PDF otevřených otázek.
- **Primary action**: **Tapnout „Vygenerovat PDF" a získat soubor ke sdílení.**
- **Secondary actions**:
  1. Předpřipravený preset *"Otevřené otázky"* (`stav ∈ {Otázka, Čekám}`), *"Všechny otevřené"* (`stav ≠ Hotovo`), *"Vlastní"*
  2. Ořezat podle kategorie / lokace
  3. Zahrnout přílohy ANO/NE (default ANO)
- **Content blocks**:
  1. **Preset selector** — segmented control
  2. **Filtry** (volitelné) — kategorie, lokace
  3. **Počet záznamů v exportu** — živá cifra
  4. **Preview** — zkrácený list preview (prvních 5 záznamů, odkaz "Zobrazit všechny")
  5. **Tlačítko „Vygenerovat PDF"** — spustí client-side generování
  6. **Po generování** — share dialog (iOS / Android native) nebo download link
- **Data dependencies**: filtered `tasks` query.
- **Error state**: "Nepodařilo se vygenerovat PDF" + **fallback**: "Zkopírovat jako text" (clipboard plain text).

### `/nastaveni` — Nastavení

- **Purpose**: Hub pro sekundární funkce a konfiguraci účtu.
- **Primary action**: Závisí na sekci; není jedna globální.
- **Content blocks**:
  1. **Účet** — e-mail, role, tlačítko Odhlásit
  2. **Téma** — segmented: System / Světlé / Tmavé (default: System)
  3. **Jazyk** — disabled dropdown *"Čeština"* (V2 EN)
  4. **Data** → odkaz na `/kategorie`, `/export`
  5. **O aplikaci** — verze, link na GitHub repo (pokud public)
- **Data dependencies**: Firebase Auth user profile.

### `/auth/prihlaseni` — Přihlášení

- **Purpose**: Přihlásit existující účet.
- **Primary action**: **Přihlásit se e-mailem a heslem** nebo **Google**.
- **Secondary actions**:
  1. Google Sign-In
  2. Password reset link (*"Zapomněli jste heslo?"*)
- **Content blocks**:
  1. Logo / wordmark "Chytrý dům na vsi"
  2. E-mail input
  3. Password input
  4. Tlačítko "Přihlásit"
  5. Oddělovač "nebo"
  6. Google Sign-In button
  7. Forgot password link
- **Registrace**: V MVP **nepřidáváme self-serve signup** — účty vytváří Stanislav ručně ve Firebase console (3 uživatelé, hobby). Open question č. 1 níže.
- **Loading state**: button spinner.
- **Error state**: inline pod polem ("Špatný e-mail nebo heslo").

---

## 5. Content inventory

| Type | Fields | Source | Owner |
|---|---|---|---|
| **Task** | `id`, `type` (napad\|otazka), `title`, `body`, `status`, `categoryId`, `locationId`, `attachmentIds[]`, `linkedTaskId?`, `projektantAnswer?`, `projektantAnswerAt?`, `createdBy`, `createdAt`, `updatedAt` | Firestore `tasks` | OWNER creates; OWNER + PM edit per rules |
| **Attachment** | `id`, `taskId`, `kind` (image\|link), `url`, `storagePath?`, `title?` (pro link OG), `createdAt` | Firestore `attachments` + Firebase Storage (pro obrázky) | Task creator |
| **Category** | `id`, `label`, `createdAt`, `createdBy` | Firestore `categories` | OWNER |
| **Location** | `id`, `label`, `group` (Venkovní\|Dům obecně\|Obytné\|Hygiena), `isBuiltin: true` | **Static seed v kódu** v MVP; V2 Firestore `locations` | System (MVP) |
| **User** | `uid`, `email`, `role` (OWNER\|PROJECT_MANAGER), `displayName`, `createdAt` | Firebase Auth + Firestore `users/{uid}` | Self + admin (Stanislav) |

---

## 6. URL & state model

- **Routing**: history API (React Router), **žádné hash routing** — PWA-friendly, čisté deep links.
- **Filter state** je v **query parametrech** na `/otazky` a potenciálně na `/` (Nápady):
  - `/otazky?stav=cekam&kategorie=elektro&lokace=kuchyne`
  - Deep-linkable — můžu poslat link "přečti si vše v kuchyni" Projektantovi.
- **Composer draft** (netknutý text před uložením) → `localStorage` klíč `capture-draft`, aby přežil crash/restart. Smaže se po uložení.
- **Theme preference** → `localStorage` klíč `theme-preference` (system / light / dark). Default: system.
- **Server state**: všechny tasks, categories, users → Firestore, realtime listeners na aktivní obrazovce.
- **Auth state**: Firebase SDK, persistent login (`Persistence.LOCAL`).
- **Session filters**: tab přepínání zachovává filtr pro tu tabu přes `sessionStorage` (pokud chce OWNER rychlé návraty). Otevření appky nanovo = reset na default filtr.
- **Deep-linkovatelné stránky**: `/t/:id`, `/otazky?query`, `/kategorie`. `/` je také deep-linkovatelný (vrátí se rovnou do capture).

---

## 7. Navigation patterns

- **Breadcrumbs**: **ne** — hloubka max 2, mobile-first.
- **Back na mobilu**: `/t/:id` má explicitní **zpět arrow** top-left (vede na `/` nebo `/otazky` podle history). Browser back / swipe-back funguje jako redundance.
- **Persistence**:
  - Filtry na `/otazky` a `/` přežívají přepnutí tabu během session (sessionStorage), resetují se při novém spuštění appky.
  - Composer draft přežívá crash/zavření do uložení nebo explicitního clear.
  - Theme preference napříč sessionmi.
- **Tab bar**: vždy viditelný, kromě:
  - V composeru s otevřenou klávesnicí (skrýt, aby nezabíral prostor pro keyboard)
  - Na `/t/:id` modal detail (volitelně fullscreen, tab bar skrytý)
- **PWA install prompt**: ukázat jednou po 3. úspěšné capture session, nenásilně. Dismiss persistent.
- **Keyboard shortcuts** (desktop bonus, ne MVP-kritické):
  - `Cmd/Ctrl + Enter` = submit composer
  - `/` = focus filter

---

## 8. Open structural questions

- [ ] **Self-serve signup vs. manuální účty.** MVP plán: Stanislav ručně vytváří 3 účty ve Firebase console, žádný signup UI. Pokud V2 sdílený link pro řemeslníky, signup bude nutný. **Rozhodnuto pro MVP: žádný signup.**
- [ ] **Role switching / demo mode.** Nepotřeba — každý uživatel má fixní roli v Firestore `users` doc.
- [ ] **Pre-seeded welcome task** (*"Vítej\! Toto je tvůj první nápad…"*) nebo čistý start? Doporučuji **čistý start** + inline empty state copy, žádný dummy content.
- [ ] **Detail `/t/:id` jako plnostránková route vs. bottom sheet modal.** Pro mobile UX jednodušší plnostránka (jednoznačný back + URL share). Modal jen pro quick peek? **Rozhodnuto: plnostránka `/t/:id`** (viz Flow A–C).
- [ ] **Vyhledávání fulltext.** Mimo MVP scope. Pokud bude potřeba před první schůzkou s 50+ tasky, přidáme v průběhu.
- [ ] **OG preview pro linky.** Scrape title/image z URL = síťová závislost. MVP: jen uložit URL, zobrazit domain. V2: fetch OG meta přes Cloud Function. **MVP: jen URL.**
- [ ] **Obrázek: crop/resize před uploadem.** Firebase Storage free tier má limit 5 GB. Pro 3 uživatele a MVP 6 týdnů to vystačí, ale resize na max 1920 px před uploadem je prudence, ne luxus. **Doporučeno v MVP** (jednořádková knihovna `browser-image-compression`).

---

*Brief odkaz: [DESIGN_BRIEF.md](./DESIGN_BRIEF.md)*
*DISCOVERY odkaz: [DISCOVERY.md](./DISCOVERY.md)*
