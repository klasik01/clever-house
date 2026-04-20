# Chytrý dům na vsi — Build Plan

**Generated from**: DESIGN_BRIEF.md (2026-04-20), INFORMATION_ARCHITECTURE.md, DESIGN_TOKENS.md
**Total slices**: 18 + 1 pre-spike
**Critical path**: PS → S01 → S02 → S03 → S04 → S05 → S10 → S11 → S12
  → 9 sekvenčních kroků, ~55 h na kritické cestě
**Total budget**: ~95 h pro plnou sadu, 85 h cap. **Viz §Fallback cut order.**

---

## Pre-spike (Week 0) — de-risk před začátkem MVP

### PS: Technology spike — PDF / PWA / Firestore rules
- **Goal**: Ověřit tři neznámé a rozhodnout nástroje, než investujeme do MVP kódu.
- **Scope**:
  - Vyzkoušet `jsPDF` + Roboto font embed → 1-stránkové PDF s CZ diakritikou a obrázkem. Pokud prekne, zkusit `pdfmake` a `@react-pdf/renderer`. Vybrat jednu a zapsat rozhodnutí.
  - Deploy prázdné PWA na Netlify. Install na iPhone (Safari → plocha) + Android (Chrome → plocha). Otevře se rovnou na `/`? `start_url` v manifestu funguje? Zdokumentovat.
  - Napsat draft Firestore rules — OWNER může vše, PROJECT_MANAGER read na `tasks where type=otazka`, write jen na pole `projektantAnswer`. Otestovat v Firebase Emulator.
- **Out of scope**: Jakýkoli UI kód pro produkt.
- **Dependencies (blockedBy)**: none
- **Acceptance criteria**:
  - [ ] Rozhodnutí "PDF knihovna X" zapsáno v `DESIGN_TOKENS.md §15` nebo v novém `DECISIONS.md`.
  - [ ] PWA z Netlify instalována na Stanislavově iPhone + Android; otevírá se ve standalone módu.
  - [ ] Firestore rules procházejí Emulator testy pro 2 uživatele (OWNER, PM).
- **Size**: M (~8 h)
- **Demo**: GitHub repo `clever-house-spike/` s výsledky, zápis rozhodnutí v commitu.

---

## Phase 1 — First usable path (Stanislav capturuje nápad)

Cíl: Stanislav si nainstaluje app na telefon a od prvního dne jí nahradí Apple Notes pro nové nápady. Metrika Guardrail *(14 dní bez Apple Notes)* je měřitelná už po této fázi.

### S01: Scaffold + lokální capture
- **Goal**: Otevřu app na mobilu, napíšu nápad, uložím, vidím v seznamu — vše bez loginu, localStorage only.
- **Scope**:
  - Vite + React + Tailwind + CSS Modules, import `tokens.css`, Inter self-host.
  - Mobile-first layout shell: header (logo), bottom tab bar placeholder (1 tab), safe-area insets.
  - Home `/` obsahuje **composer** (multiline textarea, auto-focus, attach ikony placeholder) + **seznam** pod ním.
  - Persist v `localStorage` (`tasks` array + `capture-draft` key pro rozepsaný text).
  - i18n wrapper `t()` z `translations/cs.json` (všechny stringy od začátku).
  - Netlify deploy + auto-deploy z `main` branche.
- **Out of scope**: Firebase, auth, status, kategorie, lokace, /otazky, /t/:id, obrázky, linky.
- **Dependencies**: PS
- **Acceptance criteria**:
  - [ ] `app.netlify.app` je živé, otevírá na `/` s auto-focused composerem.
  - [ ] Napíšu text → tap "Uložit" → karta se objeví nahoře seznamu, composer se vyčistí.
  - [ ] Reload nezpůsobí ztrátu uložených záznamů (localStorage).
  - [ ] Rozepsaný text (před uložením) přežije reload (draft).
  - [ ] Všechny viditelné stringy čteny z `cs.json`.
  - [ ] Na mobilu (375px viewport) funguje, tap target ≥ 44 px, bez horizontal scrollu.
