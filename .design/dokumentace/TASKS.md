# Dokumentace — Build Plan

**Generated from**: DESIGN_BRIEF.md (2026-04-27), INFORMATION_ARCHITECTURE.md
**Total slices**: 12
**Critical path**: S01 → S02 → S03 → S05 → S07 → S09 (6 slices, ~6 dní)

---

## Phase 0 — Foundations

### S01: TaskType "dokumentace" + základní CRUD
- **Goal**: Rozšířit Task entitu o type `dokumentace`, vytvořit/číst/editovat záznam.
- **Scope**:
  - `types.ts`: rozšířit `TaskType` union o `"dokumentace"`
  - `types.ts` (functions): mirror
  - `lib/tasks.ts`: `createTask` + `fromDocSnap` support pro dokumentace
  - `lib/enums.ts`: přidat do `TASK_TYPES`
  - `lib/status.ts`: dokumentace nemá status workflow — ošetřit v `statusLabel`, `mapLegacy*` (no-op)
  - `lib/permissionsConfig.ts`: nová akce `task.create.dokumentace` (OWNER + PM)
  - `firestore.rules`: povolit create/edit pro dokumentace (stejný pattern jako nápad + cross-OWNER)
  - `i18n/cs.json`: `"type.dokumentace"`, `"dokumentace.*"` klíče
- **Out of scope**: UI, upload, document karty
- **Dependencies**: none
- **Acceptance criteria**:
  - [ ] `TaskType` union obsahuje `"dokumentace"`
  - [ ] `createTask({ type: "dokumentace", title: "Test" })` zapíše do Firestore
  - [ ] `fromDocSnap` správně deserializuje dokumentace záznam
  - [ ] Firestore rules povolí create pro OWNER i PM
  - [ ] `npm run build` projde bez chyb v `app/` i `app/functions/`
- **Size**: M
- **Demo**: Firestore console ukazuje task s `type: "dokumentace"`.

---

## Phase 1 — First usable path (upload + prohlížení)

### S02: Composer — typ Dokumentace + redirect na detail
- **Goal**: OWNER/PM může vytvořit záznam Dokumentace přes ⊕ FAB.
- **Scope**:
  - `components/Composer.tsx`: přidat `"dokumentace"` do type picker (ikonka FileText)
  - `routes/NewTask.tsx`: `allowedTypes` pro PM zahrnuje dokumentace
  - `lib/createTaskFromComposerInput.ts`: handling pro dokumentace (title only, no images při create)
  - Po uložení → redirect na `/t/:id` (stávající flow)
- **Out of scope**: Upload dokumentů v composeru (to je až v detailu)
- **Dependencies**: S01
- **Acceptance criteria**:
  - [ ] FAB → composer zobrazuje typ „Dokumentace" s ikonkou
  - [ ] OWNER i PM vidí „Dokumentace" v type pickeru
  - [ ] Po uložení redirect na TaskDetail
  - [ ] Title se zobrazí v detailu
- **Size**: S
- **Demo**: Tap ⊕ → vyber Dokumentace → napiš „Elektroinstalace" → uloží → vidíš detail.

### S03: TaskDetail — režim dokumentace (shell + metadata)
- **Goal**: Detail zobrazuje záznamu dokumentace se správným layoutem.
- **Scope**:
  - `routes/TaskDetail.tsx`: detekce `task.type === "dokumentace"` → vlastní layout branch
  - Layout: back button → title (editovatelný) → sharedWithRoles badge → kategorie chips
  - Žádný status/priority/phase/deadline/assignee picker (null pro dokumentace)
  - Description field (skrytý/kolapsovatelný)
  - Empty state pro dokumenty: „Zatím žádné dokumenty. Nahrajte první."
- **Out of scope**: Upload modal, document karty, audit trail
- **Dependencies**: S01, S02
- **Acceptance criteria**:
  - [ ] `/t/:id` pro dokumentace zobrazuje title + sharedWithRoles + kategorie
  - [ ] Žádný status/priority/phase picker není viditelný
  - [ ] Title je editovatelný (canEdit logika funguje)
  - [ ] sharedWithRoles je editovatelný
  - [ ] Empty state se zobrazí
- **Size**: M
- **Demo**: Otevři vytvořenou dokumentaci → vidíš title, sharing, kategorie, empty state.

