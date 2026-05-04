# Rozpočet — Information Architecture

**Date**: 2026-05-04
**Status**: Slice 1 implementováno
**Architektura**: in-app mode v clever-house

## 1. Sitemap

```
clever-house (single React app, jeden BrowserRouter)
│
├── /auth/prihlaseni              (public — Login)
├── ProtectedLayout
│   ├── Mode = "Deník" (existing clever-house, žádný path prefix)
│   │   ├── /                     redirect → /ukoly
│   │   ├── /zaznamy
│   │   ├── /ukoly
│   │   ├── /dokumentace
│   │   ├── /events, /events/new, /event/:id, /event/:id/edit
│   │   ├── /hlaseni
│   │   ├── /t/:id (task detail)
│   │   ├── /nastaveni + sub-pages
│   │   └── /kategorie, /lokace, /export …
│   │
│   └── Mode = "Rozpočet" (V27, OWNER-only, /rozpocet/* prefix)
│       ├── /rozpocet              (Dashboard — homepage modu)
│       ├── /rozpocet/sekce        (List sekcí)
│       ├── /rozpocet/sekce/:id    (Detail sekce — faktury, sumy)
│       └── /rozpocet/hypoteka     (Placeholder, S08+)
```

Žádný `/rozpocet/nastaveni` — nastavení je sdílené (`/nastaveni`). V S08 se do něj přidá blok pro hypotéku, účty, zůstatek BU.

## 2. Primary navigation

### Hlavička (sdílená oba mody)

- Brand: "Chytrý dům na vsi" (h1) + "Kašikovi" (subtitle)
- Right-side: Hlášení, Calendar (kromě CM), NotificationBell

### Mode switcher (nově V27)

Pod hlavičkou, pred main content, **OWNER-only:**

```
┌─────────────────────────┐
│  [ Deník ]  [ Rozpočet ]│  ← segmented pills
└─────────────────────────┘
```

- Aktivní pill = ten, který odpovídá aktuální cestě.
- Klik přepne na default cestu druhého modu (`/ukoly` ↔ `/rozpocet`).
- Pokud OWNER stojí v Rozpočet mode na detail page (např. `/rozpocet/sekce/abc`), klik "Deník" naviguje na `/ukoly`.

### Bottom nav (sdílený UI, různý obsah podle modu)

**Mode "Deník"** (= existující):
- Dokumentace / Záznamy / **FAB** / Úkoly / Nastavení (more)
- (CM má místo Záznamy → Události)

**Mode "Rozpočet"** (V27, OWNER-only):
- Přehled / Sekce / Hypotéka / Nastavení

Žádný FAB v Rozpočet mode (čisté 4 taby).

## 3. User flows (top 3)

### Flow A — Zápis faktury večer (primary JTBD)

1. OWNER otevře clever-house z home screenu, je auth ✓.
2. Tap "Rozpočet" pill v mode switcheru → `/rozpocet` Dashboard.
3. Tap tab "Sekce" → `/rozpocet/sekce`.
4. Tap sekci „Elektro" (nebo „+ Nová sekce" pokud neexistuje) → detail.
5. Tap "+ Faktura" → modal s castka / status / datumPlatby.
6. Vyplní (např. 50 000 Kč PAID 1.5.) → Uložit.
7. Modal zavře. Detail ukáže nový řádek + suma "Zaplaceno" updatuje.
8. Tap tab "Přehled" → KPI "Zatím zaplaceno" updatováno.

### Flow B — Nedělní review

1. Otevře app → defaultně landing /ukoly (Deník).
2. Tap "Rozpočet" → `/rozpocet`.
3. Vidí KPI bez kliknutí. **Slice 1**: 1 KPI ("Zatím zaplaceno"). **Slice 4 (S10+)**: 4 KPI (banka uvolnila / zaplaceno / otevřené / rozdíl proti plánu).
4. Pokud něco visí "Po splatnosti" (S06+), tap → drill-down na fakturu.

### Flow C — Návrat do Deníku

