# DISCOVERY — Rozpočet (in-app mode v clever-house)

## Meta

- **Datum**: 2026-05-04
- **Účastníci**: OWNER (Stanislav Kasika), Claude
- **Stav**: Zamčeno, slice 0 + slice 1 (S02–S04) implementováno
- **Architektura**: **in-app mode switcher** v clever-house (NE subdoména)
- **Skill**: `designer-skills:grill-me`

## Problem Statement

Při stavbě domu chybí jedno místo, kde je vidět kolik měla která část stát, kolik už reálně stála, co je zaplaceno, co visí jako závazek se splatností, a jak to celé sedí proti penězům uvolňovaným z hypotéky. Cílem je 30-vteřinový dashboard pro nedělní review s manželkou a evidence faktur, která nahradí mobilní zápis do Excelu.

## Primary User

OWNER (Stanislav + manželka), výhradně. **Žádný PROJECT_MANAGER, žádný CONSTRUCTION_MANAGER, žádné sdílení s třetími stranami.**

## Success Metric

V neděli večer otevřu app, **přepnu na Rozpočet mode** a do 30 vteřin bez klikání vidím 4 čísla: banka uvolnila / zaplaceno / otevřené faktury / rozdíl proti plánu.

## Architektura — POSLEDNÍ ROZHODNUTÍ (2026-05-04 odpoledne)

> **Změna proti původnímu plánu (subdoména + monorepo):**
> Po prvním pokusu o subdoménový build (`apps/budget/`) se OWNER rozhodl pro **in-app mode switcher** uvnitř clever-house.

- **Žádná subdoména, žádný monorepo.** Všechno žije v `app/src/` clever-house repa.
- **Mode switcher** (segmented pills "Deník / Rozpočet") pod hlavičkou v Shellu. Visible jen pro OWNER.
- **URL-based mode**: cesty pod `/rozpocet/*` = mode "Rozpočet". Všechno ostatní = mode "Deník".
- **Sdílená hlavička, footer, settings** — Rozpočet jen mění bottom nav (Přehled / Sekce / Hypotéka / Nastavení).
- **Role gate**: ne-OWNER se na `/rozpocet/*` redirectuje na `/ukoly`.
- **Sdílený Firebase projekt** (jeden, jako vždy), Firestore root collections `/budget_sections/{id}` + subcollection `/invoices/{id}`.

## Top 3 Risks

1. **Bottom nav "two flavors"** — Shell má teď podmíněnou logiku podle `pathname.startsWith("/rozpocet")`. Mitigace: jasná podmínka, testy v Shell.tsx přijdou v dalším slice.
2. **Cross-entity aggregation correctness** — Dashboard agreguje přes 5+ entit přes `collectionGroup` query. Mitigace: pure helpery (`computeDashboardKpis`, `computeSectionPaidTotal`) testovatelné odděleně, brzy jim přidáme unit testy.
3. **Permission drift** — `permissionsConfig.ts` má teď 5 budget actions, `firestore.rules` má `match /budget_sections/**`. Drift mezi tím = klikatelná tlačítka, která rules zamítnou. Mitigace: invariant testy (npm test) projely, manuální audit při deploy.

## Klíčová rozhodnutí (zamčená)

### Datový model (slice 1 implementováno)

- **`BudgetSection`** (top-level `/budget_sections/{id}`): `id, title, description?, expectedAmountCzk?, expectedHistory?, phaseId?, categoryIds?, createdBy, createdAt, updatedAt`.
- **`BudgetInvoice`** (subcollection `/budget_sections/{sid}/invoices/{id}`): `id, sectionId, castka (int Kč), status (OPEN|PAID), datumPlatby?, splatnost?, ucetId?, supplier?, pdfPath?, createdBy, createdAt, updatedAt`.

V budoucnu: BudgetQuote, BudgetPayment, BankDrawdown, Settings (mortgage limit + currentAccountBalance), Account.

### Scope IN

1. ✅ Sekce CRUD (S02)
2. ✅ Faktury pod sekcí — částka, status OPEN/PAID, datumPlatby (S03)
3. ✅ Dashboard KPI "Zatím zaplaceno" (S04)
4. Splatnost faktury + status OVERDUE (S05) — TBD
5. KPI "Otevřené faktury" + "Po splatnosti / Tento týden" (S06) — TBD
6. PDF upload k faktuře (S07) — TBD
7. Bank drawdowns + Settings hypotéky (S08) — TBD
8. Settings: Účty, Zůstatek BU (S13–S14) — TBD
9. Plán + history + 4 KPI complete + cash runway (S10, S14) — TBD
10. 3 grafy (S15–S17) — TBD
11. Etapy/kategorie (S18–S19) — TBD
12. Reporting export + sdílení odkazem (S20–S21) — TBD
13. Audit log + komentáře (S22–S23) — TBD

### Anti-scope (firewall)

- Žádné AI/OCR. Žádné veřejné sdílení / třetí strany. Žádná konektivita s bankou.

### Cuts (OUT)

- DPH split, multi-měna, schvalovací workflow, automatický bank import, top-odchylky graf, push notifikace na splatnost, in-app inbox/bell, splátky hypotéky (jen čerpání).

## Build status (po této session)

**Implementováno:**
- ✅ V27 mode switcher v Shell (OWNER-only)
- ✅ Routes `/rozpocet`, `/rozpocet/sekce`, `/rozpocet/sekce/:id`, `/rozpocet/hypoteka`
- ✅ Tokens `tokens-rozpocet.css` (extends clever-house base)
- ✅ Sekce CRUD + Faktura CRUD (subcollection) + Dashboard 1 KPI
- ✅ permissionsConfig 5 budget actions
- ✅ firestore.rules /budget_sections + collectionGroup /invoices
- ✅ i18n cs.json budget namespace (8 groups)
- ✅ Existing clever-house tests: 569 passed (regrese 0)

**Známé otevřené body:**
- Žádné unit testy pro `computeSectionPaidTotal`, `computeDashboardKpis` — připraveno k doplnění (5 minut práce).
- Hypotéka tab je placeholder (S08).
- `app/src/routes/Rozpocet.tsx` zůstal jako re-export shim (file system v sandboxu nedovolil delete).