- **Size**: L (~10 h) — justifikováno jako foundational + první demovatelná hodnota.
- **Demo**: Stanislav na mobilu napíše první nápad, vidí ho, reloaduje, stále tam je.

### S02: Firebase Auth + Firestore sync
- **Goal**: Přihlásím se, moje nápady jsou v cloudu, vidím je i na druhém zařízení.
- **Scope**:
  - Firebase SDK init (Auth + Firestore).
  - `/auth/prihlaseni` route: email + heslo (+ Google volitelně), persistent login.
  - Protected `/` — bez loginu redirect na login.
  - Migrovat úložiště z `localStorage` do Firestore `tasks` collection. Real-time listener (onSnapshot) na aktivního usera.
  - `capture-draft` zůstává v `localStorage`.
  - Uživatelé vytvořeni ručně ve Firebase console (Stanislav + manželka). Žádný self-serve signup.
- **Out of scope**: Role (všichni jsou OWNER), Security rules beyond basic auth check, PM specific view.
- **Dependencies**: S01, PS (Firestore rules draft).
- **Acceptance criteria**:
  - [ ] Neautorizovaný přístup na `/` → redirect na `/auth/prihlaseni`.
  - [ ] Po loginu persistuje mezi reloady (žádný re-login při běžném používání).
  - [ ] Nápad uložený na iPhone se objeví do 2 s na prohlížeči na PC (live sync).
  - [ ] Odhlášení v `/nastaveni` (přidat placeholder screen s tlačítkem Odhlásit) funguje.
  - [ ] Firestore rules blokují čtení tasků jiných uživatelů.
- **Size**: M (~8 h)
- **Demo**: Stanislav + manželka si založí účty, oba vidí stejný stream nápadů na svých telefonech.

---

## Phase 2 — Struktura dat (otázky, detail, status, kategorie, lokace)

Cíl: Umožnit metrice C *(před předávkou 100% tasků v lokaci ve správném stavu)* být měřitelná — tj. mám lokace a stavy.

### S03: Typ "otázka" + `/otazky` route + tab bar
- **Goal**: Umím odlišit nápad od otázky pro Projektanta. Otázky mají vlastní obrazovku.
- **Scope**:
  - Toggle *"Nápad / Otázka"* nad composerem (default Nápad).
  - `type: 'napad' | 'otazka'` field na Firestore dokumentu.
  - Route `/otazky` — identické UI jako `/` ale filter `type='otazka'`, bez composeru (composer jen na `/`).
  - Bottom tab bar: **Zachyt** (→`/`) · **Otázky** (→`/otazky`) · **Více** (→`/nastaveni`).
  - Tab bar respektuje safe-area bottom padding na iOS.
- **Out of scope**: Status, kategorie, lokace, detail.
- **Dependencies**: S02.
- **Acceptance criteria**:
  - [ ] Složka "Otázky" zobrazuje jen tasky s `type='otazka'`.
  - [ ] Toggle v composeru mění `type` před uložením.
  - [ ] Tab bar je vždy viditelný (kromě focused composeru s klávesnicí).
- **Size**: S (~4 h)
- **Demo**: Stanislav napíše 2 nápady + 1 otázku, vidí je ve správných tabech.

### S04: Detail `/t/:id` + editace
- **Goal**: Tapnu kartu, otevře se detail, kde můžu upravovat text a smazat.
- **Scope**:
  - Route `/t/:id` — plnostránka.
  - Top bar: zpět arrow, ikona typu, overflow menu s *Smazat*.
  - Inline-editable title a body (auto-save on blur, 500 ms debounce).
  - Metadata sekce dole: autor, created, updated.
  - Ze seznamů tap na kartu otevírá detail.
