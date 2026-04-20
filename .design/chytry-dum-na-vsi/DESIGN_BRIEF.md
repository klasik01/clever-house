# Chytrý dům na vsi (Clever house) — Design Brief

**Date**: 2026-04-20
**Author**: Stanislav Kasika
**Status**: Draft

---

## 1. Problem Statement

Stanislav staví svůj první dům a během plánování ho denně napadají věci, které chce v domě mít, a otázky, které potřebuje zodpovědět od Projektanta. Dnes je zapisuje roztříštěně do Apple Notes, debatuje ústně s manželkou a posílá otázky přes WhatsApp. Nemá jedno místo, kam by přidal obrázek z Instagramu, odkaz na e‑shop, text a stav rozhodnutí současně — a proto mu hrozí, že na rozhodnutí zapomene nebo ho nedořeší včas pro konkrétní milník stavby (odevzdání projektu, předávka etapy řemeslníkům).

---

## 2. Primary User

**Stanislav** — technicky zdatný stavebník svého prvního domu, telefon má neustále u sebe, nápady přicházejí mimo pracovní stůl: při scrollování IG, při procházení pozemku, při řešení konkrétní místnosti nad projektem Projektanta. Jediný reálný autor záznamů.

*Konkrétní scénář:* Večer na gauči koukal na návrh pracovny a uvědomil si, že chce LED osvětlení ve stěně → potřebuje zapsat, že musí nachystat kabely. O hodinu později uvidí na IG zahradní zásuvku na hadici v zemi → chce si ji uložit s obrázkem a odkazem pro řešení zavlažování. Příští středu má schůzku s Projektantem a potřebuje předložit seznam otevřených otázek — včetně toho, co ho napadalo celý týden.

**Sekundární uživatelé:** manželka (OWNER "pro případ", primárně jen čte), Projektant (PROJECT_MANAGER — čte otázky, odpovídá v poli `projektantAnswer`, sám může klást doplňující otázky).

---

## 3. Success Metrics

- **Primary**: Před každou schůzkou s Projektantem má Stanislav **>95 % otevřených otázek** ve stavu *Rozhodnuto*, *Hotovo* nebo s vyplněnou odpovědí. Cíl splněn do **30. června 2026** (tj. cca 30 dní reálného provozu po spuštění).
- **Secondary**: Při předávce dané etapy stavby řemeslníkům mají **100 % úkolů** týkajících se té části domu/pozemku stav *Rozhodnuto*, *Ve stavbě* nebo *Hotovo*. Cíl splněn při **první předávce** v průběhu stavby.
- **Guardrail**: Stanislav **neotevírá Apple Notes pro stavební poznámky** po dobu **14 po sobě jdoucích dní**. Pokud tento práh pokles­ne, app má friction problém a vyžaduje redesign capture flow.

---

## 4. Scope

### In scope (v1 — MVP, deadline konec května 2026)
- Quick capture z mobilu (text) jako **primární akce**
- Dva typy záznamu: **Nápad** a **Otázka pro Projektanta** (jedna Firestore collection, `type` pole, volitelný `linkedTaskId` pro převod)
- Přílohy: externí odkaz, obrázek
- Stavy: *Nápad · Otázka · Čekám · Rozhodnuto · Ve stavbě · Hotovo*
- **Uživatelsky editovatelné** kategorie + fixní seznam lokací (21 položek, viz DISCOVERY 5.4)
- Firebase Auth + role (OWNER, PROJECT_MANAGER)
- Multi-user sync (Firestore)
- Export otevřených otázek do **PDF s českou diakritikou** a obrázky (plán B pro Projektanta)
- **Dark mode** (nutné pro noční capture)
- i18n wrapper `t()`, CZ-only locale v MVP
- WCAG AA baseline
- PWA instalovatelná na home-screen, otevírá se na **quick-capture obrazovce**

### Out of scope (odloženo do V2)
- Interaktivní klikací půdorys pozemku (SVG z PDF Projektanta)
- Interaktivní půdorys domu s místnostmi
- Sdílený read-only link bez přihlášení (pro řemeslníky)
- Uživatelsky editovatelné lokace nad rámec fixního seznamu
- EN locale