1. OWNER stojí v Rozpočet mode.
2. Tap "Deník" pill → naviguje na `/ukoly`.
3. Bottom nav přepne. Hlavička zůstává stejná.

## 4. Page blueprints

### `/rozpocet` — Dashboard

- Purpose: nedělní stav rozpočtu.
- Primary action: žádná editační (read-only stav).
- Slice 1 obsah: 1 KPI tile ("Zatím zaplaceno") + sub ("+ X Kč otevřených") + roadmap card.
- Slice 4+ (S10): 4 KPI tiles + "Po splatnosti" + "Tento týden" + grafy.
- Empty state: pokud žádné sekce → CTA "Přejít na Sekce".

### `/rozpocet/sekce` — List sekcí

- Purpose: procházet sekce, zakládat nové.
- Primary action: "+ Nová sekce" → SectionModal.
- Sekundární: tap na řádek → detail.
- Footer: sticky "Celkem prostavěno: X Kč".
- Empty state: "Začni založením první sekce" + CTA.

### `/rozpocet/sekce/:id` — Detail sekce

- Purpose: pracovní plocha pro evidence faktur jedné sekce.
- Primary action: "+ Faktura" → InvoiceModal.
- Sekundární: ✎ edit sekce, 🗑 smazat sekci, edit faktury (klik), smaž fakturu (🗑 v řádku).
- Suma panel: "Zaplaceno" + "Otevřené" vedle sebe.
- Empty state pro faktury: "Sekce je prázdná" + CTA.

### `/rozpocet/hypoteka` — placeholder S08

- Centered placeholder s ikonou a textem "Tady bude limit hypotéky, historie čerpání…".

## 5. Content inventory (slice 1)

| Type | Fields | Source | Owner |
|------|--------|--------|-------|
| `BudgetSection` | id, title, description?, expectedAmountCzk?, expectedHistory?, phaseId?, categoryIds?, createdBy, ts | `/budget_sections/{id}` | OWNER |
| `BudgetInvoice` | id, sectionId, castka (int Kč), status (OPEN\|PAID), datumPlatby?, splatnost?, ucetId?, supplier?, pdfPath?, createdBy, ts | `/budget_sections/{sid}/invoices/{id}` | OWNER |

V dalších slices: BudgetQuote, BudgetPayment, BankDrawdown, Account, Settings (singleton s mortgageApprovedAmountCzk, currentAccountBalanceCzk, …).

## 6. URL & state model

- **REST-ish flat routes** s `/rozpocet/` prefixem.
- Filtery + modaly v query (S05+ zavede `?status=OPEN`, modal `?modal=invoice.new`).
- Server state přes Firestore subscriptions (`useBudgetSections`, `useSectionInvoices`, `useAllInvoices`).
- Real-time updates napříč devicy.

### Deep-linkability

- `/rozpocet/sekce/:id` — sharable mezi OWNERem ↔ manželkou.
- `/rozpocet` — homepage modu.

## 7. Navigation patterns

- Žádné breadcrumbs (sitemap je flat, max 2 úrovně pod root).
- Detail sekce má back arrow → list sekcí.
- Bottom tab tap = jump na root té tab.
- Mode switcher zachová deep-link kontext jen v rámci modu (klik mezi módy = navigate na default route druhého modu).

## 8. Open structural questions

- [ ] **Settings sub-page pro Rozpočet**: kdy přidat? Tipuju S08 (Settings → Rozpočet → Hypotéka, Účty, Zůstatek BU).
- [ ] **Filter/search v `/rozpocet/sekce`**: zatím není potřeba (3-10 sekcí stavby), přidá se v S05+.
- [ ] **FAB v Rozpočet mode**: zatím nemáme. Pokud OWNER chce rychlý "Add Faktura" napříč všemi sekcemi z Dashboardu, zavedeme FAB s pickerem sekce.
- [ ] **Sdílení read-only odkazem (S21)**: pravděpodobně mimo `/rozpocet/*` → vlastní `/sdilet/:token` veřejná route.