- **Out of scope**: Status, kategorie, lokace, přílohy, odpověď Projektanta.
- **Dependencies**: S03.
- **Acceptance criteria**:
  - [ ] Tap karty → navigace na `/t/:id`, back arrow vede zpátky.
  - [ ] Úprava textu + tap mimo = auto-save (vizuální *"Uloženo"* hint).
  - [ ] *Smazat* v overflow menu → confirmation dialog → smaže dokument.
- **Size**: M (~6 h)
- **Demo**: Tap nápad z listu → úprava → back → vidí upraveno v seznamu.

### S05: Statusy + segmented control + filter
- **Goal**: Každý záznam má status. Můžu filtrovat seznam podle stavu.
- **Scope**:
  - `status` field (enum 6 hodnot).
  - Segmented control na detail (Nápad · Otázka · Čekám · Rozhodnuto · Ve stavbě · Hotovo) — barvy z design tokens (status-info, status-warning, status-success atd.).
  - Badge na kartě seznamu (mini chip s barvou dle stavu).
  - Filter chip strip nad seznamem `/` i `/otazky` — "Vše · Otevřené · Hotové". Default "Otevřené" = stavy ≠ Hotovo.
  - Filter persistuje přes `sessionStorage` během session.
- **Out of scope**: Filter podle kategorie / lokace (ty přijdou v S06/S07).
- **Dependencies**: S04.
- **Acceptance criteria**:
  - [ ] Každý task má viditelný status badge na kartě.
  - [ ] Změna statusu na detail se reflektuje v listu live.
  - [ ] Filter "Otevřené" skrývá tasky se stavem *Hotovo*.
- **Size**: S (~4 h)
- **Demo**: Stanislav přepne 2 tasky na *Hotovo*, filtr "Otevřené" je skryje.

### S06: Kategorie (uživatelsky editovatelné)
- **Goal**: Můžu si založit / přejmenovat / smazat kategorii, označit task, filtrovat.
- **Scope**:
  - Firestore `categories` collection.
  - `/kategorie` screen — list + add input + inline rename + swipe-to-delete (mobile) / icon (desktop).
  - Seed 11 default kategorií při first login uživatele (Cloud Function nebo client-side check).
  - Dropdown picker na `/t/:id` pod statusem.
  - Filter chip na listu (multi-select pokud jednoduché, jinak single).
  - Smazání kategorie task neodstraňuje, jen odznačí (`categoryId = null`).
- **Out of scope**: Barvy kategorií (nice-to-have, odloženo).
- **Dependencies**: S04.
- **Acceptance criteria**:
  - [ ] V `/kategorie` můžu přidat "Sauna" → objeví se v dropdownu na tasku.
  - [ ] Označený task kategorií zobrazuje chip na kartě.
  - [ ] Filter kategorií na listu funguje.
  - [ ] Smazání kategorie nezmizí tasky, jen je odznačí.
- **Size**: M (~6 h)
- **Demo**: Založí "Sauna", označí 2 nápady, vyfiltruje.

### S07: Lokace (fixní seed) + filter
- **Goal**: Task lze označit lokací, seznam lze filtrovat.
- **Scope**:
  - Static seed list (21 položek, 4 skupiny — Venkovní, Dům obecně, Obytné, Hygiena) — v kódu jako TypeScript const.
  - Dropdown picker na `/t/:id`.
  - Filter chip na listu.
  - Grouped dropdown (optgroup) pro UX — 4 skupiny jsou přehledné.
- **Out of scope**: User-editable lokace (V2).
- **Dependencies**: S04.
- **Acceptance criteria**:
  - [ ] Dropdown zobrazuje všech 21 lokací seskupených.
  - [ ] Označený task zobrazuje lokaci chip na kartě.
  - [ ] Filter lokací funguje + kombinuje s filter kategorie (AND logic).
- **Size**: S (~4 h)
- **Demo**: Označí 3 nápady lokací Kuchyň, vyfiltruje — vidí jen je.

