# Dokumentace — Information Architecture

## 1. Sitemap

Dokumentace se integruje do existující struktury appky. Níže jsou **jen nové
nebo změněné routy** — zbytek appky zůstává beze změn.

```
/                              (auth, both, OWNER home)
├── /zaznamy                   (auth, both) — nápady + [NEW] dokumentace cards
├── /ukoly                     (auth, both) — otázky + úkoly
├── /novy                      (auth, both) — composer (+ typ dokumentace)
├── /t/:id                     (auth, both) — TaskDetail (rozšířen o dokumentace)
│                                             — [NEW] linkedDocs sekce pro nápad/otázka/úkol
│                                             — [NEW] document cards + upload pro dokumentace
├── /nastaveni                 (auth, both)
│   └── /nastaveni/typy-dokumentu  (auth, OWNER-only) — [NEW] správa typů dokumentů
├── /events                    (auth, both)
├── ...ostatní beze změn
```

### Klíčové rozhodnutí: Dokumentace žije v /zaznamy

Dokumentace sdílí list s nápady (`/zaznamy`). Důvody:
- Oboje je „záznam" — dlouhodobý, ne akční. Nápady = myšlenky, dokumentace = podklady.
- Žádný nový tab v bottom nav (stávajících 5 slotů je plných).
- Filtr na type (`nápad` | `dokumentace`) odliší obsah.

## 2. Primary navigation

Bottom tabs zůstávají **beze změn** (5 slotů):

| # | OWNER           | PM              | Proč top-level            |
|---|-----------------|-----------------|---------------------------|
| 1 | Seznam (Lokace) | Harmonogram     | Home / denní přehled      |
| 2 | Záznamy         | Záznamy         | Nápady + dokumentace      |
| 3 | ⊕ (FAB)         | ⊕ (FAB)         | Rychlé vytvoření          |
| 4 | Úkoly           | Úkoly           | Akční položky             |
| 5 | Více            | Více            | Nastavení, export…        |

**Mobile adaptation:** Stávající bottom tab bar. Dokumentace nepotřebuje
vlastní tab — je přístupná přes Záznamy + přes link v detailu tasku.

## 3. User flows (top 3)

### Flow A: Nahrání nového dokumentu

