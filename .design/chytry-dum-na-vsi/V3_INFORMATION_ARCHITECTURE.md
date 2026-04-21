# Chytrý dům na vsi — V3 Information Architecture

**Delta nad V2 IA.** Pouze changes a new screens — stávající V1/V2 struktura beze změny (tab bar, základní listy, auth flow).

## 1. Sitemap (delta)

```
/                               (auth, mobile-first)             ← Lokace grid [V2, beze změny struktury]
/napady                         (auth, OWNER)                    ← flat nápady list [V2]
/otazky                         (auth, both roles)               ← otázky list [V2, header přebudován]
/lokace/:id                     (auth, OWNER)                    ← lokace detail tabs [V2]
/t/:id                          (auth, both)                     ← task detail [V2, rozšířen pro V3]
  └── komentáře                 (inline pod bodem)               ← NEW V3
/nastaveni                      (auth, OWNER)                    ← settings [V2, přidán link]
  ├── /prehled                  (auth, OWNER)                    ← NEW V3 — analytika
  ├── /kategorie                (auth, OWNER)                    ← V1
  └── /export                   (auth, OWNER)                    ← V1
/auth/prihlaseni                (public, both)                   ← V1
```

### Role access po V3

| Route | OWNER | PM | Anyone auth (budoucí role) |
|---|---|---|---|
| `/` | ✓ | → redir `/otazky` | ✓ |
| `/napady` | ✓ | → redir `/otazky` | ✓ |
| `/otazky` | ✓ | ✓ | ✓ |
| `/t/:id` | ✓ read+edit (pokud autor) | ✓ read, ✓ comment, ✗ edit body | ✓ read, ✓ comment, ✗ edit |
| `/lokace/:id` | ✓ | → redir `/otazky` | ✓ |
| `/prehled` | ✓ | ✓ (filtr defaultně "Čeká na mě") | ✓ |
| `/nastaveni` | ✓ full | ✓ subset (jen signOut + theme) | ✓ subset |

**Nové:** právo `edit task body` je `task.createdBy === user.uid`, nikoli role-based. To otevírá cestu k multi-author workspace (V4+).

## 2. Primary navigation (tab bar, bez změny)

| Tab | Icon | Target | Role |
|---|---|---|---|
| Lokace | MapPin | `/` | OWNER + future auth roles |
| Nápady | Notebook | `/napady` | OWNER + future |
| Otázky | HelpCircle | `/otazky` | all |
| Více | Ellipsis | `/nastaveni` | all |