---

## Phase 3 — Přílohy + Projektant workflow

Cíl: Metrika B *(>95% otevřených otázek zodpovězeno/rozhodnuto před schůzkou)* se stává reálně dosažitelná — Projektant má jak odpovědět, nápady se převádějí na otázky, přílohy podporují kontext.

### S08: ⚠️ Obrázkové přílohy *(cuttable #1)*
- **Goal**: Můžu připnout fotku k záznamu.
- **Scope**:
  - Composer: ikona obrázku → file input / kamera (iOS `capture="environment"`).
  - Client-side compress max 1920 px / 80 % quality (`browser-image-compression`).
  - Upload do Firebase Storage pod `images/{uid}/{taskId}/{uuid}.webp`.
  - Thumbnail na kartě v listu, full na `/t/:id`.
  - Tap na full → fullscreen lightbox (jednoduchý).
- **Out of scope**: Multiple images (MVP = 1 obrázek per task).
- **Dependencies**: S04.
- **Acceptance criteria**:
  - [ ] Můžu pořídit fotku na iPhone → uploadne se < 5 s.
  - [ ] Thumbnail na kartě se načte z komprimovaného blobu.
  - [ ] Free tier Storage není přetížen (Max ~200 obrázků @ ~200 KB = 40 MB, v limitu).
- **Size**: M (~6 h)
- **Demo**: Nápad o kuchyni s připnutou fotkou z IG screenshotu.

### S09: Externí linky
- **Goal**: Můžu připnout URL, klik otevře.
- **Scope**:
  - Composer: ikona linku → modal s URL input.
  - Na detail a listu zobrazit doménu (parsed z URL).
  - Tap na chip → otevírá v novém tabu (`target="_blank" rel="noopener"`).
- **Out of scope**: OG preview (fetch title/image) — V2.
- **Dependencies**: S04.
- **Acceptance criteria**:
  - [ ] Můžu vložit `https://instagram.com/p/xyz/` → chip zobrazuje *instagram.com*.
  - [ ] Tap otevírá URL v novém tabu.
- **Size**: S (~3 h)
- **Demo**: IG post o zahradní zásuvce.

### S10: ⚠️ Projektant role + odpověď + security rules *(cuttable #3)*
- **Goal**: Projektant se přihlásí, vidí jen otázky, odpovídá.
- **Scope**:
  - `users/{uid}` Firestore doc s polem `role: 'OWNER' | 'PROJECT_MANAGER'`.
  - Firestore security rules:
    - OWNER — read/write všechno (své vlastní + partnerčino, sdílený workspace).
    - PM — read jen `tasks where type='otazka'`, write jen pole `projektantAnswer` + `projektantAnswerAt` + `status`.
  - Router guard pro `/` — PM redirect na `/otazky?stav=cekam`.
  - `/t/:id` pro PM:
    - Read-only title/body
    - Read/Write `projektantAnswer` textarea
    - Dvě tlačítka *"Odpovídám — uzavřít"* (status→Rozhodnuto) a *"Potřebuji doplnit"* (status zůstává Čekám, answer je viditelná s popiskem).
  - Tab bar PM = 2 taby (Otázky · Více).
- **Out of scope**: Vlákna, komentáře, notifikace.
- **Dependencies**: S02, S04, S05.
- **Acceptance criteria**:
  - [ ] PM login vidí jen `/otazky` jako home.
  - [ ] Pokus o navigaci na `/` jako PM → redirect.
  - [ ] PM napíše odpověď → OWNER ji live vidí na detail.
  - [ ] PM nemůže vytvořit nový task (UI skryté + rules blokují).
  - [ ] Emulator test: PM try write jiného pole než `projektantAnswer` → fail.
- **Size**: M (~8 h)
- **Demo**: Projektant se přihlásí, zodpoví 2 otázky, Stanislav vidí odpovědi.