1. OWNER tapne ⊕ FAB → `/novy` composer
2. Vybere typ „Dokumentace" (nová možnost v type pickeru)
3. Napíše title (např. „Elektroinstalace — nabídky")
4. Uloží → redirect na `/t/:id` (TaskDetail v režimu dokumentace)
5. V detail view tapne „Přidat dokument" (upload CTA)
6. Otevře se **upload modal**: vybere soubor (PDF/obrázek) → zvolí typ dokumentu z dropdown → zadá zobrazovaný název → potvrdí
7. Dokument se nahraje, zobrazí se jako karta s PDF ikonkou
8. (Volitelně) nastaví sharedWithRoles → PM vidí záznam

**Error branches:**
- Soubor > 10 MB → toast „Soubor je příliš velký (max 10 MB)"
- Nepodporovaný formát → toast „Podporované formáty: PDF, obrázky"
- Upload selže (offline) → toast + retry CTA

### Flow B: Nalinkování dokumentu z úkolu

1. OWNER otevře detail úkolu `/t/:taskId`
2. Scrollne k sekci „Přiložená dokumentace" (pod kategoriemi)
3. Tapne „Připojit dokumentaci" → otevře se **document picker modal**
4. Modal zobrazí list existujících záznamů Dokumentace (filtrovaný na ty, které OWNER vidí)
5. OWNER vybere jeden nebo více záznamů → potvrdí
6. Záznamy se zobrazí jako kompaktní karty v sekci „Přiložená dokumentace"
7. Klik na kartu → navigace na `/t/:docId` (detail Dokumentace)

**Error branches:**
- Žádné dokumentace záznamy existují → empty state „Zatím nemáte žádnou dokumentaci. Vytvořte ji přes ⊕."
- Uživatel nemá edit práva na task → „Připojit dokumentaci" CTA skrytý

### Flow C: Prohlédnutí dokumentu z úkolu (PM perspective)

1. PM dostane push notifikaci „Nový dokument v Elektroinstalace"
2. Tapne → deep link na `/t/:docId` (TaskDetail dokumentace)
3. Vidí karty dokumentů: PDF ikonka + název + typ
4. Tapne na PDF kartu → otevře se v externí appce (Safari/Chrome PDF viewer)
5. Tapne na obrázek kartu → otevře se lightbox v appce
6. PM se vrátí back → zpět na detail dokumentace

## 4. Page blueprints

### `/zaznamy` — Záznamy (rozšířeno)

- **Purpose**: List nápadů a dokumentací OWNER-a (PM vidí sdílené).
- **Primary action**: Najít a otevřít konkrétní záznam.
- **Secondary actions**: Filtrovat podle typu (nápad/dokumentace), kategorie, lokace; hledat fulltext.
- **Content blocks** (priority order):
  1. Search input + filter chips (stávající)
  2. **[NEW] Type filter chip**: „Vše" | „Nápady" | „Dokumentace"
  3. Card list — nápady a dokumentace promíšeně, řazení dle data (stávající sort)
  4. Empty state per filter
- **Data dependencies**: `useTasks` (rozšířen o type `dokumentace`), `useCategories`
- **Empty state**: „Zatím nemáte žádné záznamy. Vytvořte první přes ⊕."
- **Dokumentace card odlišení**: ikonka 📄 (FileText) místo 💡 (Lightbulb), badge „Dokumentace", počet dokumentů

### `/t/:id` — TaskDetail (režim: dokumentace)

- **Purpose**: Zobrazit a spravovat záznam dokumentace s nahranými dokumenty.
- **Primary action**: Prohlédnout / nahrát / nahradit dokument.
- **Secondary actions**: Upravit title, nastavit sharing, přidat kategorii.
- **Content blocks** (priority order):
  1. Back button + ball-on-me (pokud relevantní — u dokumentace asi ne)
  2. Title (editovatelný)
  3. Metadata řádek: sharedWithRoles badge + kategorie chips
  4. **[NEW] Dokument karty grid** — hlavní obsah:
     - Každá karta: PDF/obrázek ikonka + zobrazovaný název + typ dokumentu + datum nahrání
     - Tap → otevřít (PDF externě / obrázek lightbox)
     - Swipe nebo long-press → akce (nahradit, smazat) — jen pro autora záznamu
  5. **[NEW] „Přidat dokument" CTA** — otevře upload modal
  6. **[NEW] Audit trail** (kolapsovatelný) — timeline: „Stáňa nahrál Cenová nabídka (12.4.2026)"
  7. Description (skrytý / kolapsovatelný — prozatím nemá smysl zobrazovat)
- **Data dependencies**: `useTask(id)`, document subcollection/array, `useCategories`, `useUsers` (pro audit trail)
- **Empty state**: „Zatím žádné dokumenty. Nahrajte první." + upload CTA
- **Loading**: Skeleton cards
- **Error**: „Záznam nenalezen" s back button

### `/t/:id` — TaskDetail (režim: nápad/otázka/úkol — rozšíření)

- **[NEW] Sekce „Přiložená dokumentace"** — zobrazí se pokud `linkedDocIds.length > 0` NEBO pokud má uživatel edit práva (pak CTA „Připojit dokumentaci"):
  1. Headline: „Přiložená dokumentace"
  2. Kompaktní karty: ikonka + title záznamu dokumentace + počet dokumentů v něm
  3. Tap → navigace na `/t/:docId`
  4. CTA „Připojit dokumentaci" → document picker modal
  5. Existující linky: X button pro odebrání (jen kdo smí editovat task)
- **Pozice v layoutu**: Pod kategorií, nad komentáři (pro nápad); pod kategorií, nad deadline/assignee řádkem (pro otázka/úkol)

### `/novy` — NewTask composer (rozšíření)

- **[NEW] Typ „Dokumentace"** v type pickeru:
  - OWNER: nápad | otázka | úkol | **dokumentace**
  - PM: otázka | úkol (PM nesmí vytvořit dokumentaci — zatím, viz permissions)
  - Wait — z discovery: PM MŮŽE vytvořit. Takže: PM: otázka | úkol | **dokumentace**
- Po uložení → redirect na `/t/:id` jako u ostatních typů

### Upload modal (overlay, ne vlastní routa)

- **Purpose**: Nahrát jeden dokument s metadaty.
- **Primary action**: Vybrat soubor + typ + název → uložit.
- **Content blocks**:
  1. File picker (native `<input type="file" accept=".pdf,image/*">`)
  2. Typ dokumentu — dropdown z admin-spravovaného seznamu
  3. Zobrazovaný název — text input (volitelný, default = filename)
  4. Akce: „Nahrát" (primary) + „Zrušit" (secondary)
- **Replace varianta**: Stejný modal, pre-filled z předchozího dokumentu, headline „Nahradit dokument", confirmation text

### Document picker modal (overlay)

- **Purpose**: Vybrat existující záznam(y) Dokumentace pro přilinkování k tasku.
- **Primary action**: Vybrat a potvrdit.
- **Content blocks**:
  1. Search input (filtr podle title)
  2. List karet Dokumentace (title + počet dokumentů + kategorie)
  3. Checkbox multi-select
  4. „Připojit" (primary) + „Zrušit"