### S04: Admin — typy dokumentů (CRUD)
- **Goal**: OWNER může spravovat seznam typů dokumentů v nastavení.
- **Scope**:
  - Firestore kolekce `documentTypes/` (id, label, sortOrder, createdAt)
  - `hooks/useDocumentTypes.ts`: CRUD hook
  - `routes/DocumentTypesManage.tsx`: nová routa `/nastaveni/typy-dokumentu`
  - UI: list + přidat + inline edit + smazat
  - Seed výchozích 7 typů při prvním přístupu (nebo migration skript)
  - `routes/Settings.tsx`: nový řádek „Typy dokumentů" s linkem
  - `lib/routes.ts`: nová routa `dokumentTypy`
  - `App.tsx`: route + OWNER-only guard
  - Firestore rules pro `documentTypes/` (OWNER read/write)
- **Out of scope**: Řazení drag-and-drop
- **Dependencies**: none (paralelizovatelné s S02/S03)
- **Acceptance criteria**:
  - [ ] `/nastaveni` zobrazuje řádek „Typy dokumentů" (jen OWNER)
  - [ ] `/nastaveni/typy-dokumentu` zobrazuje list typů
  - [ ] OWNER může přidat nový typ
  - [ ] OWNER může přejmenovat existující typ
  - [ ] OWNER může smazat typ (s potvrzením)
  - [ ] Výchozí 7 typů se seedne automaticky
  - [ ] PM nevidí a nemůže přistoupit na admin stránku
- **Size**: M
- **Demo**: Nastavení → Typy dokumentů → přidej „Revizní zpráva" → vidíš v seznamu.

### S05: Upload modal + document karty v detailu
- **Goal**: OWNER může nahrát PDF/obrázek do záznamu dokumentace a vidět ho jako kartu.
- **Scope**:
  - `components/DocumentUploadModal.tsx`: nový modal — file picker + typ dropdown (z `useDocumentTypes`) + název input + nahrát/zrušit
  - Data model: pole `documents[]` na Task entitě (fileUrl, filePath, contentType, sizeBytes, docType, displayName, uploadedBy, uploadedAt)
  - `types.ts`: `DocumentAttachment` interface
  - `lib/attachments.ts`: rozšířit upload flow (routing PDF vs obrázek — stávající `isImageFile`)
  - `components/DocumentCard.tsx`: karta s ikonkou (PDF=FileText, obrázek=Image), název, typ, datum
  - `routes/TaskDetail.tsx`: dokumentace layout → grid karet + „Přidat dokument" CTA
  - Tap na PDF → `window.open(url, "_blank")` (otevře v externí appce)
  - Tap na obrázek → lightbox (stávající ImageLightbox, ale filtrovat jen obrázky)
  - Storage rules: stávající `files/` a `images/` paths
  - Firestore rules: update `documents[]` pole (OWNER/PM autor + cross-OWNER)
- **Out of scope**: Replace, delete, audit trail
- **Dependencies**: S03, S04
- **Acceptance criteria**:
  - [ ] „Přidat dokument" CTA v detailu otevře modal
  - [ ] Modal: výběr souboru + typ z dropdown + název → nahrání
  - [ ] Po nahrání se objeví karta s PDF ikonkou, názvem a typem
  - [ ] Tap na PDF kartu otevře v nové záložce / externí appce
  - [ ] Tap na obrázek kartu otevře lightbox
  - [ ] Soubor > 10 MB → error toast
  - [ ] Nepodporovaný formát → error toast
- **Size**: L
- **Demo**: Detail dokumentace → Přidat dokument → vyber PDF → typ „Smlouva" → název „Smlouva XY" → nahrát → vidíš kartu → tap → otevře se PDF.