### S11: Nápad → Otázka konverze
- **Goal**: Z nápadu udělám otázku pro Projektanta jedním klikem.
- **Scope**:
  - Na detail `/t/:id` s `type=napad`: tlačítko *"Převést na otázku pro Projektanta"*.
  - Akce → vytvoří nový dokument `type=otazka` s předvyplněnými poli (title, body, attachments, categoryId, locationId) + `linkedTaskId` vazba.
  - Původní nápad zůstává, přibude card *"Vytvořená otázka: [link]"*.
  - Detail otázky zobrazuje card *"Vzniklo z nápadu: [link]"* pokud `linkedTaskId` existuje.
- **Dependencies**: S03, S04.
- **Acceptance criteria**:
  - [ ] Tlačítko se ukazuje jen na nápadech bez `linkedTaskId`.
  - [ ] Klik → nová otázka existuje, obě entity mají vazbu.
  - [ ] Obě karty se navzájem referencují přes `linkedTaskId`.
- **Size**: S (~3 h)
- **Demo**: Nápad *"LED ve stěně"* → jedním tapem → otázka pro Projektanta s tímtýmž textem.

---

## Phase 4 — Export, PWA, dark mode

Cíl: Plán B pro Projektanta funguje (PDF). App je instalovatelná. Noční použití je komfortní.

### S12: PDF export otevřených otázek *(risk slice)*
- **Goal**: Jedním tapem dostanu PDF seznam otevřených otázek včetně obrázků a CZ diakritiky.
- **Scope**:
  - `/export` screen: preset selector (*Otevřené otázky* / *Všechny otevřené* / *Vlastní*) + filter pickers.
  - Live preview (prvních 5 záznamů).
  - Generate tlačítko → PDF stream.
  - Knihovna zvolená v **PS spike** (pravděpodobně pdfmake nebo @react-pdf/renderer).
  - Share: iOS share sheet na mobilu, download na desktopu.
  - **Fallback** tlačítko *"Zkopírovat jako text"* do schránky (pro případ selhání generování).
- **Out of scope**: Customizable templates, logos.
- **Dependencies**: S05, S07 (potřebuje filtrovatelná data), PS (rozhodnutí knihovny).
- **Acceptance criteria**:
  - [ ] Vygenerované PDF obsahuje CZ diakritiku bez náhrady / krabiček.
  - [ ] Obrázky jsou embeddované a viditelné.
  - [ ] Share sheet se otevře na iPhone, mohu poslat na WhatsApp.
  - [ ] Fallback "Zkopírovat jako text" funguje, pokud PDF generation fails.
- **Size**: L (~10-14 h) — **největší risk slice, chráněno PS spike**.
- **Demo**: Před schůzkou s Projektantem stáhne PDF, otevře ve Files, vytiskne.

### S13: Dark mode přepínač
- **Goal**: Můžu vybrat světlé / tmavé / podle systému.
- **Scope**:
  - `/nastaveni` sekce *"Téma"* — segmented control.
  - `localStorage` key `theme-preference` = `system | light | dark`.
  - Set `data-theme` atribut na `<html>`.
  - `prefers-color-scheme` media query + tokens.css už funguje (z design-tokens fáze).
- **Dependencies**: S02.
- **Acceptance criteria**:
  - [ ] Přepnutí v nastavení se projeví okamžitě, bez reloadu.
  - [ ] Preference přežije reload.
  - [ ] Systém → default = respektuje `prefers-color-scheme`.
- **Size**: S (~3 h)
- **Demo**: V noci Stanislav přepne na Tmavé, obrazovka nezáří.

### S14: PWA manifest + install flow
- **Goal**: Můžu si app přidat na home-screen, otevře se rovnou do composeru.
- **Scope**:
  - `manifest.json` (name, short_name, start_url=`/`, display=standalone, theme_color=olive-700, background_color=stone-50).
  - Ikony 192, 512 (PNG, maskable variants).
  - Apple touch icon, iOS splash screens.
  - Service worker z `vite-plugin-pwa` (minimální, cache-first pro assets, network-first pro Firestore).
  - Non-intrusive "Add to home screen" prompt (po 3. úspěšné capture session).
