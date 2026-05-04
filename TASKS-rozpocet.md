# Rozpočet — Build Plan

**Generated**: 2026-05-04
**Architektura**: in-app mode v clever-house (NE subdoména)
**Total slices**: 23 (S01–S23) + S24 design review
**First usable**: S04 (✅ implementováno) — dashboard ukáže "Zatím zaplaceno"

## Status legend

- ✅ Implementováno (po této session)
- ▢ Připraveno k implementaci
- ⊘ Out of scope (anti-scope nebo OUT)

---

## Phase 0 — Mode infrastructure ✅

### S01 — Mode switcher + /rozpocet/* routes + role gate ✅

- Mode switcher pill v Shell.tsx (OWNER-only).
- Bottom nav rozdvojen podle `pathname.startsWith("/rozpocet")`.
- Routes: `/rozpocet`, `/rozpocet/sekce`, `/rozpocet/sekce/:id`, `/rozpocet/hypoteka`.
- Role gate: ne-OWNER → redirect `/ukoly`.
- Tokens: `tokens-rozpocet.css` import do `globals.css`.
- i18n: `budget` namespace (mode, tabs, dashboard, sekce, section, invoice, status, hypoteka).
- Permissions: 5 budget actions v `permissionsConfig`.
- Firestore rules: `/budget_sections/**` + collectionGroup `/invoices`.

## Phase 1 — První usable path ✅

### S02 — Sekce CRUD ✅

- Firestore `/budget_sections/{id}`. types `BudgetSection`.
- `lib/budget/sections.ts`: createSection, updateSection, deleteSection, subscribeSections, subscribeSection.
- `hooks/useBudgetSections.ts`: useBudgetSections, useBudgetSection.
- `routes/Rozpocet/Sekce.tsx`: list + footer total + empty state.
- `routes/Rozpocet/SekceDetail.tsx`: header, edit, delete s confirm.
- `components/budget/SectionModal.tsx`: new/edit modal (title, description).
- `components/budget/ConfirmDialog.tsx`: confirm pattern.

### S03 — Faktura pod sekcí ✅

- Firestore `/budget_sections/{sid}/invoices/{id}`. types `BudgetInvoice`, `InvoiceStatus`.
- `lib/budget/invoices.ts`: CRUD + cascade delete.
- `lib/budget/totals.ts`: pure helpery (`computeSectionPaidTotal`, `computeSectionOpenTotal`, `computeDashboardKpis`).
- `lib/budget/format.ts`: `formatCzk`, `parseCzk`.
- `hooks/useSectionInvoices.ts`, `hooks/useAllInvoices.ts` (collectionGroup).
- `components/budget/InvoiceModal.tsx`: new/edit (castka, status, datumPlatby).
- `components/budget/StatusChip.tsx`.
- Detail sekce: list faktur + suma "Zaplaceno"/"Otevřené".

### S04 — Dashboard KPI "Zatím zaplaceno" ✅

- `routes/Rozpocet/Dashboard.tsx`: 1 KPI tile + roadmap card.
- `components/budget/KPITile.tsx`: reusable tile.

---

## Phase 2 — Splatnosti a otevřené faktury ▢

### S05 — Splatnost faktury + status OVERDUE ▢

- Pole `splatnost` (povinné u OPEN).
- Computed status `OVERDUE` (OPEN + splatnost < today).
- Filter chips v detailu sekce.
- Pure helper `getInvoiceStatus(invoice, today)` + testy.

### S06 — Dashboard 2. KPI + sekce "Po splatnosti" / "Tento týden" ▢

- KPI "Otevřené faktury".
- Sekce "Po splatnosti" (red highlight).
- Sekce "K zaplacení tento týden" (next 7 days).
- Tap fakturu → naviguje + scrolluje.

### S07 — PDF upload na fakturu ▢

- File picker, Firebase Storage upload.
- Pole `pdfPath` na invoice.
- Detail řádku: PDF ikona → preview/download.
- Storage rules.
- Cascade delete.

---

## Phase 3 — Hypotéka a 4 KPI complete ▢

### S08 — Settings hypotéky + Bank drawdown CRUD ▢