### S06: Záznamy list — dokumentace karty + type filtr
- **Goal**: Dokumentace záznamy se zobrazují v `/zaznamy` a dají se filtrovat.
- **Scope**:
  - `routes/Zaznamy.tsx`: rozšířit filter o `type` chip („Vše" / „Nápady" / „Dokumentace")
  - `components/TaskList.tsx` / `TaskCard.tsx`: handling pro `type === "dokumentace"` — ikonka FileText, badge „Dokumentace", počet dokumentů
  - PM vidí dokumentace záznamy sdílené přes sharedWithRoles (stávající logika)
  - `lib/filters.ts`: nový filter type
  - Persist filter do localStorage (stávající pattern)
- **Out of scope**: Sort options
- **Dependencies**: S01
- **Acceptance criteria**:
  - [ ] `/zaznamy` zobrazuje dokumentace záznamy mezi nápady
  - [ ] Filter chip „Dokumentace" filtruje jen dokumentace
  - [ ] Dokumentace karta má ikonku FileText a badge s počtem dokumentů
  - [ ] PM vidí jen sdílené dokumentace
  - [ ] Filter se persistuje mezi navigacemi
- **Size**: M
- **Demo**: Záznamy → filtr „Dokumentace" → vidíš jen dokumentace karty → tap → detail.

---

## Phase 2 — Replace, delete, audit trail

### S07: Replace + delete dokumentu
- **Goal**: Autor může nahradit existující dokument novým a smazat dokument.
- **Scope**:
  - Replace flow: tap na dokument → context menu / long-press → „Nahradit" → upload modal pre-filled z předchozího (typ + název) → potvrzení → starý soubor smazán ze Storage, nový nahrán
  - Delete flow: context menu → „Smazat" → confirmation dialog → smazání ze Storage + odstranění z `documents[]`
  - `components/DocumentCard.tsx`: přidat akční menu (… ikona nebo long-press)
  - Permissions: jen autor záznamu + cross-OWNER
- **Out of scope**: Audit trail zápis (to je S08)
- **Dependencies**: S05
- **Acceptance criteria**:
  - [ ] Long-press / menu na kartě nabízí „Nahradit" a „Smazat"
  - [ ] Replace otevře modal s pre-filled typ + název
  - [ ] Po replace se karta aktualizuje s novým souborem
  - [ ] Delete smaže soubor ze Storage i z dokumentu
  - [ ] PM bez edit práv nevidí akční menu
- **Size**: M
- **Demo**: Karta dokumentu → … → Nahradit → vyber nový PDF → potvrdí → karta se aktualizuje.

### S08: Audit trail
- **Goal**: U každého dokumentu je viditelné kdo/kdy nahrál, nahradil, smazal.
- **Scope**:
  - Data model: pole `auditLog[]` na Task entitě (action, actorUid, timestamp, details)
  - Actions: `uploaded`, `replaced`, `deleted`, `metadata_changed`
  - `lib/tasks.ts`: helper `appendAuditEntry` — atomic array union při upload/replace/delete
  - `components/AuditTimeline.tsx`: kolapsovatelný timeline v detailu dokumentace
  - Zobrazení: „Stáňa nahrál Cenová nabídka (12.4.2026)", „PM nahradil Smlouva (15.4.2026)"
  - `hooks/useUsers.ts`: resolve uid → jméno (stávající)
- **Out of scope**: Filtrování auditu, export
- **Dependencies**: S05, S07
- **Acceptance criteria**:
  - [ ] Nahrání dokumentu vytvoří audit záznam `uploaded`
  - [ ] Nahrazení vytvoří `replaced` s referencí na předchozí
  - [ ] Smazání vytvoří `deleted`
  - [ ] Timeline se zobrazí kolapsovatelně v detailu
  - [ ] Jména se resolvují správně
- **Size**: M
- **Demo**: Detail dokumentace → rozbal audit → „Stáňa nahrál Cenová nabídka Novák dne 27.4.2026".

---

## Phase 3 — Linkování z tasků

### S09: linkedDocIds + sekce „Přiložená dokumentace" v TaskDetail
- **Goal**: Z nápadu/otázky/úkolu lze přilinkovat existující dokumentaci.
- **Scope**:
  - `types.ts`: přidat `linkedDocIds?: string[]` na Task
  - `types.ts` (functions): mirror
  - `components/DocumentPickerModal.tsx`: multi-select modal — search + list karet dokumentace + checkbox → „Připojit"
  - `components/LinkedDocumentsList.tsx`: kompaktní karty (ikonka + title + počet dok.) + tap → navigace na `/t/:docId` + X button pro odebrání
  - `routes/TaskDetail.tsx`: sekce „Přiložená dokumentace" pod kategorií (pro nápad/otázka/úkol)
  - `lib/tasks.ts`: `updateTask` patch pro `linkedDocIds`
  - Firestore rules: update `linkedDocIds` → kdo smí editovat task
  - Permissions: CTA „Připojit dokumentaci" jen pokud canEdit
- **Out of scope**: Zpětný link z dokumentace na task (V2)
- **Dependencies**: S01, S05
- **Acceptance criteria**:
  - [ ] Detail nápadu/otázky/úkolu zobrazuje sekci „Přiložená dokumentace"
  - [ ] CTA „Připojit dokumentaci" otevře picker modal
  - [ ] Picker zobrazuje jen dokumentace, které user vidí
  - [ ] Po výběru se karty zobrazí v sekci
  - [ ] Tap na kartu naviguje na detail dokumentace
  - [ ] X button odebere link (jen kdo smí editovat)
  - [ ] Prázdná sekce se nezobrazuje (pokud nemá edit práva)
- **Size**: L
- **Demo**: Detail úkolu → Připojit dokumentaci → vyber „Elektroinstalace" → vidíš kartu → tap → detail dokumentace.

---

## Phase 4 — Notifikace + polish

### S10: Push notifikace při nahrání dokumentu
- **Goal**: Protistrana dostane push když někdo nahraje dokument do sdíleného záznamu.
- **Scope**:
  - `functions/src/notify/types.ts`: nový `NotificationEventKey` `document_uploaded`
  - `functions/src/notify/catalog.ts`: entry pro `document_uploaded`
  - `functions/src/triggers/onTaskWrite.ts`: detekce nového dokumentu v `documents[]` → `sendNotification`
  - `i18n/cs.json`: notifikační klíče
  - `components/NotificationPrefsForm.tsx`: ikona pro document_uploaded
  - `components/NotificationList.tsx`: ikona + render
  - Deep link na `/t/:docId`
- **Out of scope**: Notifikace při linkování (V2)
- **Dependencies**: S05
- **Acceptance criteria**:
  - [ ] OWNER nahraje dokument → PM dostane push (pokud sdíleno)
  - [ ] PM nahraje dokument → OWNER dostane push
  - [ ] Tap na notifikaci → deep link na detail dokumentace
  - [ ] Notifikace se zobrazí v inbox (bell)
  - [ ] User může vypnout v nastavení preferencí
- **Size**: M
- **Demo**: OWNER nahraje PDF do sdíleného záznamu → PM dostane push → tap → detail.

### S11: Edge cases + empty states + error handling
- **Goal**: Robustní handling všech edge cases.
- **Scope**:
  - Empty states: žádné dokumentace v záznamu, žádné záznamy v listu, žádné typy dokumentů
  - Error states: upload fail (offline, timeout), soubor příliš velký, nepodporovaný formát
  - Loading states: skeleton karty při načítání dokumentů
  - Offline: toast při pokusu o upload offline
  - PDF otevření fallback: pokud `window.open` selže → download link
  - Lightbox: ošetřit že PDF se NEDÁVÁ do lightboxu (routing contentType)
- **Out of scope**: Retry mechanismus pro failed uploads
- **Dependencies**: S05, S06, S09
- **Acceptance criteria**:
  - [ ] Každý empty state má smysluplný text + CTA
  - [ ] Upload offline → toast „Jste offline"
  - [ ] Soubor > 10 MB → toast s limitem
  - [ ] PDF nikdy neotevře lightbox
  - [ ] Loading skeleton se zobrazí při pomalém připojení
- **Size**: S
- **Demo**: Odpoj internet → zkus upload → toast. Nový záznam bez dokumentů → empty state s CTA.

### S12: Design review pass
- **Goal**: Vizuální a UX audit celé Dokumentace feature.
- **Scope**:
  - Spustit `/design-review` na live buildu
  - Ověřit: touch targets (min-h-tap), contrast, dark mode (pokud existuje), responsive layout
  - Ověřit: konzistence s existujícím design language (pill chips, badge combobox)
  - File follow-up slices z findings
- **Dependencies**: S01–S11
- **Acceptance criteria**:
  - [ ] Design review proběhl, DESIGN_REVIEW.md zapsán
  - [ ] Kritické findings opraveny
  - [ ] Všechny touch targets ≥ 44px
- **Size**: S
- **Demo**: Celá Dokumentace feature funguje end-to-end, vizuálně konzistentní.

---

## Out-of-phase backlog (V2+)

- Zpětný link z dokumentace na tasky, které na ni linkují
- Komentáře na záznamu Dokumentace
- Drag-and-drop řazení typů dokumentů
- Notifikace při přilinkování dokumentu k tasku
- Fulltextové hledání v obsahu PDF (OCR)
- Verzování dokumentů (historie replacementů)
- Expiry / archivace starých dokumentů
- Bulk upload (více souborů najednou)

---

## Risks & mitigations

1. **Dokumenty izolované od workflow** — Mitigation: S09 (linkování) je v critical path, Phase 3 se dělá hned po základním uploadu.
2. **Upload modal těžkopádný na mobilu** — Mitigation: S05 testovat na reálném telefonu. Pokud friction příliš vysoký, zvážit quick-upload (soubor → auto-detect typ) jako follow-up.
3. **PDF otevření v externí appce** — Mitigation: S11 zahrnuje fallback na download. Testovat iOS Safari + Android Chrome.
4. **`documents[]` pole vs subkolekce** — Rozhodnutí: začínáme s polem (jednodušší, jeden fetch). Pokud se ukáže limit (velké záznamy s 20+ dokumenty), migrace na subkolekci.
5. **Audit trail velikost** — `auditLog[]` pole může růst. Při > 50 entries zvážit paginaci nebo subkolekci. Pro V1 (desítky dokumentů) pole stačí.