- **Dependencies**: S02.
- **Acceptance criteria**:
  - [ ] iOS Safari → Sdílet → Přidat na plochu → app je v launcheru, ikona viditelná.
  - [ ] Otevření z home-screen ikony = standalone mode (bez browser UI).
  - [ ] `start_url` vede na `/` (composer), ne na login (pokud je persistentní auth).
  - [ ] Android Chrome → Install prompt se objeví.
- **Size**: S (~4 h)
- **Demo**: Stanislav přidá ikonu na home-screen, tap → rovnou composer.

---

## Phase 5 — Polish, a11y, hardening

### S15: ⚠️ i18n wrapper dokončení *(cuttable #2 — "dokončit" znamená extrahovat zbylé stringy)*
- **Goal**: Všechny stringy v projektu jsou v `translations/cs.json`, aby EN locale v V2 byl jednokrokový.
- **Scope**:
  - Audit kódu: všechny user-facing stringy prošly `t('key')`.
  - Klíče organizované v namespace (`common.*`, `task.*`, `auth.*`, atd.).
  - Kontrola formátování dat (date-fns s `cs` locale).
- **Out of scope**: EN překlady.
- **Dependencies**: S14 (po všech UI slicech).
- **Acceptance criteria**:
  - [ ] Žádná raw CZ string v JSX/TSX (grep test).
  - [ ] Všechny dates/times lokalizované (*"před 2 h"*, *"včera"*).
- **Size**: S (~3 h)
- **Demo**: Grep test v CI.

### S16: Focus states + tap targets + a11y audit
- **Goal**: Keyboard navigation funguje, screen reader čte smysluplně, všechny tap targety ≥ 44 px.
- **Scope**:
  - Focus ring na všech interactive (tlačítka, chipy, odkazy, inputy).
  - ARIA labels tam, kde ikon bez textu.
  - Skip link na `/`.
  - `aria-live` pro toast notifikace.
  - Audit s axe DevTools — 0 critical issues.
- **Dependencies**: S14.
- **Acceptance criteria**:
  - [ ] Tab keyboard projde celou appkou v logickém pořadí.
  - [ ] VoiceOver na iOS čte smyslíplné labely.
  - [ ] axe DevTools = 0 critical, ≤ 2 minor.
  - [ ] Hit area na badge chips ≥ 44×44 px (přidáno padding trick).
- **Size**: S (~4 h)
- **Demo**: VoiceOver průchod composer → save → list → detail.

### S17: Empty states + loading skeletons + error toast
- **Goal**: Prázdné seznamy nejsou ponuré, loading není blank, chyby jsou srozumitelné.
- **Scope**:
  - Empty states s copy:
    - `/` prázdný = *"Tady začne tvůj seznam nápadů. Začni psát nahoře."*
    - `/otazky` prázdný = *"Žádné otevřené otázky. Krásně."*
  - Skeleton loaders (3 placeholder cards) při first load z Firestore.
  - Toast notifikace pro uložení/chybu (3 s auto-dismiss, manuální close).
  - Error states s retry button (`Nepodařilo se načíst. Zkusit znovu.`).
- **Dependencies**: S14.
- **Acceptance criteria**:
  - [ ] Nový uživatel vidí welcome copy místo prázdné obrazovky.
  - [ ] Slow 3G throttle = skeletons zobrazené min 200 ms.
  - [ ] Simulovaný síťový fail → toast + retry button.
- **Size**: S (~3 h)
- **Demo**: Stanislavova matka otevře app bez dat → vidí hezký onboard.