### Explicit non-goals
- **Nestaví se AI analýza a souhrn** — pro 3 uživatele a MVP scope by neřekla nic, co neřekne filtrovaná tabulka. Plýtvá tokeny nad nekonzistentními daty.
- **Nestaví se komentářové vlákno** pod taskem — stačí jedno pole `projektantAnswer`.
- **Nestaví se push / email notifikace** — Projektant dostane WhatsApp zprávu mimo app, web push na iOS v PWA je neproporční úsilí.
- **Není to offline app** — všude je signál, pokud ne, app se prostě neotevře.
- **Není to nativní iOS app** — PWA stačí pro 3 uživatele a hobby rozpočet.

---

## 5. Constraints

- **Timeline**: MVP musí být použitelný **před dokončením projektu domu u Projektanta (konec května 2026, ~6 týdnů od dnešního data)**. Fallback: pokud se nestihne, Stanislav se vrací k Apple Notes + ruční PDF.
- **Budget**: **0 Kč/měs** — Firebase free tier. Vývoj je hobby, žádná externí výdajová položka.
- **Tech stack**: React + Tailwind + CSS Modules (frontend), Firebase Auth + Firestore + Firebase Storage (backend), Netlify (prod hosting), GitHub Pages (dev). **PDF export = TBD**, prototypovat v prvním týdnu.
- **Accessibility**: WCAG AA baseline (kontrast ≥4.5:1, tap targets ≥44×44 px, focus stavy, podpora systémové velikosti písma). Žádné speciální potřeby uživatelů.
- **Brand / legal / regulatory**: Žádné. In-family use, data v Google Cloud OK. Barevná paleta daná referencí kuchyně (olivová RAL 6013, Stone Beige, dub).
- **Team**: Solo (Stanislav). Kapacita **~14 h/týden** (3–4 h/den × 4 dny). Celkem **~85 h** do deadlinu — napjaté a přijaté jako risk.

---

## 6. Tone & Aesthetic

- **Feel (3 adjectives)**: **Klidná · promyšlená · domácí.**
- **Reference products**:
  - **Apple Notes** — jednoduchost, minimum rušivých prvků, rychlost psaní. Benchmark pro cleanliness a capture speed.
  - **Notion** — struktura (databáze, filtry, přílohy), ale vědomě zjednodušená — pro Stanislava je Notion "moc složitý".
- **Anti-references**:
  - **Trello** — generický kanban pro agilní týmy, špatná metafora pro ucelování osobních nápadů. Kanban **není** primární view.
- **Named aesthetic philosophy**: **Apple-HIG inspired, warm earth palette.** Mobile-first iOS-style idiomy (bottom sheet, FAB, pull-to-refresh, native segmented controls), ale zteplené zemitou paletou (olivová RAL 6013 jako accent, Stone Beige jako neutral, dub jako warm touch). **Ne** studený techno-look, **ne** hravý barevný design. Final výběr paletového mapování → `design-tokens`.

---

## 7. Content & Data

- **Co existuje**: Stanislavovy poznámky v Apple Notes (budou ručně přepsány, žádný automatizovaný import). PDF půdorysy od Projektanta (pro V2).
- **Co chybí**: Seedová data kategorií (11 položek z DISCOVERY 5.3) a lokací (21 položek z DISCOVERY 5.4) — vytvořit jako inicializační skript / Firestore seed při prvním loginu.
- **Kdo vlastní**: Stanislav (OWNER) je vlastník všech dat. Manželka sdílí, Projektant má read access na otázky + write na `projektantAnswer`. Data žijí v Google Cloud (Firestore, Storage) na Stanislavově Firebase projektu.

---

## 8. Competitors & References

| Product | What we match | What we avoid |
|---------|---------------|---------------|
| **Apple Notes** | Rychlost capture, minimalismus, rychlé přílohy (obrázek, link) | Plochá struktura — chybí kategorie/stavy/filtry |
| **Notion** | Typed entita s poli, filtry podle kategorií a stavů | Hluboké nested stránky, drag-and-drop bloky, steep learning curve |
| **Trello** | *nic* — odmítnuto jako reference | Kanban sloupce jako primární view; orientace na týmové workflow |
| **Milanote** *(futureproof inspiration)* | Vizuální treatment příloh (obrázek jako občan první třídy) | Mood-board chaos bez filterování |
| **Obsidian** *(futureproof inspiration)* | Linkování mezi záznamy (vazba nápad ↔ otázka) | Markdown-first; pro non-dev stavebníka bariéra |

---

## 9. Risks & Unknowns