- Settings landing entry "Rozpočet → Hypotéka".
- `/nastaveni/rozpocet/hypoteka`: limit + banka + datum.
- Firestore `/budget/settings/main` singleton.
- Firestore `/budget/drawdowns/{id}` (samostatná kolekce, ne pod sekcí).
- `routes/Rozpocet/Hypoteka.tsx` (replace placeholder): header status + drawdowns list + + Nové čerpání.
- Pure helper `computeMortgageStatus`.

### S09 — KPI "Banka uvolnila" ▢

- 3. KPI tile na dashboardu. Tap → `/rozpocet/hypoteka`.

### S10 — Expected amount + history + 4. KPI "Rozdíl proti plánu" ▢

- Pole `expectedAmountCzk`, `expectedHistory[]` na sekci.
- Modal `Edit expected` s povinným note.
- Detail sekce: panel "Plán: X" + variance chip.
- Collapsible "Historie odhadu".
- 4. KPI dashboardu.
- Pure helpery `computeSectionVariance`, `computeOverallVariance`.

---

## Phase 4 — Quotes + non-invoice payments ▢

### S11 — Quote pod sekcí ▢

### S12 — Non-invoice payment pod sekcí ▢

---

## Phase 5 — Účty a cash runway ▢

### S13 — Account OWNER-managed seznam + ucet picker ▢

- Settings `/nastaveni/rozpocet/uctu`.
- Default migrace: 3 účty (BU, hypoteční, hotovost).
- Picker v invoice/payment/drawdown modal.

### S14 — Current balance + cash runway KPI ▢

- Settings `/nastaveni/rozpocet/zustatek` — manual update + history.
- Pure helper `computeCashRunway`.
- Dashboard pod 4 KPI: "Peníze vystačí do měsíce X" + threshold chip.
- Nudge banner po 14+ dnech bez updatu.

---

## Phase 6 — Grafy ▢

### S15 — Plán vs. skutečnost po sekcích ▢

### S16 — Cumulative cashflow v čase ▢

### S17 — Donut struktury nákladů ▢

---

## Phase 7 — Phases / kategorie ▢

### S18 — Phases (etapy) z clever-house ▢

- Sekce má `phaseId`. Picker reuse.
- Filter v `/rozpocet/sekce`.

### S19 — Kategorie OWNER-managed ▢

- Vlastní `/budget/categories` collection (separate od clever-house `/categories`).
- Settings sub-page.

---

## Phase 8 — Reporting + sdílení ▢

### S20 — CSV + PDF export ▢

### S21 — Sdílení read-only odkazem (token-based) ▢

- Public route `/sdilet/:token`.
- Cloud Function endpoint pro token validation.

---

## Phase 9 — Audit log + komentáře ▢

### S22 — Audit log ▢

- Cloud Function trigger zapisuje `/budget_sections/{sid}/audit/{id}`.

### S23 — Komentáře u sekce ▢

- Reuse clever-house `<CommentThread>` komponenty.

---

## Phase 10 — Polish ▢

### S24 — Design review pass ▢

- Spustit `/design-review` skill, vyfiltrovat findings.

---

## Out-of-phase backlog (= OUT)

Push notifikace splatnosti, in-app inbox/bell, search napříč sekcemi, cron CF nudge na zůstatek, KPI flash animace, backfill historických faktur z Excelu, multi-mortgage, multi-projekt, DPH evidence, OCR, Open Banking, schvalovací workflow.

## Risks & mitigations

1. **Bottom nav "two flavors"** — Shell má conditional logic. Mitigace: jasná podmínka `pathname.startsWith("/rozpocet")`, testy přidat v dalším slice.
2. **Cross-entity aggregation** — Dashboard sčítá přes collectionGroup faktur. Mitigace: pure helpery s testy.
3. **Permission drift** — `permissionsConfig.ts` ↔ `firestore.rules`. Mitigace: invariant testy projely (`npm run docs:permissions` regen markdown), audit při deploy.
4. **`app/src/routes/Rozpocet.tsx` orphan** — sandbox neudělil delete; byl převeden na re-export shim k novému Dashboard. Doporučeno smazat manuálně při čištění.
5. **Cash runway formula** — neimplementováno. Před S14 dořešit přesné vstupy (`burn_rate_90d`, `currentAccountBalanceCzk`, missing-balance edge case).
