# Rozpočet — Design Brief

**Date**: 2026-05-04
**Author**: Stanislav Kasika
**Status**: Approved (slice 1 implementováno)
**Architektura**: in-app mode v clever-house

## 1. Problem Statement

Faktury, závazky se splatnostmi a čerpání hypotéky jsou dnes roztroušené v Excelu + Gmailu. OWNER (Stáňa + manželka) v neděli s manželkou neumí rychle odpovědět "kolik už jsme prostavěli a co nás čeká doplatit". Současný workflow nestíhá na mobilu, neumožňuje přiložit PDF, neupozorní na splatnost.

## 2. Primary User

OWNER (Stanislav Kasika + manželka) — manželé stavějící rodinný dům, financovaný kombinací hypotéky a vlastních prostředků. **Žádný PROJECT_MANAGER, žádný CONSTRUCTION_MANAGER, žádné sdílení s třetími stranami.**

Konkrétní scénář: faktura za elektroinstalaci přijde mailem se splatností 14 dní. OWNER ji večer otevře v clever-house, **přepne na "Rozpočet" mode** a do dvou minut zaeviduje (sekce „Elektro", částka, splatnost). V neděli s manželkou znovu otevře, zůstane na dashboardu a do 30 vteřin vidí stav.

## 3. Success Metrics

- **Primary**: 4 KPI viditelné na dashboardu rozpočtu bez kliknutí (banka uvolnila / zaplaceno / otevřené faktury / rozdíl proti plánu) — nedělní review pod 30 vteřin.
- **Secondary**: 100 % faktur zaevidovaných do 24 h od přijetí emailu (porovnání `createdAt` vs. datum v PDF).
- **Guardrail**: 0 zapomenutých splatností.

## 4. Architektura

> **Klíčová změna oproti původnímu plánu (subdoména):** rozpočet je **dodatečný mode v clever-house**, ne samostatná aplikace.

- Žádná subdoména, žádný monorepo.
- Mode switcher v `Shell.tsx` (OWNER-only) přepíná mezi režimem `Deník` (existující clever-house) a `Rozpočet`.
- URL: cesty pod `/rozpocet/*` = Rozpočet mode. Bottom nav v Shellu detekuje prefix a renderuje jiné taby.
- Sdílená hlavička, footer (= `BottomTabs` jen jiné položky), Nastavení (sekce přibyde s rozpočtovými settings v S08+).
- Sdílený Firebase projekt, sdílená auth.
- Rozpočtová data v Firestore: top-level `/budget_sections/{id}` + subcollection `/invoices/{id}`.
- Permissions: OWNER-only přes `firestore.rules` + `permissionsConfig` (5 budget akcí).

## 5. Scope

### IN (v1)

1. Sekce CRUD ✅
2. Faktury (částka, status OPEN/PAID, datumPlatby) ✅
3. Dashboard KPI "Zatím zaplaceno" ✅
4. Splatnost + status OVERDUE
5. Dashboard sekce "K zaplacení tento týden" / "Po splatnosti" + 4. KPI
6. PDF upload na fakturu
7. Bank drawdowns + Settings hypotéky
8. Účty (OWNER-managed) + zůstatek BU + cash runway
9. Plán (expectedAmount + history) + 4 KPI complete
10. 3 grafy (plán vs. skutečnost, kumulativní cashflow, struktura)
11. Etapy/kategorie integrace
12. Reporting export, sdílení read-only odkazem, audit log, komentáře

### OUT

- Push notifikace na splatnost (dashboard sekce stačí).
- In-app inbox / bell.
- Automatický bank import / Open Banking.
- Schvalovací workflow.
- Multi-měna (CZK only). DPH split.
- Splátky hypotéky (jen čerpání).
- Šablony sekcí.
- Backfill historických faktur z Excelu.

### Non-goals

- We are **not** trying to nahradit účetnictví.
- We are **not** trying to dělat AI / OCR rozpoznávání.
- We are **not** trying to umožnit sdílení s třetími stranami (banka, účetní, rodič).
- We are **not** trying to budovat víc-projektovou app (jeden rozpočet pro jeden dům).

## 6. Constraints

- **Timeline**: Inkrementální, slice po slici. Slice 0 + 1 hotové. Žádný fixní termín.
- **Budget**: 0 Kč nad rámec současného Firebase paid plánu.
- **Tech stack**: Clever-house tech stack, žádný nový (React 19, Vite, TS, Firebase, Tailwind utilities).
- **Accessibility**: WCAG 2.1 AA.
- **Brand / legal / regulatory**: Žádné GDPR scope. Žádné účetní povinnosti. Brand navazuje na clever-house aesthetic (Inter, stone+olive+oak, status colors).
- **Team**: Solo implementer = Claude. OWNER schvaluje + testuje na mobilu.

## 7. Tone & Aesthetic

- **Feel**: klidný, věcný, důvěryhodný.
- **References**: Apple Wallet (KPI clarity), `/dokumentace` v clever-house (list+detail patterny).
- **Anti-references**: ERP/účetnictví, bankovní app reklamy, dekorativní grafy bez rozhodovací hodnoty.
- **Aesthetic philosophy**: Dieter Rams — "Less, but better."

## 8. Content & Data

- **Co existuje**: Excelová tabulka rozpočtu + faktury rozházené v Gmailu jako PDF.
- **Co chybí**: čistá data o sjednaných závazcích se splatnostmi, historie čerpání hypotéky, propojení faktura ↔ etapa.
- **Backfill**: čistý start. Excel zahozen. Pokud OWNER chce historické faktury vidět, ručně.
- **Měna**: CZK only, celé Kč (zaokrouhleno).

## 9. Open Questions / Risks

1. **Bottom nav "two flavors"** — Shell má podmíněnou logiku. Risk: snadné přehlédnout edge case. Mitigace: testy ke Shell přidat v dalším slice.
2. **Cross-entity aggregation correctness** — `computeDashboardKpis` přes collectionGroup faktur. Mitigace: pure helpers, unit testy přidat.
3. **Cash runway formule** — neimplementováno (S14). Vstupy: `mortgageApprovedAmountCzk - sum(drawdowns) + currentAccountBalanceCzk - sum(open invoices)) / burn_rate_90d`. Dořešit před S14.

## 10. Definition of Done (slice 1)

- ✅ OWNER vidí mode switcher v Shellu pod hlavičkou.
- ✅ Klik "Rozpočet" → naviguje na `/rozpocet`. Bottom nav přepne na rozpočtové taby.
- ✅ Klik "Deník" → naviguje na `/ukoly`. Bottom nav přepne na clever-house taby.
- ✅ Ne-OWNER nevidí switcher a `/rozpocet/*` se redirectuje na `/ukoly`.
- ✅ Sekce CRUD: vytvořit / editovat / smazat sekci. Smazaná sekce smaže i své faktury.
- ✅ Faktura CRUD: částka (int Kč), status, datum platby (povinné u PAID).
- ✅ Detail sekce ukáže suma "Zaplaceno" a "Otevřené".
- ✅ List sekcí ukáže per-sekci sumu + grand total na patičce.
- ✅ Dashboard ukáže 1 KPI tile "Zatím zaplaceno" + sub "+ X Kč otevřených".
- ✅ Tokens `tokens-rozpocet.css` importované do `globals.css`.
- ✅ Permissions config rozšířen o 5 budget akcí.
- ✅ Firestore rules pro `/budget_sections/**` + collectionGroup `/invoices`.
- ✅ i18n cs.json budget namespace (mode, tabs, dashboard, sekce, section, invoice, status, hypoteka).
- ✅ TypeScript typecheck PASS.
- ✅ Clever-house tests: 569 passed, 0 failures (regrese 0).