### S18: Design review pass
- **Goal**: Full-product review proti brief + IA + tokens. Identifikovat polish gaps.
- **Scope**:
  - Spustit `/designer-skills:design-review` skill nad živým buildem.
  - Projít screenshoty v obou themech, všech role-specific views.
  - Vytvořit follow-up slices za kritické nálezy, zbytek do backlogu.
- **Dependencies**: S17 (všechny feature slicy + polish).
- **Acceptance criteria**:
  - [ ] `DESIGN_REVIEW.md` existuje.
  - [ ] Všechny nálezy severity *Critical* a *High* mají follow-up slice v `TASKS.md`.
- **Size**: S (~4 h)
- **Demo**: DESIGN_REVIEW.md + seznam follow-up slices.

---

## Out-of-phase backlog (V2+ kandidáti)

- Interaktivní klikatelný půdorys pozemku (SVG regions)
- Interaktivní půdorys domu s místnostmi
- Sdílený read-only link bez loginu (pro řemeslníky)
- User-editable lokace nad rámec fixního seznamu
- EN locale
- OG preview pro externí linky (fetch title + image)
- Push / email notifikace (pokud metrika B nefunguje)
- Multiple images per task
- Search fulltext
- Bulk operations (změna stavu víc tasků najednou)

---

## Fallback cut order (pokud se 85h limit přetíží)

Per brief (DISCOVERY 9 a §Fallback řezací pořadí):

1. **S08 Obrázky** — cut first (-6 h). App funguje jen s linky, obrázky "prostě nemáš".
2. **S15 i18n dokončení** — cut (-3 h). Stringy zůstanou neextrahované, EN locale bude refactor v V2.
3. **S10 Projektant role + rules** — cut (-8 h). Single-user mode: Stanislav posílá PDF přes WhatsApp, Projektant nelogguje. Manželka spoluvlastní.

Celkem možný reservoir řezů: ~17 h. Rozdíl 95 h - 85 h = 10 h → **bude stačit vyříznout S08 + S15** (= -9 h) pro rozumnou rezervu.

---

## Critical path — den-po-dni ambice

```
Week 0 (pre-spike):  PS (~8 h)
Week 1:              S01 (~10 h)
Week 2:              S02 (~8 h) + S03 (~4 h) = 12 h
Week 3:              S04 (~6 h) + S05 (~4 h) + S06 (~6 h) = 16 h
Week 4:              S07 (~4 h) + S08 (~6 h) + S09 (~3 h) = 13 h
Week 5:              S10 (~8 h) + S11 (~3 h) + S13 (~3 h) = 14 h
Week 6:              S12 (~10-14 h) + S14 (~4 h) = 14-18 h (risk)
Post:                S15/16/17/18 polish (~14 h, akceptovat že tohle může protéct přes deadline — app funguje i bez polish)
```

MVP v funkčním stavu do konce týdne 6 = **konec května 2026**.
Polish + review jdou na začátek června, ale brief říká Metrika B až po 90 dní — stihneme.

---

## Risks & mitigations (z brief §9, aktualizováno slicingem)

1. **Udržení denního návyku** → S01 + S14 společně vytvářejí < 5 s capture. Guardrail metrika *(14 dní bez Apple Notes)* měřitelná už po S02. Pokud selžeme tady, žádný další slice to nezachrání.
2. **Mobilní UX přeplněné** → North-star rule prosazována na každém slice (jedna primární akce). S04, S06, S07 jsou rizikové pro overload, v každém review ověřit.
3. **PDF export neznámá** → PS spike přenáší risk před S01. Pokud PS ukáže že CZ diakritika nejde bez velkého úsilí, S12 downgrade na čistý text export v PDF nepovinně.
4. **Nový risk (vyvolaný slicingem):** Phase 3 závislosti jsou hluboké (S10 blokuje S12 kvalitní usage pro PM). Pokud S10 je pozdě, Projektant nemá in-app answer, ale PDF plán B funguje → acceptable degradation.

---

