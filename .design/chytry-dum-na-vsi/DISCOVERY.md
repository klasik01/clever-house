# DISCOVERY — Chytrý dům na vsi (Clever house)

> Výstup z interview `grill-me`.
> Datum: 20. dubna 2026
> Vlastník: Stanislav Kasika (stanislav.kasika@gmail.com)

---

## TL;DR

### Problem Statement
Stanislav staví svůj první dům a během procesu ho napadají desítky věcí, které chce v domě mít, otázek pro Projektanta a inspirací z internetu. Dnes si je roztříštěně zapisuje do Apple Notes, posílá přes WhatsApp Projektantovi a řeší ústně s manželkou. Ztrácí v tom přehled, nemá centrální místo pro obrázky, linky a stavy rozhodnutí a riskuje, že na důležitou věc zapomene, nebo ji nedořeší včas pro daný milník stavby.

### Primary User
**Stanislav** (OWNER) — majitel a stavebník, technicky zdatný, telefon pořád u sebe, jediný reálný autor záznamů. Manželka je sdílený OWNER "pro případ", ale reálně zapisuje jen Stanislav. Projektant je sekundární uživatel v roli PROJECT_MANAGER — čte, odpovídá, doptává se.

### Success Metric (za 90 dní po spuštění)
1. **B — před každou schůzkou s Projektantem má >95 % otevřených otázek zodpovězených nebo rozhodnutých.**
2. **C — při předávce etapy řemeslníkům mají všechny úkoly týkající se dané části domu/pozemku stav *vyřešeno* nebo *specifikováno*.**

### Top 3 Risks
1. **Udržení denního návyku.** Pokud bude friction při capture byť jen o něco vyšší než u Apple Notes, Stanislav se vrátí k Apple Notes a app umře po měsíci. → Quick capture musí být **stejně rychlý nebo rychlejší** než Notes.
2. **Mobilní UX přeplněné.** MVP obsahuje 10+ featur a Stanislav v Bloku 9.2 explicitně zmiňuje obavu ze zmatečného mobilního UI. → North-star rule: **jedna primární akce na obrazovku**, vše ostatní v druhé úrovni.
3. **Napjatá timeline + neznámý PDF export.** ~85 hodin kapacity pro kompletní MVP je těsné. Stanislav explicitně nezná nástroje pro PDF generování z Reactu → je to neznámá o neznámém rozsahu času. PDF export je kandidát na první prototype (viz 9.3).

---

## Blok 1 — Problém a výsledek

**1.1 — Jaký problém app řeší (v jedné větě)?**
Během stavby svého prvního domu má Stanislav nápady, obrázky, linky a otázky pro Projektanta roztříštěné v Apple Notes, WhatsAppu a hlavě — ztrácí se v tom a riskuje, že na důležitou věc zapomene, nebo ji neodkomunikuje včas.

**1.2 — Pro koho?**
- **OWNER (2):** Stanislav + manželka. Reálně píše jen Stanislav, manželka je sdílený OWNER "pro případ / kdyby chtěla".
- **PROJECT_MANAGER (1):** Projektant. Čte, odpovídá na otázky, může se sám doptávat (ale nemůže zakládat tasky).

**1.3 — Jak pozná, že to funguje?**
Kombinace dvou metrik B + C (viz výše).

**1.4 — Co se stane, když to nepostaví?**
Je to **hobby projekt**, neprodá ho, nevydělá na něm. Motivace: *"Chci si to zkusit, baví mě to."* Pokud umře, nevadí. Rozhodnutí je **udělat to**, otázka "zda stavět" je uzavřená a nebudeme ji znovu otevírat.

---

## Blok 2 — Uživatelé a jobs-to-be-done

**2.1 — Reálné situace za poslední měsíc (capture trigger):**
- *Řešení pracovny:* "Uvědomil jsem si, že chci LED osvětlení ve stěně → potřebuju připravit kabely → musím si to zapsat, aby se na to nezapomnělo."
- *Inspirace z IG:* "Viděl jsem super zahradní zásuvku na hadici v zemi → chci ji zohlednit při řešení zavlažování."
- Typické: má u sebe neustále telefon s internetem, nápady přichází při řešení konkrétního koutu domu / pozemku nebo při scrollování IG.

**2.2 — Triggery otevření appky:**
- **OWNER (Stanislav):** (a) quick capture ve chvíli nápadu, (b) před schůzkou s Projektantem projít seznam otevřených otázek, (c) při přípravě objednávky / předávky řemeslníkům ověřit co vše je rozhodnuto.
- **OWNER (manželka):** příležitostně prohlédnout, co manžel řeší.
- **PROJECT_MANAGER (Projektant):** notifikovaný (mimo app — typicky WA), otevře a projde otevřené otázky, odpoví.