1. **Udržení denního návyku.** *Likelihood: High · Impact: Critical · Mitigation:* Capture flow pod 5 sekund od tapu na home-screen ikonu po uložený záznam. Zero-config capture (kategorie/lokace nepovinné, doplní se později). Persistent login. Měřeno Guardrail metrikou — Stanislav 14 dní bez Apple Notes.
2. **Mobilní UX přeplněné při 13 MVP featurách.** *Likelihood: Medium · Impact: High · Mitigation:* North-star design rule — **jedna primární akce na obrazovku**, max 2 úrovně navigace, sekundární akce za FAB / bottom sheet. Validovat v `design-review` proti Apple Notes jako benchmark.
3. **PDF export je neznámá technologie neznámého rozsahu.** *Likelihood: Medium · Impact: Medium · Mitigation:* Prototype spike v prvních 1–2 dnech: jsPDF + Roboto font embed pro diakritiku, fallback pdfmake / @react-pdf/renderer. Deliverable: jednostránkové PDF s 3 fake otázkami s háčky/čárkami a 1 obrázkem. Rozhodnutí před začátkem MVP vývoje.

---

## 10. Open Questions

- [ ] **PDF knihovna** — `jsPDF` s ručním embed fontu, `pdfmake` s vestavěným Unicode, nebo `@react-pdf/renderer`? Rozhoduje se v prototype spike v týdnu 1.
- [ ] **Projektantova ochota psát v appce** — potvrzeno Stanislavem ("je to nadšenec"), ale reálný commitment zvalidovat při prvním použití. Pokud ne, plán B = PDF export + odpověď přes WhatsApp + ruční přepis do appky.
- [ ] **Paletové mapování** — olivová RAL 6013 jako accent / primary? Funguje v dark mode s dostatečným kontrastem? → `design-tokens`.
- [ ] **Timing V2 půdorysu** — po MVP a začátku stavby? Nebo po první předávce? Nechat otevřené, rozhodne se podle reálného používání MVP.
- [ ] **Seed data strategie** — kategorie/lokace přes migration script, nebo při prvním loginu uživatele? → `information-architecture`.

---

## 11. Definition of Done

MVP je hotový, když auditor může projít tento seznam a odpovědět *yes* na každou položku:

- [ ] Stanislav otevře app tapnutím ikony na home-screen iPhone + Android a **do 5 sekund** je záznam uložen s minimálně textem.
- [ ] Quick-capture obrazovka je **první view** po otevření appky (ne dashboard, ne seznam).
- [ ] Záznam typu "Nápad" lze převést na "Otázku pro Projektanta" jedním tapnutím; původní nápad zůstává a vazba `linkedTaskId` je uložena.
- [ ] K záznamu lze připojit **externí link** a **obrázek** (oboje volitelné).
- [ ] Stanislav může **vytvořit, přejmenovat a smazat kategorii** bez deploye; kategorie funguje v filteru.
- [ ] Filtrování podle **stavu, kategorie a lokace** funguje a výsledky se aktualizují live (Firestore sync).
- [ ] Projektant po loginu **vidí pouze otázky** (ne nápady), může vyplnit **pole odpověď**, nemůže založit nový task, ale může přidat doplňující otázku.
- [ ] **Export PDF otevřených otázek** vygeneruje korektně české znaky (háčky a čárky čitelné), zahrnuje obrázky a lze ho stáhnout nebo sdílet z mobilu.
- [ ] **Dark mode** se přepne podle systémového nastavení; kontrast splňuje WCAG AA v obou režimech.
- [ ] App je instalovatelná jako **PWA** v Safari i Chrome (přidat na plochu → otevírá se ve standalone módu).
- [ ] Všechny interaktivní prvky mají **tap target ≥44×44 px** a viditelný **focus state**.
- [ ] Stringy jsou obaleny `t('key')` wrapperem; aplikace běží plně **v češtině**.
- [ ] Stanislav používá aplikaci **14 po sobě jdoucích dní** bez návratu k Apple Notes pro stavební poznámky (měří se osobně, bez instrumentace v MVP).
- [ ] Splněn **Primary metric**: před schůzkou s Projektantem >95 % otevřených otázek zodpovězených/rozhodnutých.

---

*DISCOVERY odkaz: [.design/chytry-dum-na-vsi/DISCOVERY.md](./DISCOVERY.md)*