*Brief: [DESIGN_BRIEF.md](./DESIGN_BRIEF.md)*
*IA: [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md)*
*Tokens: [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)*

---

# V2 — Phase 6: Feature expansion

**Generated from:** V2_DISCOVERY.md (2026-04-20)
**Estimate:** ~22h
**Status:** Approved, implementing.

### S23 — Title first-class field + list rewrite
- **Goal:** `task.title` je editable first-class pole; NapadCard v listu zobrazuje Title prominent + binární ikony pro image/link místo thumbnailu.
- **Scope:**
  - `Task.title` zůstává (už v schema), ale stane se prvním viditelným elementem v listu
  - TaskDetail: title input nad body textareou (plain text, dedikovaný)
  - Composer on save: first line → title, rest → body (unchanged)
  - NapadCard: title prominent (font-md font-medium), pak meta chips (Status, Category, Location), bez thumbnailu, **binární Image/Link indikátor** ikonami
- **Size:** S (~4h)

### S24 — Multi-images (array + gallery)
- **Scope:**
  - `Task.attachmentImages: { url, path }[]` nahradí single `attachmentImageUrl`/`attachmentImagePath`
  - Composer a detail: upload button přijímá multiple files (`<input multiple>`), iteruje přes sequence
  - TaskDetail: grid gallery 3-col (mobile 2-col), per-image delete X button, lightbox na click
  - Delete jediného obrázku smaže ze Storage + updatuje array
  - Breaking schema change — žádné production data, OK
- **Size:** M (~4h)

### S25 — Multi-links (array + chip list)
- **Scope:**
  - `Task.attachmentLinks: string[]` nahradí single `attachmentLinkUrl`
  - Composer link prompt může být volán opakovaně, každý call přidá URL
  - TaskDetail: vertical chip list s per-link edit + delete
  - NapadCard binární indikátor (má/nemá)
- **Size:** S (~2h)

### S26 — Multi-otázky from nápad
- **Scope:**
  - `Task.linkedTaskIds: string[]` nahradí single `linkedTaskId` — ale **obousměrná asymetrie**:
    - Nápad má `linkedTaskIds[]` (array otázek, které z něj vznikly)
    - Otázka má `linkedTaskId` (single string = nápad původce)
  - Convert flow: po konverzi nepreventuje další → button "Převést na další otázku" stále viditelný
  - TaskDetail na nápadu: stack "Vytvořené otázky" jako list linked karet
  - Migration: 0 data
- **Size:** M (~3h)

### S27 — Tiptap rich text editor (Markdown)
- **Scope:**
  - Install `@tiptap/react`, `@tiptap/starter-kit`, Markdown serializer
  - TaskDetail: body textarea → Tiptap editor s toolbar (Bold, Italic, BulletList, Headings H1/H2)
  - Storage: body jako **Markdown** string ve Firestore
  - Composer zůstává plain textarea (quick capture unchanged)
  - Lazy-load editor chunk na /t/:id (mimo main bundle)
  - Export: PDF + text clipboard render Markdown (pdfmake understands basic MD elements via custom handler; plain text export = já parsuji markdown do plain)
- **Size:** L (~5h)

### S28 — Browse by Location (grid + tabs)
- **Scope:**
  - New route `/lokace` — 2-col grid cards, seskupené podle LOCATION_GROUPS
  - Card = Location name + badge "X otevřených", tap → `/lokace/:id`
  - New route `/lokace/:id` — tabs **Nápady** / **Otázky**, každý tab list filter na daný `locationId`
  - Žádné další chips (status/category) per C.2 rozhodnutí
  - Tab bar u Shell přidá 4. tab "Lokace" (OWNER only), PM nadále jen Otázky + Více
- **Size:** M (~4h)

---

**Note:** Tyto slices staví na kompletním MVP (S01-S22). Každý je shipable standalone, ale S24/S25 mohou být paralel (pokud ne, ordering podle hodnoty/hodinu: S23 first pro list UX baseline).