**2.3 — Co dělají dnes bez appky:**
- Stanislav → Apple Notes.
- Manželka → nepíše, debatuje ústně.
- Projektant → WhatsApp.

**2.4 — Offline / kontext:**
*"Všude je signál, pokud by nebyl, appku prostě neotevřu."* → **Offline mode NENÍ potřeba.** PWA může být čistě online.

---

## Blok 3 — Scope a non-goals

### MVP (v1 — deadline konec května 2026)

| # | Feature | Poznámka |
|---|---|---|
| 1 | Quick capture (text) | Klíčové — musí být rychlejší/rovné Apple Notes |
| 2 | Obrázky jako příloha | Nepovinné — první kandidát na řez, pokud tlak |
| 3 | Externí linky jako příloha | Critical pro IG trigger |
| 4 | Záznamy typu "Nápad" | Samostatná entita |
| 5 | Záznamy typu "Otázka pro Projektanta" | Samostatná entita, jedna collection s `type` polem + `linkedTaskId` |
| 6 | Kategorizace | **Uživatelsky editovatelné** již v MVP (rozhodnuto, viz 5.3) |
| 7 | Lokace (předdefinovaný seznam, viz 5.4) | Fixní seznam v MVP |
| 8 | Stavy záznamů | Nápad / Otázka / Čekám / Rozhodnuto / Ve stavbě / Hotovo |
| 9 | Firebase Auth + role (OWNER / PROJECT_MANAGER) | |
| 10 | Multi-user sync (Firestore) | "Zadarmo" z Firestore |
| 11 | Export otevřených otázek do PDF | Plán B pro Projektanta — PDF nástroj zvolíme v prvotním prototypu |
| 12 | Dark mode | Nutnost kvůli nočnímu použití (viz 6.2) — rozhodnuto |
| 13 | i18n wrapper `t()` | String keys od začátku, ale jen CZ locale v MVP |

### V2

- Interaktivní půdorys pozemku (SVG z PDF od Projektanta)
- Interaktivní půdorys domu s místnostmi
- Sdílený read-only link bez loginu (pro řemeslníky)
- Uživatelsky editovatelné lokace (nad rámec předdefinovaných)

### CUT (nestaví se nikdy)

- **AI analýza a souhrn** — co by reálně řekla, co bez ní nevíme? Obyčejná statistika + filtry stačí.
- **Komentáře s thread historií** na tasku — stačí 1 textové pole "odpověď Projektanta".
- **Push / email notifikace** — web push v PWA na iOS je bolest, Projektant dostane WhatsApp zprávu stejně.

### Fallback řezací pořadí (pokud se nestihne)
`obrázky` → `i18n wrapper` → `role (jen single-user auth)`. Půdorys je už v V2, řezat ho není potřeba.

---

## Blok 4 — Constraints

| Constraint | Hodnota |
|---|---|
| Deadline | **konec května 2026** (před dokončením projektu domu u Projektanta) |
| Kapacita | ~14 h/týden (3-4 h/den × ~4 dny) |
| Dostupný čas celkem | **~85 hodin** |
| Tým | Solo (Stanislav) |
| Rozpočet peníze | **0 Kč/měs** — Firebase free tier |
| Frontend framework | **React + Tailwind + CSS Modules** |
| Databáze | **Firestore** (nepoužívat legacy RTDB) |
| Storage | **Firebase Storage** (obrázky) |
| Auth | **Firebase Auth** |
| Hosting prod | **Netlify** |
| Hosting dev | **GitHub Pages** |
| PDF export | **Neznámo — Stanislav neznalý nástrojů.** Prototypovat první týden (viz 9.3). |
| i18n | **Zabalit stringy, ale jen CZ v MVP.** EN locale V2+. |
| Jazyk primární | Čeština |
| Přístupnost | **WCAG AA** jako hygienický baseline |
| GDPR / data | In-family use, žádné obavy o Google Cloud |

**Risk na timeline (přiznaný):** Stanislav volí scénář (a) — tlačíme MVP jak je. Pokud se nestihne, fallback je Apple Notes + ruční PDF. Nic se neztratí.

---

## Blok 5 — Obsah a data

### 5.1 Import existujícího obsahu
Ruční přepis z Apple Notes — žádný automatizovaný import.

### 5.2 Půdorysy
**Dostupné:** PDF od Projektanta.
**Pro V2:** bude nutné PDF zpracovat → SVG s definovanými klikacími regiony (půdorys domu + pozemku). **Neřešíme v MVP.**

### 5.3 Kategorie
**Uživatelsky editovatelné již v MVP** (varianta B, rozhodnuto). Počáteční seznam navržený jako seed data:

- Elektro
- Voda
- Topení / rekuperace
- Zahrada / zavlažování
- Stavební úpravy
- Kuchyň
- Koupelna
- Nábytek / interiér
- Venkovní stavby
- Chytrá domácnost / IT rozvody
- Obecné / ostatní

### 5.4 Lokace (fixní v MVP, editovatelné v V2)

**Venkovní:**
- Pozemek / zahrada
- Okolí domu
- Dvorek před domem
- Zahradní domek
- Terasa / venkovní posezení

**Dům obecně:**
- Dům (obecně)
- Zádveří
- Chodba
- Garáž
- Dílna
- Technická místnost

**Obytné prostory:**
- Obývací pokoj
- Kuchyň
- Ložnice
- Dětský pokoj
- Pokoj pro hosty
- Pracovna

**Hygiena + wellness:**
- Koupelna
- WC
- Wellness

### 5.5 Stavy záznamů (finální)

| Stav | Pro typ | Popis |
|---|---|---|
| Nápad | nápad | Volná myšlenka, co chci v domě |
| Otázka | otázka | Specifická otázka pro PM |
| Čekám | otázka | Otázka odeslána/sdílena, čekám odpověď |
| Rozhodnuto | oba | Víme co chceme, ještě se nerealizuje |
| Ve stavbě | oba | Právě se realizuje |
| Hotovo | oba | Vyřešeno, uzavřeno |

### 5.6 Datový model — dvě entity, jedna collection

Jedna Firestore collection `tasks` s polem `type: "nápad" | "otázka"` a volitelným `linkedTaskId` pro vazbu. UX ale prezentuje **jako dva oddělené seznamy** (Nápady / Otázky).

**Workflow konverze:** Z nápadu jde vytvořit otázku pro PM tlačítkem → předvyplní text, obrázek, kategorii, lokaci; nový task typu "otázka" vznikne, původní nápad zůstává, vazba `linkedTaskId` mezi nimi zachována.

---

## Blok 6 — Kontext použití

| Parametr | Hodnota |
|---|---|
| Rozložení zařízení | ~80 % mobil, ~20 % desktop, tablet ignorujeme |
| Kontext použití | Kdekoliv — doma, venku, na stavbě, v autě, na schůzce. **Ve dne i v noci.** |
| Přístupnost | WCAG AA baseline |
| Speciální potřeby uživatelů | Žádné |
| Offline mode | Nepotřeba |

**Důsledky pro design:**
- **Dark mode MVP** (noční použití — **potvrzeno Stanislavem**).
- **Tap targets ≥ 44×44 px**.
- **Kontrast min AA i na slunci**.
- **Jednoruční ovládání** mobilní verze (primární akce v palcovém rádiu).

---

## Blok 7 — Tón a estetika

### 7.1 Tři přídavná jména
**Klidná · promyšlená · domácí.**

Odpovídá paletě (olivová RAL 6013 + Stone Beige + dub) i tématu "promyšlený venkov". Potvrzuje, že cílíme na přírodní / teplou estetiku, ne studenou technickou nebo hravou.

### 7.2 Reference (styl OK)
- **Apple Notes** — *jednoduchost, minimum rušivých prvků, rychlost psaní*.
- **Notion** — *struktura, databáze s filtry, přílohy; ale pro Stanislava moc komplexní*.

**Syntéza:** Apple Notes rychlost + Notion struktura, **ale bez Notion komplexity**. "Apple Notes, co umí kategorie a stavy."

### 7.3 Reference (styl NE)
- **Trello** — *příliš generický kanban board; pro agilní týmy, ne pro ucelování osobních nápadů*.

**Implikace:** v MVP nepoužíváme kanban sloupce jako primární view. Seznam filtrovatelný podle stavu/kategorie/lokace je lepší fit.

### 7.4 Barevná paleta (z reference obrázku kuchyně)
- **Olivová RAL 6013** (kuchyňský ostrůvek) — accent / primary
- **Kronospan K680 Stone Beige** (kuchyňská linka) — neutral / background
- **Dub** (podlaha) — hřejivý doplněk / wood accent

Dopracovat v `design-tokens` fázi s accessibility kontrolou (kontrast AA).

---

## Blok 8 — Konkurence a inspirace

**[PARTIAL]** Stanislav hlouběji nehledal — *"chci svojí"*. Zapsáno jako přijatý postoj.

Z Bloku 7 máme dvě reference (Apple Notes, Notion) a jednu anti-referenci (Trello). **Další konkurenční analýza potřeba není — máme dost mírných signálů pro design fázi.**