- **Data**: Všechny Dokumentace záznamy, které aktuální user vidí (respektuje sharedWithRoles)

### `/nastaveni/typy-dokumentu` — Správa typů dokumentů (OWNER-only)

- **Purpose**: CRUD admin seznam typů dokumentů.
- **Primary action**: Přidat nový typ.
- **Secondary actions**: Přejmenovat, smazat existující.
- **Content blocks**:
  1. Header + „Přidat typ" CTA
  2. List existujících typů (label + edit/delete ikony)
  3. Inline edit (tap → text input)
- **Data dependencies**: Firestore kolekce `documentTypes` (nebo `settings/documentTypes`)
- **Empty state**: Výchozí sada se seedne při prvním přístupu (7 typů)
- **Přístup**: Z `/nastaveni` jako nový řádek „Typy dokumentů" (vedle Kategorie, Lokace)

## 5. Content inventory

| Typ | Pole | Zdroj | Vlastník |
|-----|------|-------|----------|
| Dokumentace záznam | title, description, categoryIds[], sharedWithRoles[], createdBy, createdAt, updatedAt, type="dokumentace" | Firestore `tasks/` | OWNER (primárně), PM |
| Dokument (v záznamu) | fileUrl, filePath, contentType, sizeBytes, docTypeName, displayName, uploadedBy, uploadedAt | Firestore sub-array nebo subkolekce | Autor záznamu |
| Audit event | action (uploaded/replaced/deleted/metadata_changed), actorUid, timestamp, details | Firestore sub-array nebo subkolekce | Systém |
| Typ dokumentu (admin) | id, label, createdAt, sortOrder | Firestore kolekce/doc | OWNER |
| Link (task → dok.) | linkedDocIds: string[] | Firestore pole na Task | Kdo smí editovat task |

## 6. URL & state model

**URL conventions:**
- Dokumentace záznam: `/t/:id` — sdílí routu s ostatními task typy (TaskDetail rozlišuje přes `task.type`)
- Admin typy dokumentů: `/nastaveni/typy-dokumentu` (nová routa)
- Žádné query params pro dokumentace — filtry v `/zaznamy` jsou v local state (stávající pattern)

**Co žije kde:**
- **URL**: task ID (`:id`), route path
- **Local state**: filter chips stav (typ, kategorie, lokace), search query, modal open/close
- **Server state (Firestore)**: task data, dokumenty, audit trail, typy dokumentů, linkedDocIds

**Deep-linkability:**
- `/t/:docId` — sdílitelný, push notifikace linkují sem
- `/zaznamy` — sdílitelný (ale filtry se nesdílejí v URL — stávající pattern)

## 7. Navigation patterns

**Breadcrumbs:** Žádné — stávající pattern je back button v header.

**Back behavior na mobilu:**
- Z TaskDetail dokumentace → zpět na `/zaznamy` (nebo odkud přišel — `navigate(-1)`)
- Z dokumentu otevřeného externě → zpět do appky (OS-level back)
- Z upload/replace modalu → zavření modalu (overlay, ne navigace)
- Z document picker modalu → zavření modalu

**Persistence:**
- Filter v `/zaznamy` (typ nápad/dokumentace) — přežije navigaci (localStorage, stávající pattern `loadFilter`/`saveFilter`)
- Upload modal stav — nepřežívá (overlay se zavře)
- linkedDocIds — server state, přežívá vše

## 8. Open structural questions

- [ ] **Dokument storage**: subkolekce `tasks/{id}/documents/` vs pole `documents[]` přímo na task documentu? Subkolekce je flexibilnější pro audit trail a budoucí rozšíření. Pole je jednodušší pro read (jeden fetch).
- [ ] **Audit trail storage**: subkolekce `tasks/{id}/auditLog/` vs pole `auditEvents[]` na task documentu? Podobný trade-off.
- [ ] **Typ dokumentu admin kolekce**: vlastní top-level kolekce `documentTypes/` (jako `categories/`) nebo doc v `settings/documentTypes`?
- [ ] **linkedDocIds limit**: Má být cap na počet přilinkovaných dokumentací k jednomu tasku? (Návrh: soft limit 10)
- [ ] **Dokumentace card v /zaznamy**: Zobrazit počet dokumentů přímo na kartě? (Návrh: ano, jako badge „3 dokumenty")
- [ ] **FAB behavior**: Má FAB na `/zaznamy` defaultovat na typ „dokumentace" nebo zůstává na composeru s výběrem?