`/prehled` NENÍ v tab baru — žije jako prominentní link na vrcholu `/nastaveni` a jako rychlá kotva z `/otazky` header („Uvízlé 3" pill, tap → `/prehled?filter=stuck`).

Mobile adaptation: fixed bottom tab bar, už existující pattern.

## 3. User flows (top 3 pro V3)

### Flow A — Diskuse nad otázkou (primary V3 flow)

1. OWNER na `/otazky`, vidí otázku „Jaká izolace stropu?" s chipem „Čeká na mě"
2. Tap → `/t/:id` → vidí body + komentáře thread → poslední komentář od PM „Jakou máš výšku krovu?"
3. OWNER scrolluje dolů → composer pro komentář → píše „4.2m" → (volitelně tagne `@PM`) → attach 1 foto → Send
4. Komentář se objeví ve vláknu, `commentCount++`, OWNER v stejné obrazovce kliká na assignee avatar → dropdown → vybere PM → status se nezměnil, `assigneeUid` se přepsal
5. Volitelně: OWNER změní status na „Čekám" → odznačí, že čeká na PM
6. PM pri příštím otevření app → `/prehled` → vidí 1 otázku v „Čeká na mě"

### Flow B — Ranní triage (dashboard ritual)

1. OWNER otevře app → `/` (Lokace grid) → automaticky na `/`
2. Tap na „Více" tab → `/nastaveni`
3. Na vrcholu nastavení vidí velkou kartu **„Přehled"** s čísly: „Čeká na mě: 3", „Po deadline: 1", „Uvízlé ≥5 dní: 2"
4. Tap karta → `/prehled` → seznam rozdělený do 4 sekcí s počty
5. Tap první otázku v „Čeká na mě" → `/t/:id` → reaguje → zpět šipkou → seznam se updatnul (realtime)

### Flow C — Vyhledání staré diskuse

1. OWNER hledá diskusi o krovu, ví že je to pod lokací „Střecha / krov"
2. `/` → scrolluje na kartu lokace → tap → `/lokace/strecha-krov`
3. Tab „Otázky" → vidí seznam, každá karta má: title + status chip + priority badge + assignee avatar
4. Tap otázku → `/t/:id` → scrolluje down do komentářů → najde starý komentář

## 4. Page blueprints (jen changed / new)

### `/t/:id` — Task Detail (expanded pro V3)

- **Purpose**: Edit and discuss one task. Heart of V3.
- **Primary action**: Napsat komentář (write comment) — nahrazuje dřívější „změnit status" jako hlavní akci
- **Secondary actions**: Změnit assignee, změnit prioritu, nastavit deadline, edit title/body (jen autor)
- **Content blocks** (shora dolů, mobile priority):
  1. **Header**: back šipka, type badge (Nápad/Otázka), delete trash
  2. **Title** (bordered input, editovatelný jen autorem)
  3. **Body** (Tiptap rich text, editovatelný jen autorem) — z V2
  4. **Meta-row** (NEW V3, inline badges): priority + deadline + assignee avatar + „Změnit" link
  5. **Status select** (segmented control) — z V2
  6. **Category multi-select** (N:M, NEW V3) — místo 1:1 z V2
  7. **Location** picker — z V2
  8. **Přílohy** obrázky + odkazy — z V2
  9. **Linked otázky** stack (nápad → otázky) — z V2
  10. **Parent link** (otázka → nápad) — z V2
  11. **Convert button** (nápad → další otázka) — z V2
  12. **Komentáře vlákno** (NEW V3) — title „Diskuse ({count})" + seznam komentářů + composer
  13. **Metadata** (created/updated) — z V2
- **Data dependencies**: 
  - `tasks/{id}` (useTask)
  - `tasks/{id}/comments` subcollection (useComments nové)
  - `users` collection (pro mention autocomplete + assignee dropdown + avatar render)
  - `allTasks` (pro linked otázky lookup, už v V2)
- **Empty / loading / error**:
  - Komentáře empty: „Zatím žádná diskuse. Napiš první komentář."
  - Komentáře loading: 3 skeleton rows
  - Komentář send fail (offline): toast „Nejsi online, zkus později"

### `/prehled` — Dashboard (NEW V3)

- **Purpose**: OWNER + PM rychle vidí, kde je zaseklá práce
- **Primary action**: Tap na konkrétní otázku z listu uvízlých → jít ji vyřešit
- **Secondary actions**: Přepnout filter (Čeká na mě / Čeká na jiné / Po deadline / Uvízlé)
- **Content blocks**:
  1. **Header**: back šipka, title „Přehled"
  2. **M2 status banner**: pokud „Uvízlé ≥5 dní" ≤ 3, zelený ticker „V cíli: X/3"; jinak červený „Přes cíl: X/3"
  3. **4× counter grid** (2 sloupce × 2 řádky na mobilu):
     - „Čeká na mě" (assigneeUid = user.uid && status in `[Otázka, Čekám]`)
     - „Čeká na jiné" (assigneeUid ≠ user.uid && status in `[Otázka, Čekám]`)
     - „Po deadline" (deadline < now && status ≠ Hotovo)
     - „Uvízlé ≥5 dní" (status === „Čekám" && now − lastActivityAt ≥ 5 dní)
  4. **Aktivní sekce** (default „Čeká na mě"): list otázek s kartami (stejné NapadCard jako jinde)
  5. **Přepínač sekce** (tabs nad listem): switch mezi 4 sekcemi; URL `?filter=stuck|overdue|waiting-me|waiting-others`
- **Data dependencies**: `useTasks(true)` — už existuje, filtr klient-side
- **Empty states**:
  - „Čeká na mě" prázdné: „Zatím na tobě nic není. Dobrá práce."
  - „Po deadline" prázdné: „Žádná otázka po termínu."
  - „Uvízlé" prázdné: „Žádná otázka není uvízlá. V cíli."
- **Deep-link**: `/prehled?filter=stuck` pro kotvení z `/otazky` header pillu

### `/otazky` — Otázky List (changed)

- **Purpose**: stejné jako V2 — browse všech otázek
- **Primary action**: Tap otázku → jít do detailu
- **Secondary actions** (header):
  - **„Uvízlé (N)" pill** (NEW V3) — pokud N > 0, tap → `/prehled?filter=stuck`
  - **Lokace / Kategorie tab switcher** (NEW V3) — přepíná skupinování listu
  - **Reset filter X** (NEW V3) — jedno tlačítko vpravo od filter chipů, visible jen když je nějaký filter aktivní
- **Content blocks** (shora dolů):
  1. **H2 „Otázky pro Projektanta"** + „Uvízlé 3" pill vpravo (NEW)
  2. **Group-by tabs**: `Lokace` | `Kategorie` | `Plochý seznam` (NEW V3, default „Plochý seznam" — nová volba)
  3. **Filter chips row**: status + category + location chips (stejné jako V2), ale nakonci **Reset X** pill visible když active filter
  4. **Task list** — pokud group-by = „Plochý", stejně jako V2; jinak sekce s headers (buď lokace nebo kategorie)
  5. Každá karta v listu (NapadCard): title + priority badge + deadline chip + assignee avatar + status badge + binary icons (V2)

### `/napady` + `/lokace/:id` — Lists (minor changes)

Stejné jako V2, navíc:
- Reset-filter pill (NEW V3)
- Multi-kategorie badges na kartě místo single category
- Pro `/lokace/:id`: stejný design, just data

Nápady nemají priority/deadline/assignee — karta jen dostane multi-kategorie badge.

### `/nastaveni` — Settings (changed)

- **Nový blok nahoře**: karta **„Přehled"** velká (tap → `/prehled`), pod ní 3 mini counters (Čeká na mě, Po deadline, Uvízlé)
- **Zbytek** stejný jako V2: theme toggle, Kategorie link, Export link, Sign out

## 5. Content inventory (new V3 types)

| Type | Fields | Source | Owner |
|---|---|---|---|
| **Comment** | `id`, `authorUid`, `body` (markdown), `createdAt`, `editedAt?`, `attachmentImages[]` (≤3), `attachmentLinks[]` (≤10), `mentionedUids[]`, `reactions: {[emoji]: uid[]}` | `tasks/{id}/comments/{cid}` subcollection | Autor komentáře |
| **User profile** (expanded) | `uid`, `email`, `displayName`, `role`, `avatarSeed` (derived from uid, cached) | `users/{uid}` | User sám (přes Firebase Auth) |
| **Priority** | enum `"P1" | "P2" | "P3"` | `tasks/{id}.priority` | Task autor |
| **Deadline** | `Timestamp | null` | `tasks/{id}.deadline` | Task autor |
| **Assignee** | `uid | null` | `tasks/{id}.assigneeUid` | Task autor může měnit |
| **Category multi** | `string[]` | `tasks/{id}.categoryIds` | Task autor |

Task interface se rozšiřuje, plus 1 nová subcollection.

## 6. URL & state model (delta)

- **Nové URL**:
  - `/prehled` — bare dashboard s defaultním filtrem „Čeká na mě"
  - `/prehled?filter=stuck` — deep-linkable, pro kotvení z `/otazky` pillu
  - `/otazky?group=kategorie|lokace|flat` — group-by state v URL (default `flat` pokud neuveden)
- **Zůstává v local state (not URL)**:
  - Filter chips selections (status, category, location) — pokračujeme s `localStorage` persistencí z V2
  - `/prehled` aktivní filter override přes URL má přednost, jinak default
- **Deep-linkable seznam** (musí fungovat sdílení URL):
  - `/t/:id` (funguje z V1)
  - `/lokace/:id` (V2)
  - `/prehled?filter=X` (V3)

## 7. Navigation patterns

- **Breadcrumbs**: nadále žádné — mobile-first, back šipka stačí
- **Back chování**: stejně jako V2 — React Router `navigate(-1)` v TaskDetail, NavLink tab bar jinde. Z `/prehled` back na `/nastaveni`, ne na `/`
- **Persistence filtrů**: 
  - List page filtry: `localStorage` per-page key (V2 behavior)
  - `/prehled` filter: URL-driven, nepersistuje (každé otevření default „Čeká na mě")
  - **Reset filter button**: maže `localStorage` key pro danou stránku → přechází na default stav

## 8. Open structural questions

- [ ] Category multi-select UI — V2 má CategoryPicker dropdown s 1 selection. V3 potřebuje multi-select. **Varianta A**: chip field (tap kategorii → přibyde chip, tap chip → remove) **Varianta B**: modal s checkboxy. **Default A** (chip je mobile-friendly). Potvrdit v design-tokens / frontend-design.
- [ ] Komentář composer — kde? **Varianta A**: inline nad seznamem komentářů, always visible. **Varianta B**: sticky footer composer (jako Slack/iMessage). **Default A** (single-screen scroll, menší složitost). V noise může být konfliktní s mobile keyboardem, ověřit v design-review.
- [ ] Assignee dropdown — kde se bere pool uživatelů? V2 má `users` collection s 2 záznamy (owner+pm). V3 bude dropdown s všemi users v collection. Ověřit, že security rules dovolí `list` na users pro owner i pm (dnes to má jen owner).
- [ ] Mention autocomplete — performance: každé zadání `@` spustí filter přes users collection. S 3 users triviální. S 20+ už začíná počítat. **Default**: in-memory filter s cached `users` snapshot. Pro V3 stačí.
- [ ] `/prehled` counter ikony — potřebujeme dát emoji (🕐 ⏰ ❗) nebo jen barvy + text? **Default**: barva + textový label, bez emoji, konzistence s V2 aesthetic.
- [ ] Group-by „Plochý seznam" vs. V2 current behavior — V2 nemá group-by tab, vždy flat. V3 přidává. Default nový „Plochý seznam" = stejné jako dnes. Uživatel si může opt-in do Lokace/Kategorie group-by.

---

## Co odstraňuje / mění V3 oproti V2

| V2 | V3 |
|---|---|
| TaskDetail: 1 singular `linkedTaskId` pro otázka→nápad | Zůstává (otázka → 1 rodič nápad) |
| TaskDetail: `linkedTaskIds[]` pro nápad→otázky | Zůstává |
| CategoryPicker single-select | **Multi-select chip field (V3)** |
| Žádný assignee | **`assigneeUid` field + dropdown v detailu + avatar v listu** |
| Žádná priorita | **P1/P2/P3 badge + selector v detailu** |
| Žádný deadline | **Date picker v detailu + countdown chip v listu** |
| Žádné komentáře | **Thread pod task bodem, @mention, reakce, hard delete** |
| List filter chips bez resetu | **Reset tlačítko když je filter active** |
| `/otazky` bez group-by | **Tabs Lokace/Kategorie/Plochý** |
| Žádná `/prehled` | **Nová stránka + card v Nastavení** |
