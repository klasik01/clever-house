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

### S27 — Tiptap rich text editor (Markdown) ✓
- **Scope:**
  - Install `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `tiptap-markdown` (přidáno do `package.json` — `npm install` na dev stroji)
  - `src/components/RichTextEditor.tsx` — React komponent s toolbar (H1, H2, Bold, Italic, BulletList), Placeholder, Markdown serializer, disabled=read-only mód (PM view)
  - TaskDetail (OWNER): body textarea → `<Suspense>` + `<RichTextEditor>` (lazy chunk na `/t/:id`)
  - TaskDetail (PM): question body rendering přes `<RichTextEditor disabled>` — zobrazí Markdown formátování
  - Storage: body jako **Markdown** string ve Firestore (stejné pole, žádná migrace — plain text je valid Markdown)
  - Composer zůstává plain textarea (quick capture unchanged, per B3)
  - Styling: `.cdv-editor .ProseMirror` rules v `globals.css` — h1/h2/ul/strong/em + placeholder
  - Export: PDF + text export neupraveno, Markdown marks zůstávají raw (čitelné)
- **Size:** L (~5h)

### S28 — Browse by Location (grid + tabs) ✓
- **Scope:**
  - `src/routes/Lokace.tsx` — 2-col grid cards seskupené podle `LOCATION_GROUPS`, každá karta: MapPin + label + badge "X otevřených" (počet tasks s `locationId = id && status ≠ "Hotovo"`, napříč oběma typy)
  - `src/routes/LokaceDetail.tsx` — route `/lokace/:id`, role=tablist s dvěma taby (Nápady / Otázky); každý tab ukazuje `TaskList` filtrovaný na `locationId + type + status ≠ "Hotovo"`
  - Žádné status/category filter chips (per C.2)
  - Shell bottom nav: přidán 4. tab "Lokace" s MapPin ikonou, pouze pro OWNER (PM má stále Otázky + Více)
  - `App.tsx`: `/lokace` a `/lokace/:id` routes + `LokaceForOwner` / `LokaceDetailForOwner` PM redirecty do `/otazky`
  - i18n: `tabs.locations`, `locations.pageTitle/pageHint/openCount/empty/emptyAll/tabNapady/tabOtazky/notFoundTitle/notFoundBody`, `aria.lokaceGrid/lokaceTabs/lokaceNapadyList/lokaceOtazkyList`
- **Size:** M (~4h)

---

**Note:** Tyto slices staví na kompletním MVP (S01-S22). Každý je shipable standalone, ale S24/S25 mohou být paralel (pokud ne, ordering podle hodnoty/hodinu: S23 first pro list UX baseline).

---

# Phase 7 — V3 Foundations + Vrstva A (Diskuse + Assignee)

**Generated from:** V3_DESIGN_BRIEF.md (2026-04-20), V3_INFORMATION_ARCHITECTURE.md, V3_DESIGN_TOKENS.md
**Total V3 slices:** 17 (S29–S45)
**Critical path:** S29 → S30 → S31 → S34 → S37 → S40 (~6 slices for „usable V3")
**First demoable V3 milestone:** S31 (komentáře fungují v detail otázky) — po 3 slice-ách je V3.0 core usable

### S29 — Schema + types + avatar component
- **Goal:** Přidat všechna V3 data pole do `Task` type, postavit `AvatarCircle` komponentu s 8-seed gradientem, wire tokens-v3.css do app.
- **Scope:**
  - `src/types.ts`: rozšířit `Task` o `priority?: "P1" | "P2" | "P3"`, `deadline?: number | null`, `assigneeUid?: string | null`, `categoryIds?: string[]`, `commentCount?: number`
  - Nový typ `Comment` (authorUid, body, createdAt, editedAt?, attachmentImages[], attachmentLinks[], mentionedUids[], reactions)
  - `src/lib/tasks.ts`: bridge helpers `bridgeCategoryIds()` (číst `categoryId` → `[categoryId]`), `bridgePriority()` (default `"P2"` pro existing otázky), extend `updateTask` patch shape
  - `src/components/AvatarCircle.tsx` — 8-seed gradient kruh s initials (viz V3_DESIGN_TOKENS.md §4), props: `uid`, `displayName`, `size="sm"|"md"|"lg"`
  - Kopie `tokens-v3.css` do `app/src/styles/`, `@import` v `globals.css`
  - i18n klíče: `priority.P1/P2/P3`, `deadline.soon/overdue/ok`, `comments.empty/title/composerPlaceholder`, `prehled.pageTitle`, `avatar.ariaLabel`
- **Out of scope:** Žádné UI, jen data + atomic component
- **Dependencies (blockedBy):** —
- **Acceptance criteria:**
  - [ ] `npm run typecheck` čistý
  - [ ] `<AvatarCircle uid="test" displayName="Stanislav Kasika" />` vyrenderuje kruh s iniciálami SK + gradient
  - [ ] `bridgeCategoryIds({categoryId: "x"})` vrací `["x"]`; `bridgeCategoryIds({categoryIds: ["a","b"]})` vrací `["a","b"]`
- **Size:** M (~4h)
- **Demo:** Storybook-like test page s 8 AvatarCircle instancemi pro ověření gradient rotace

### S30 — Komentář data layer + Firestore rules
- **Goal:** Subcollection `tasks/{id}/comments` CRUD + secure rules + realtime hook.
- **Scope:**
  - `firestore.rules`: allow `create` pokud `request.auth != null && request.resource.data.authorUid == request.auth.uid`; allow `update` / `delete` pokud `resource.data.authorUid == request.auth.uid`; allow `read` pro auth
  - `src/lib/comments.ts`: `createComment`, `updateComment` (jen body + editedAt), `deleteComment` (+ cascade delete ze Storage), `subscribeComments(taskId)`
  - `src/hooks/useComments.ts`: realtime hook, vrací `{ comments, loading, error }`
  - `tasks/{id}.commentCount` inkrementování přes batch write při create/delete (atomic counter pattern)
  - Po delete: iterovat `attachmentImages[]` → `deleteTaskImage(path)` per image
- **Out of scope:** UI (to je v S31)
- **Dependencies (blockedBy):** S29
- **Acceptance criteria:**
  - [ ] Rules emulator test: anonymous user nemůže číst ani psát
  - [ ] Rules emulator test: auth user A může napsat, nemůže editovat/mazat komentář usera B
  - [ ] Po `deleteComment`, ve Firebase Storage nezůstal žádný orphaned image path
  - [ ] `commentCount` na task dokumentu se inkrementuje při create a dekrementuje při delete
- **Size:** M (~4h)
- **Demo:** Firestore emulator s 2 test accounty, konzole ukáže úspěšné/zamítnuté ops podle rules

### S31 — Komentáře thread UI (bare)
- **Goal:** V detailu otázky i nápadu vidím vlákno komentářů a můžu napsat nový (text + obrázky + odkazy). Žádné mentions, reactions, edit — to v dalších slice-ách.
- **Scope:**
  - `src/components/CommentThread.tsx`: renderuje `<CommentItem>` per komentář + `<CommentComposer>` na vrcholu
  - `src/components/CommentItem.tsx`: AvatarCircle + displayName + `formatRelative(createdAt)` + body (plain markdown render jako text, bez rich-text editoru per B3) + attachments grid + actions (pokud autor = user.uid: Edit + Delete; Delete pro teď implementuj s window.confirm, hard delete)
  - `src/components/CommentComposer.tsx`: textarea + attach image (max 3) + attach link (max 10) + Send button; uses existing `browser-image-compression` + `uploadTaskImage`
  - `TaskDetail.tsx`: wire `<CommentThread taskId={task.id} />` do sekce „Diskuse ({count})" na konci detailu
  - i18n: `comments.edit`, `comments.delete`, `comments.confirmDelete`, `comments.send`, `comments.editing`, `comments.empty`
- **Out of scope:** @mention, emoji reactions, edit inline (pro teď delete + re-create stačí na začátek)
- **Dependencies (blockedBy):** S29, S30
- **Acceptance criteria:**
  - [ ] V detailu otázky vidím seznam komentářů seřazený asc by createdAt
  - [ ] Složím komentář s textem + 1 obrázkem + 1 odkazem, Send, komentář se objeví ve vláknu do 1s
  - [ ] Jako autor komentáře vidím Delete tlačítko; smazání ho odebere + commentCount klesne + obrázek zmizí ze Storage
  - [ ] Jako ne-autor nevidím Delete tlačítko
  - [ ] Empty state: „Zatím žádná diskuse. Napiš první komentář."
- **Size:** L (~6h)
- **Demo:** **V3.0 milestone** — user flow A z V3_INFORMATION_ARCHITECTURE funguje end-to-end: OWNER vidí, PM komentuje, OWNER odpovídá

### S32 — @mention autocomplete
- **Goal:** V composeru komentáře po napsání `@` → dropdown s users (filtrovaný) → vybraný user se vloží jako chip, `mentionedUids[]` se doplní.
- **Scope:**
  - `src/hooks/useUsers.ts`: realtime subscription na `users/` collection, cached users list
  - `src/components/MentionPicker.tsx`: popover autocomplete na caret position v textarea
  - `src/lib/mentions.ts`: parser pro markdown `@[Name](uid)` ↔ render chip s `--color-comment-mention-bg` badge
  - Uložit do `mentionedUids[]` na save, render v `CommentItem` jako clickable chip (pro teď jen text, budoucí V4 klikne → scroll na `/prehled?filter=waiting-me`)
  - i18n: `mentions.typeToSearch`, `mentions.noResults`
- **Out of scope:** notifikace (V4), cross-workspace user search (jen lokální collection)
- **Dependencies (blockedBy):** S31
- **Acceptance criteria:**
  - [ ] Napíšu `@st` v composeru, otevře se popover s match `Stanislav Kasika`
  - [ ] Enter nebo tap → chip se vloží, `mentionedUids` obsahuje Stanislav's uid
  - [ ] Po send se chip renderuje v komentáři s `--color-comment-mention-bg`
  - [ ] Popover zmizí po Escape
- **Size:** M (~4h)
- **Demo:** OWNER napíše komentář s `@PM`, PM ve vláknu uvidí mention chip (zvýrazněný)

### S33 — Emoji reactions
- **Goal:** Pod každým komentářem tlačítko 🙂+ → emoji picker → reakce se uloží pod `reactions[emoji]`. Reakce se zobrazují jako pill-counter; tap na pill toggle.
- **Scope:**
  - `src/components/ReactionBar.tsx`: seznam existujících reakcí (pills) + + button
  - Emoji sada: minimalistická — 👍 ❤️ 😄 🎉 😕 (5 voleb, ne full picker)
  - `src/lib/comments.ts`: `toggleReaction(taskId, commentId, emoji, uid)` přes Firestore transaction (atomic)
  - Data shape: `reactions: { "👍": ["uid1","uid2"], "❤️": ["uid3"] }`
  - Active state: pokud `reactions[emoji].includes(user.uid)`, pill má `--color-comment-reaction-active-bg`
  - i18n: `reactions.add`, `reactions.remove`
- **Out of scope:** Full emoji picker (Unicode 15 palette zbytečné pro V3), animace
- **Dependencies (blockedBy):** S31
- **Acceptance criteria:**
  - [ ] Tap na 🙂+ u komentáře → 5 emoji voleb → tap 👍 → pill se zobrazí s count=1
  - [ ] Tap na svůj active pill → reakce se odebere, pill zmizí
  - [ ] Tap na ne-active pill → přidá mě, count++
  - [ ] Active state je vizuálně odlišný od neaktivního (fg color + bg)
- **Size:** M (~3h)
- **Demo:** PM přidá 👍 na OWNER komentář, OWNER vidí realtime update

### S34 — Assignee field + dropdown + avatar v listu
- **Goal:** Otázka má viditelného „kdo je teď na tahu" v detail + list kartě; OWNER může změnit přes dropdown.
- **Scope:**
  - `src/components/AssigneeSelect.tsx`: dropdown s users z `useUsers`, current selection zobrazená jako AvatarCircle + "Změnit" tlačítko vedle
  - `TaskDetail.tsx`: přidat do meta-row sekce (nad Status) label „Řeší" + `<AssigneeSelect>`, volatelný přes `updateTask({ assigneeUid })`. Edit právo jen autor.
  - `NapadCard.tsx`: přidat AvatarCircle size="sm" v pravém horním rohu karty pokud `task.assigneeUid != null`
  - i18n: `detail.assignee`, `detail.assigneeChange`, `detail.assigneeNone`
  - Default pro existing otázky (migrace): `assigneeUid` = UID původního PM (read z `workspace/config` — pokud neexistuje, fallback na `createdBy`)
- **Out of scope:** „Hodit zpět na autora" as 1-tap button (implementováno v S37 jako součást /prehled workflow)
- **Dependencies (blockedBy):** S29
- **Acceptance criteria:**
  - [ ] V detailu otázky vidím avatar + jméno aktuálního assignee + „Změnit" link
  - [ ] Tap „Změnit" → dropdown s workspace users → výběr → `assigneeUid` se změní
  - [ ] Na kartě v listu vidím malý avatar v pravém horním rohu
  - [ ] Jako ne-autor nevidím možnost změnit (dropdown je disabled / skrytý)
- **Size:** M (~4h)
- **Demo:** **V3.0 Vrstva A kompletní** — user flow A kompletní včetně přehození odpovědnosti

---

# Phase 8 — Vrstva B (Triage + /prehled)

### S35 — Priority badge + picker (otázka only)
- **Goal:** Otázka má viditelnou prioritu P1/P2/P3 v detail i list; OWNER může měnit.
- **Scope:**
  - `src/components/PrioritySelect.tsx`: 3-button segmented control s V3 tokens (`--color-priority-p[1-3]-*`)
  - `src/components/PriorityBadge.tsx`: čtená varianta, 1 pill s dotem + textem „P1"
  - `TaskDetail.tsx`: meta-row sekce přidá PrioritySelect (jen pro type="otazka", autor)
  - `NapadCard.tsx`: PriorityBadge vlevo vedle title pokud task.priority && task.type === "otazka"
  - i18n: `priority.P1/P2/P3`, `priority.label`
- **Out of scope:** Sort by priority v listech (může být v polish phase)
- **Dependencies (blockedBy):** S29
- **Acceptance criteria:**
  - [ ] Otázka v detailu má segmented control se 3 volbami
  - [ ] Výběr P1 → badge v listu se zobrazí červeným zemitým tónem
  - [ ] Nápad nemá prioritu viditelnou nikde
  - [ ] Priority chip má ikonu + text (ne jen barvu) — WCAG 1.4.1
- **Size:** S (~2h)
- **Demo:** 3 test otázky P1/P2/P3, všechny viditelné jednou v listu

### S36 — Deadline field + picker + countdown chip
- **Goal:** Otázka má volitelný deadline, v listu se zobrazuje countdown chip s barevnou eskalací.
- **Scope:**
  - `src/components/DeadlinePicker.tsx`: native HTML `<input type="date">` + clear button, formát `YYYY-MM-DD`
  - `src/lib/deadline.ts`: `formatCountdown(deadline)` → „za 3 dny", „zítra", „dnes", „po termínu 2 dny"; `deadlineState(deadline)` → `"ok"|"soon"|"overdue"`
  - `src/components/DeadlineChip.tsx`: Clock icon + countdown text, color podle state z tokens-v3.css
  - `TaskDetail.tsx`: meta-row přidá DeadlinePicker (otazka only, autor only)
  - `NapadCard.tsx`: DeadlineChip vedle PriorityBadge pokud má deadline
  - i18n: `deadline.label`, `deadline.none`, `deadline.today/tomorrow/inDays/pastDays`
- **Out of scope:** Time-of-day precision (jen datum; deadline = konec dne)
- **Dependencies (blockedBy):** S29
- **Acceptance criteria:**
  - [ ] Otázka v detailu má date input + clear X
  - [ ] Deadline = tomorrow → chip „Zítra" s warning barvou
  - [ ] Deadline = -1 day → chip „Po termínu 1 den" s danger barvou
  - [ ] Deadline = +5 days → chip „Za 5 dní" s neutral barvou
  - [ ] Nápad nemá deadline viditelný
- **Size:** M (~3h)
- **Demo:** List otázek s různými deadline states — všechny barvy viditelné

### S37 — /prehled dashboard
- **Goal:** Nová stránka `/prehled` s 4 sekcemi a M2 banner; klíčová pro Q3 success metric.
- **Scope:**
  - `src/routes/Prehled.tsx`: nová route v App.tsx
  - 4 count tiles (mobile 2×2 grid): Čeká na mě / Čeká na jiné / Po deadline / Uvízlé ≥5 dní
  - URL param `?filter=stuck|overdue|waiting-me|waiting-others` — default `waiting-me`
  - Tabs nad listem přepíná filter state (URL query param driven)
  - M2 banner nahoře: zelený pokud Uvízlé ≤3, červený jinak
  - `TaskList` reuse s computed filtered tasks
  - Skeleton / empty / error states
  - i18n: všechny klíče `prehled.*`
- **Out of scope:** Time-series graf (jen current snapshot), user per-assignee breakdown
- **Dependencies (blockedBy):** S29, S34, S36
- **Acceptance criteria:**
  - [ ] `/prehled` loaduje bez chyby, ukáže 4 tiles + list defaultně „Čeká na mě"
  - [ ] Tap tile → filter se přepne, URL se updatne na `?filter=X`
  - [ ] Deep-link `/prehled?filter=stuck` rovnou aktivuje sekci Uvízlé
  - [ ] M2 banner: 0–3 uvízlých = zelený; 4+ = červený
  - [ ] Empty state per sekci funguje („Zatím na tobě nic není. Dobrá práce.")
- **Size:** L (~5h)
- **Demo:** Seed 5 test otázek — různé assigneeUid, deadline, status → /prehled ukáže 4 tiles + list správně

### S38 — Nastavení: Přehled card + link
- **Goal:** Na vrcholu `/nastaveni` velká karta „Přehled" s mini counters; tap → `/prehled`.
- **Scope:**
  - `Settings.tsx`: přidat kartu nahoru s 3 mini counts (Čeká na mě, Po deadline, Uvízlé)
  - Link na `/prehled` (celá karta clickable)
  - Použije `useTasks` + stejné compute funkce jako S37
  - i18n: `settings.prehledCard.title/hint`
- **Out of scope:** —
- **Dependencies (blockedBy):** S37
- **Acceptance criteria:**
  - [ ] Nastavení má na vrcholu kartu s title „Přehled" + 3 mini counters
  - [ ] Tap karta → navigate `/prehled`
- **Size:** S (~1h)
- **Demo:** Ranní ritual flow — user otevře app, tap Více → vidí počty → tap → /prehled

### S39 — Otázky header: Uvízlé pill + group-by tabs
- **Goal:** V `/otazky` header má „Uvízlé (N)" pill → navigate na /prehled?filter=stuck, a tabs pro group-by Lokace/Kategorie/Plochý.
- **Scope:**
  - `Otazky.tsx`: přidat pill vpravo od H2 header
  - Group-by tabs nad filter chips row
  - URL param `?group=lokace|kategorie|flat` (default `flat`)
  - Když group ≠ `flat`, list se rozděluje do sekcí per group
- **Out of scope:** Same group-by v /napady (odložit do S41)
- **Dependencies (blockedBy):** S29, S37
- **Acceptance criteria:**
  - [ ] V `/otazky` vidím pill „Uvízlé 2" (pokud existují), tap → navigate `/prehled?filter=stuck`
  - [ ] Přepínám tabs → list se skupinuje jinak, URL se updatuje
  - [ ] Group „Lokace" → sekce jsou LOCATION_GROUPS s nadpisy, uvnitř tasks
  - [ ] Reload page s `?group=kategorie` obnoví state
- **Size:** M (~3h)
- **Demo:** Různé kombinace group-by × filter se renderují správně

### S40 — Kategorie jako multi-badge (N:M migrace)
- **Goal:** Task má `categoryIds[]` místo `categoryId`, v detailu chip-field multi-select, v listech multi-badge.
- **Scope:**
  - `CategoryPicker.tsx`: rewrite na chip-field — array of selected chips + dropdown add. Tap chip → remove. Max neomezené.
  - `src/lib/tasks.ts`: breaking migration (0 prod data) — `categoryId` field se přestane používat, `bridgeCategoryIds()` čte legacy pokud existuje
  - `NapadCard.tsx`: render all `categoryIds` jako malé badges pod title (max 3 visible, +N indicator)
  - i18n: `categories.addMore`, `categories.selected`
- **Out of scope:** —
- **Dependencies (blockedBy):** S29
- **Acceptance criteria:**
  - [ ] V detailu CategoryPicker ukazuje všechny selected jako chipy + add button
  - [ ] Tap add → dropdown s unselected cats → přidá další chip
  - [ ] Tap chip X → odebere
  - [ ] V listu vidím všechny kategorie tasku jako small badges (max 3 + „+N")
  - [ ] Legacy task s `categoryId` se čte správně (bridge funguje)
- **Size:** M (~3h)
- **Demo:** Vytvořit task se 4 kategoriemi, v listu vidět 3 viditelné + „+1"

---

# Phase 9 — Vrstva C (Navigation UX)

### S41 — Group-by tabs + Lokace mirror do /napady + /lokace/:id
- **Goal:** Stejný group-by přepínač i v ostatních listech.
- **Scope:**
  - `Home.tsx` (v `/napady`): stejné tabs Lokace/Kategorie/Plochý jako S39
  - `LokaceDetail.tsx` (v `/lokace/:id`): přidat sub-tabs pro Kategorie uvnitř tab Otázky (vnořené — tab Otázky má dole select Kategorie)
  - Alternativa pro `/lokace/:id` jednoduší: ponech jen Nápady/Otázky tabs, neaplikuj category group (jinak nested zmatek)
- **Out of scope:** Remember last group-by cross-route (každá route má vlastní URL state)
- **Dependencies (blockedBy):** S39, S40
- **Acceptance criteria:**
  - [ ] `/napady?group=lokace` sekce per LOCATION_GROUPS
  - [ ] `/napady?group=kategorie` sekce per category, tasks bez kategorie = sekce „Bez kategorie"
  - [ ] `/lokace/:id` beze změny (ne-applicable, lokace už je selected)
- **Size:** S (~2h)
- **Demo:** 3 routes × 3 group-by states — všechny fungují

### S42 — Reset filter button
- **Goal:** V listech tlačítko „Reset" které vymaže filter state + localStorage.
- **Scope:**
  - `FilterChips.tsx`: přidat X button za chipy, visible jen když alespoň 1 filter aktivní
  - `src/lib/filters.ts`: přidat `clearAllFilters(key)` který maže status + category + location localStorage keys
  - Aplikovat v `Home.tsx`, `Otazky.tsx`
- **Out of scope:** Per-chip X (cluttering)
- **Dependencies (blockedBy):** —
- **Acceptance criteria:**
  - [ ] Když je aktivní aspoň 1 filter, vidím X pill vpravo
  - [ ] Tap X → všechny filtery se resetují, localStorage se maže, list ukáže všechny tasks
  - [ ] Když žádný filter není aktivní, X pill není vidět
- **Size:** S (~1h)
- **Demo:** Vyberu status + category → X pill se objeví → tap → všechno čisté

---

# Phase 10 — V3 Hardening + Polish

### S43 — Offline guards
- **Goal:** Když je offline, composer komentáře a upload blokuje s hláškou (žádný silent fail).
- **Scope:**
  - `src/hooks/useOnline.ts`: `navigator.onLine` state + online/offline event listeners
  - `CommentComposer.tsx`: disabled když offline, hláška „Nejsi online, zkus později" (inline)
  - `uploadTaskImage` wrapper: reject s `OfflineError` když offline
  - Stejné pro task body editace v detail (existing tasks → noop? anebo guard taky)
- **Out of scope:** Queue & replay offline ops (Firestore native offline cache přesto drží data pro read-only)
- **Dependencies (blockedBy):** S31
- **Acceptance criteria:**
  - [ ] Dev tool → offline → composer je disabled + hláška viditelná
  - [ ] Back online → composer znovu active (bez reloadu)
  - [ ] Attach image offline → toast „Připoj se ke WiFi pro nahrání"
- **Size:** S (~2h)

### S44 — Design review pass V3.0
- **Goal:** Spustit `design-review` skill na live buildu po shipu S29–S34 (Vrstva A kompletní).
- **Scope:**
  - Playwright screenshots z /t/:id, /prehled, /otazky, /lokace/:id v obou themes
  - Audit proti V3_DESIGN_BRIEF.md Definition of Done
  - Finding dokument `V3_DESIGN_REVIEW.md` s findings kategorie kritické/střední/drobné
  - Každá kritická finding → nová slice v tomto TASKS.md (S45a, S45b, …)
- **Dependencies (blockedBy):** S34 (po Vrstvě A)
- **Acceptance criteria:**
  - [ ] `V3_DESIGN_REVIEW.md` existuje s alespoň 5 findings kategorizovanými
  - [ ] Každá kritická finding má follow-up slice v tomto souboru
- **Size:** M (~3h)

### S45 — Performance pass (comment pagination)
- **Goal:** Pokud task má >50 komentářů, paginate; lazy-load obrázky; limit initial fetch.
- **Scope:**
  - `useComments` — limit initial 50, „Načíst starší" button pro pagination
  - Image lazy-load pomocí `loading="lazy"` (už existuje)
  - Bundle size check: Tiptap + pdfmake + Firebase — main chunk <300KB gzipped
- **Dependencies (blockedBy):** S31
- **Acceptance criteria:**
  - [ ] Task s 100 komentáři renderuje <1s FCP na mobile 3G throttle
  - [ ] Main bundle <300KB gzipped
- **Size:** M (~3h)

---

## V3 Critical path

**Minimální "usable V3" (V3.0):** S29 → S30 → S31 → S34 (~17h). Po tomto bodu má OWNER + PM funkční diskuzní flow. Vše ostatní iteruje na polished UX a triage.

**Full V3 ship:** S29 → S30 → S31 → S32 → S33 → S34 → S35 → S36 → S37 → S38 → S39 → S40 → S41 → S42 → S43 → S44 → S45 (~55h, ~7 dní při 8h/den).

## V3 Out-of-phase backlog (V4+)

- Push notifications
- Email notifications
- Invite flow (pozvat user emailem)
- Sort-by-priority / sort-by-deadline v listech
- Bulk operations (mark multiple as Hotovo)
- Activity log na tasku (kdo kdy co změnil)
- `/prehled` time-series graf (uvízlé per week)
- Comments export v PDF / text

## V3 Risks & mitigations (z BRIEF §9, aktualizováno po TASKS)

1. **UI overload** — Mitigace: povinný design-review (S44) po Vrstvě A před shipem B. Každá slice v Phase 8-9 musí projít self-test „dává mi tohle větší mentální zátěž než užitek?"
2. **Polo-mention bez notifikací** — Mitigace: onboarding toast při prvním use `@` v V3.0 „Pozn.: notifikace dorazí v další verzi, tagnutý uživatel se to dozví při otevření app"
3. **PM adoption** — Mitigace: M2 metrika na /prehled, pokud za 2 týdny po shipu V3.0 je M2 > 3 trvale → spustit V4 notifikace napříč bez čekání na Vrstvu C

## Recommended slicing strategy

- Ship **S29–S34 as V3.0 bundle** (možná v 1 velkém PR se všemi V3 základy) — uživatelsky kompletní diskusní flow
- Design-review (S44) jako stop-gate před Vrstvou B
- **Vrstva B (S35–S40) incremental** — každá slice samostatný PR, merguj průběžně. User okamžitě vidí priority, deadline, /prehled
- **Vrstva C (S41–S42) jako drobné enhancementy** — nízké priority, merg kdy je čas

---

## V3.0 Polish bundle (post-design-review)

Findings z `V3_DESIGN_REVIEW.md` (2026-04-21). Všech 5 slices shipuje jako 1 commit.

### S31a — Composer keyboard shortcuts ✓
- **Goal**: Cmd/Ctrl+Enter send z textarea.
- **Scope**: `CommentComposer.tsx` onKeyDown handler.
- **Size**: XS (~30min)

### S31b — Composer mobile touch targets ✓
- **Goal**: Remove X buttons na staged images mají 44×44 hit area.
- **Scope**: `size-5` → `size-8` nebo `::after` extended hit zone.
- **Size**: XS (~20min)

### S31c — Focus-visible border na textarea ✓
- **Goal**: Keyboard user vidí focus.
- **Scope**: `focus:border-line-focus` na composer textarea.
- **Size**: XS (~10min)

### S31d — Comment edit labels i18n fix ✓
- **Goal**: „Uložit změny" / „Zrušit" správné akční verby.
- **Scope**: cs.json `comments.saveEdit`, `comments.cancel`; CommentItem 2 line change.
- **Size**: XS (~15min)

### S43a — `useOnline` hook (přetáhnuto ze S43) ✓
- **Goal**: Reaktivní offline detection s event listeners.
- **Scope**: `src/hooks/useOnline.ts`, wire do CommentThread.
- **Size**: S (~1h)