**Pro futureproofing kandidáti k přečtení ve volných chvílích:**
- **Milanote** — mood board + poznámky; inspirace pro vizuální přílohy.
- **Obsidian** — linkování mezi poznámkami; inspirace pro vazbu nápad ↔ otázka.
- **Houzz** — specifický pro bydlení/stavbu; inspirace pro kategorie a UX objednávky řemeslníků.

---

## Blok 9 — Rizika a neznámé

### 9.1 Největší riziko projektu
> *"Nezvyknu si na ni a nebude uživatelsky přívětivá."*

To je **klíčové riziko celého projektu**. Otázka návyku je otázka frictionu. Design fáze musí řešit:
1. **Capture speed** — od "napadlo mě" k "uloženo" < 5 sekund. PWA na home-screen + okamžité otevření na quick-capture obrazovku.
2. **Zero-config capture** — kategorii ani lokaci není nutné vyplnit hned. Nápad jde uložit s prázdnými atributy a doplnit později ("inbox zero" workflow).
3. **Žádné přihlašovací friction** — po prvním loginu zůstává přihlášený.

### 9.2 Nejstrašnější technická oblast
> *"Jak to bude fungovat na mobilu, aby to nebylo zmatečné a uživatel se spíše ztratil než věděl co dělá."*

Stanislav potvrdil: **je to otázka designu, ne technická**. Předurčuje north-star design rule:
- **Jedna primární akce na obrazovku.**
- **Maximálně 2 úrovně navigace.**
- **Vše sekundární schováno za FAB / bottom sheet / menu.**
- Apple Notes jako benchmark pro cleanliness.

### 9.3 Co prototypovat v prvním týdnu

Stanislav status:
- **PWA install + quick-capture** → *"zkoušel jsem, je to OK"* → nižší risk, ale přesto validovat na iOS i Androidu.
- **Firebase Security Rules** → *"zkoušel jsem, je to OK"* → nižší risk.
- **PDF export** → *"nevím, neznám nástroje pro jejich tvorbu"* → **NEJVYŠŠÍ PRIORITA PROTOTYPU**.

**Prototype week 1 — plán:**
1. **PDF export spike** (půl až celý den). Vyzkoušet `jsPDF` s `jsPDF-AutoTable` + **ruční font embed** pro českou diakritiku (Roboto / Noto Sans). Pokud to nezvládne s diakritikou → přepnout na `pdfmake` (má vestavěné Unicode fonty) nebo `@react-pdf/renderer`. **Deliverable:** 1stránkové PDF s nadpisem, 3 mock otázkami s háčky a čárkami, 1 obrázkem. Doporučení pro MVP implementaci.
2. **PWA end-to-end smoke test** (2 hod). Deploy prázdné PWA na Netlify, install na Stanislavův iPhone + Android, ověřit že po tapu otevírá rovnou `/quick-capture` route (start_url + scope v manifestu).
3. **Firestore rules sketch** (2 hod). Data model draft + rules: OWNER může vše, PROJECT_MANAGER jen read + write field `projektantAnswer` na dokumentu `type=otázka`.

---

## Klíčová rozhodnutí zaznamenaná během interview

1. **App se staví** — otázka "zda stavět" je uzavřená. Hobby projekt, přijaté riziko neúspěchu.
2. **Manželka = OWNER "pro případ"**, ne aktivní author. UX primárně pro jediného power-usera.
3. **Projektant = nadšenec**, počítáme s full account + in-app odpovědí. PDF export jako plán B.
4. **PWA**, ne nativní iOS.
5. **Firestore** (ne legacy RTDB).
6. **Půdorys je V2**, MVP používá seznamy + filtry.
7. **AI analýza CUT forever** (v dnešní podobě).
8. **Dark mode MVP** (noční capture z postele) — potvrzeno.
9. **i18n wrapper od začátku, CZ-only v MVP.**
10. **Kategorie uživatelsky editovatelné už v MVP.**
11. **Fallback řez pořadí:** obrázky → i18n → role.
12. **North-star UX rule:** jedna primární akce na obrazovku, Apple Notes clean, Notion structure, **bez Notion komplexity**.
13. **PDF export = největší neznámá technologie**, prototypovat v prvních dnech s jsPDF/pdfmake/react-pdf.

---

## Unanswered / partially answered

- **Blok 8 (konkurence):** Stanislav hlouběji nehledal. Ne kritické, máme dost z Bloku 7.
- **Blok 9.3 (PDF tooling):** Stanislav neznalý. Vyřešíme prototypem v prvním týdnu.

---

*Další krok: `design-brief` — transformuje tento DISCOVERY.md do strukturovaného `DESIGN_BRIEF.md` vhodného ke sdílení.*
