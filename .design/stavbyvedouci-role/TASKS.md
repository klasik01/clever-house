# Stavbyvedoucí Role (CONSTRUCTION_MANAGER) — Build Plan

**Generated from**: DESIGN_BRIEF.md (2026-04-29), DISCOVERY.md (2026-04-29)
**Total slices**: 13
**Critical path**: S01 → S02 → S03 → S04 → S06 → S07 *(6 slices = "CM dokončí svůj první úkol end-to-end")*
**Estimated**: 6–9 dní práce, pokud Claude implementuje komplet a Stáňa reviewuje denně.

---

## Phase 0 — Foundations

Žádný standalone slice. Foundations (UserRole union extension, i18n role label) jsou složené do **S01**, aby každý slice byl demoable.

---

## Phase 1 — First usable path

**Cíl fáze:** CM se přihlásí, uvidí svoje úkoly, otevře jeden, označí ho jako hotový. To je celá smyčka, která hýbe primary metric (80 % zadaných úkolů dokončeno bez dotazu).

### S01: Bootstrap nové role + graceful empty state

- **Goal:** CM se přihlásí Googlem, app neshodí, ať už mu Stáňa roli zapsal ve Firestore Console nebo ne.
- **Scope:**
  - `app/src/types.ts`: rozšířit `UserRole = "OWNER" | "PROJECT_MANAGER" | "CONSTRUCTION_MANAGER"`.
  - `functions/src/notify/types.ts`: stejný mirror.
  - `app/src/i18n/cs.json`: `role.CONSTRUCTION_MANAGER = "Stavbyvedoucí"` (krátká forma `"Stavbyved."`).
  - `useUserRole`: discriminated union state musí pokrýt `{status: "missing"}` pro případ, že `users/{uid}` neexistuje.
  - `Shell.tsx` / `routes/Auth/Login.tsx`: pro `status: "missing"` zobrazit empty state "Tvůj účet ještě není nastaven, kontaktuj prosím OWNERa".
- **Out of scope:** žádné CM-specifické permissions, žádné UI gating, žádné rules.
- **Dependencies (blockedBy):** none
- **Acceptance criteria:**
  - [ ] `UserRole` union přidaný v obou typech.
  - [ ] `cs.json` má dva nové stringy (full + short).
  - [ ] CM s manuálně zapsanou rolí v Firestore Console se přihlásí a uvidí standardní Shell (zatím s PM-like permissions, opraveno v S02-S04).
  - [ ] CM bez rolí ve Firestore (po prvním Google login) uvidí "Tvůj účet ještě není nastaven" stránku, ne crash.
  - [ ] `npm test` v `app/` projde.
- **Size:** S
- **Demo:** Stáňa pozve testovacího CM přes Google login → vidí "kontaktuj OWNERa" → Stáňa zapíše roli → CM refreshne → vidí Shell.

---

### S02: Server-side read gate (firestore.rules)

- **Goal:** CM nesmí v Network panelu uvidět ŽÁDNÝ task s `type: "napad"` ani `type: "dokumentace"` bez share. Defense in depth.
- **Scope:**
  - `app/deploy/firestore.rules`: `tasks` read rule rozšířena o composite check:
    ```
    allow read: if isOwner() || isPM() ||
      (isCM() && (
        (resource.data.type in ["otazka","ukol"] && (
          resource.data.assigneeUid == request.auth.uid ||
          resource.data.createdBy == request.auth.uid ||
          (resource.data.authorRole == "CONSTRUCTION_MANAGER")
        )) ||
        (resource.data.type == "dokumentace" &&
          "CONSTRUCTION_MANAGER" in resource.data.sharedWithRoles)
      ));
    ```
  - `comments` subkolekce: read inherit z parent task read (per existing pattern).
  - `storage.rules`: pokud attachment paths jsou per-task, gate se odvíjí z task read.
  - Dev deploy + manual smoke test 3 rolemi: OWNER, PM, CM.
- **Out of scope:** create / edit / delete rules (S04).
- **Dependencies (blockedBy):** S01
- **Acceptance criteria:**
  - [ ] Rules deployed na dev.
  - [ ] CM Firestore query na `/tasks` vrátí jen povolené dokumenty (typ otazka/ukol vlastní + scoped dokumentace + cross-CM team scope).
  - [ ] Direct fetch `GET /tasks/{napadId}` od CM vrátí permission denied.
  - [ ] OWNER + PM read se nezměnil (kontrola přes existující testovací data).
  - [ ] Storage attachment fetch pro skrytý task vrací 403.
- **Size:** M
- **Demo:** Stáňa otevře dev appku jako CM, otevře DevTools → Network, vidí v `tasks` query payloadu jen vlastní otázky/úkoly + sdílené dokumentace.

---

### S03: Shell + route guards + default landing

- **Goal:** CM po loginu zamíří na `/ukoly` s filtrem `assigneeUid === me`, vidí v Shell jen 4 relevantní taby.
- **Scope:**
  - `Shell.tsx`: role-based tab visibility. Pro CM skrýt `Zaznamy`, `Harmonogram`, `Prehled`.
  - Default route logic: pokud CM landne na `/`, `/zaznamy`, `/harmonogram`, `/prehled` → redirect `/ukoly`.
  - `useTasks` / `useVisibleTasks`: pro CM upravit query — `where("type", "in", ["otazka","ukol","dokumentace"])` + per-type sub-queries pro client-side merge (Firestore neumí složené OR napříč fields ve fewer queries).
  - `Ukoly` route: filter `assigneeUid === me` defaultně pro CM.
- **Out of scope:** Empty states polish (S10), AssigneeSelect filter (S05).
- **Dependencies (blockedBy):** S02 (bez rules read gate by client query padl na pravidlech).
- **Acceptance criteria:**
  - [ ] CM po loginu přistane na `/ukoly`.
  - [ ] V Shellu vidí jen `Ukoly`, `Otázky`, `Dokumentace`, `Events`.
  - [ ] Manuální navigace na `/zaznamy` redirectne na `/ukoly`.
  - [ ] V `/ukoly` vidí jen tasky kde `assigneeUid === me` nebo `createdBy === me` nebo cross-CM team match (per S02 rules).
  - [ ] OWNER/PM Shell beze změny.
- **Size:** M
- **Demo:** CM se přihlásí, automaticky `/ukoly`, vidí 3 fake assigned úkoly. Klikne na `Otázky`, vidí svoje. Klikne na `Dokumentace`, vidí prázdno (žádné share zatím).

---

### S04: permissionsConfig.ts CM column + invariant tests

- **Goal:** Klientské UI gating zrcadlí server rules. Single source of truth pro UI hide/disable.
- **Scope:**
  - `app/src/lib/permissionsConfig.ts`: rozšíření všech 20 `PERMISSIONS` entries o `CONSTRUCTION_MANAGER` v `roles[]` podle matrice z DESIGN_BRIEF § Permission matrix.
  - `permissionsConfig.test.ts`: invariant testy projdou (každá rule má `description`, `rulesAt`, neprázdné `roles[]`).
  - `npm run docs:permissions`: regenerovaný `PERMISSIONS_GENERATED.md` v repu.
  - `rulesAt` pointers v každé rule ukazují na konkrétní řádek `firestore.rules` (po S02).
- **Out of scope:** UI komponenty zatím nečtou nový stav — fixed v S05/S06.
- **Dependencies (blockedBy):** S02 (rules existují), S01 (UserRole existuje)
- **Acceptance criteria:**
  - [ ] Všech 20 akcí ve `PERMISSIONS` má konzistentní stav pro CM.
  - [ ] `permissionsConfig.test.ts` invariants pass.
  - [ ] `PERMISSIONS_GENERATED.md` obsahuje CM column, regenerovaný soubor je commitnutý.
  - [ ] `npm test` projde.
- **Size:** M
- **Demo:** PR diff ukazuje aktualizovanou matrici. `PERMISSIONS_GENERATED.md` má novou kolonku.

---

### S05: Composer + AssigneeSelect gating

- **Goal:** CM nemůže v Composeru vytvořit `napad` ani `dokumentaci`. OWNER/PM nemůže přiřadit CM k nápadu (defense in depth).
- **Scope:**
  - `Composer.tsx`: type picker filtruje volby přes `permissionsConfig` → CM vidí jen `otazka` a `ukol`. UI tlačítka pro `napad`/`dokumentace` skryté (ne disabled).
  - `AssigneeSelect.tsx`: prop `taskType` filtruje seznam users — pro `napad` context vyfiltruj out CM uživatele.
  - `firestore.rules`: validation v `tasks` create rule — `napad` task nesmí mít `assigneeUid` patřící CM uživateli (`get(/users/{assigneeUid}).role != "CONSTRUCTION_MANAGER"`).
- **Out of scope:** TaskDetail enforcement (S06).
- **Dependencies (blockedBy):** S04
- **Acceptance criteria:**
  - [ ] CM otevře `/t/new`, vidí jen "Otázka" a "Úkol".
  - [ ] OWNER otevře `/t/new`, vybere `napad`, AssigneeSelect neukazuje CM uživatele.
  - [ ] Programatický pokus zapsat napad s `assigneeUid` CM přes klient (mimo UI) padne na rules.
  - [ ] Existující OWNER/PM workflow se nezměnil (smoke test).
- **Size:** M
- **Demo:** CM klikne `+ Nový` → vidí 2 typy. OWNER vytvoří nápad → assignee dropdown bez CM.

---

### S06: TaskDetail read-only + linkedTask filter

- **Goal:** CM otevře úkol → vidí ho, smí komentovat. Otevře dokumentaci → vidí read-only. Nevidí link chip na skrytý nápad.
- **Scope:**
  - `TaskDetail.tsx`: `canEditTask` použít z `permissionsConfig`. CM dostane `isReadOnly = true` pro `dokumentace`.
  - `RichTextEditor`: `disabled` prop respekuje read-only stav.
  - Auto-save (`BLUR_SAVE_DELAY_MS`): `isReadOnlyRef.current = true` blokuje save (per `CLAUDE.md` § 5).
  - Linked task chips: `linkedTaskIds` filter přes klientský `canReadTask({task: targetTask, ...})` před vykreslením. Pokud `false` → chip se vůbec nezobrazí (Hide entirely policy).
  - `useTasks` musí pre-fetch linkované tasky, aby chip filter měl data k rozhodnutí (pravděpodobně už dnes existuje přes batch lookup).
- **Out of scope:** Workflow akce na komentu (S07).
- **Dependencies (blockedBy):** S03, S04
- **Acceptance criteria:**
  - [ ] CM otevře sdílenou dokumentaci → RichTextEditor je read-only, edit tlačítka skryté.
  - [ ] CM otevře úkol s `linkedTaskIds: [napadId]` → žádný link chip pro nápad.
  - [ ] CM otevře úkol s `linkedTaskIds: [otherUkolId]` (na nějž má read access) → chip se ukáže.
  - [ ] OWNER/PM TaskDetail beze změny.
  - [ ] Auto-save pure-helper test pokrývá CM read-only case.
- **Size:** M
- **Demo:** CM klikne na sdílený PDF dokument → vidí obsah, žádné edit tlačítko. Klikne na úkol s linked nápadem → žádný link, jen tělo úkolu.

---

### S07: Workflow akce — CM flip-to-DONE

- **Goal:** CM označí svůj úkol hotový komentářem s workflow akcí. Status flipne na `DONE`, OWNER+PM dostanou notifikaci. **Tady končí Phase 1 — primary metric loop je kompletní.**
- **Scope:**
  - `CommentComposer.tsx` / workflow action picker: pro CM na vlastním úkolu (`assigneeUid === me`) ukázat akci "Hotovo" (`status: DONE`).
  - Skrýt jiné workflow akce pro CM (`BLOCKED`, reassign, change type).
  - `comments` write logic: CM komentář s `workflowAction: "complete"` projde `isCommentSideEffect` rule (povoluje status flip jen na DONE).
  - `firestore.rules`: `isCommentSideEffect` ověří, že status flip OPEN → DONE je povolen pro CM jako assignee.
  - Notifikace: existující `assigned_with_comment` / status flip eventy fungují bez úprav (S08 dořeší recipient logiku obecně).
- **Out of scope:** Notifikace recipient revize (S08).
- **Dependencies (blockedBy):** S06
- **Acceptance criteria:**
  - [ ] CM v TaskDetailu na vlastním úkolu vidí v komentu workflow tlačítko "Hotovo".
  - [ ] Po kliknutí: komentář uložen, task `status: DONE`, OWNER+PM dostanou push.
  - [ ] CM nevidí "Reassign" / "Block" tlačítka.
  - [ ] CM na cizím úkolu (kde NENÍ assignee) workflow akce nevidí.
  - [ ] Server rule: pokus o reassign od CM padne (`tasks.update` rule).
  - [ ] Pure-helper test: `canFlipStatus(cmRole, "OPEN", "DONE", isAssignee=true) === true`.
  - [ ] Pure-helper test: `canFlipStatus(cmRole, "OPEN", "BLOCKED", ...) === false`.
- **Size:** S (logika malá, hlavně permission gates)
- **Demo:** CM ráno vidí 3 úkoly. Klikne na první, napíše komentář "Hotovo, fotka v příloze", klikne "Hotovo". Status DONE, Stáňa dostane push.

> **End of Phase 1.** Demoable: CM dokončí celou smyčku login → seznam → detail → DONE. Primary metric (80 % úkolů dokončeno bez dotazu) je nyní měřitelný.

---

## Phase 2 — Notifikace + sdílení dokumentace

**Cíl fáze:** CM dostává správné notifikace, OWNER/PM mu může efektivně sdílet dokumentaci.

### S08: Notification recipient revisions

- **Goal:** CM nedostane push ani inbox záznam o tasku, který nevidí. Pure-helper testy zaručí, že to platí pro všech 17 event types.
- **Scope:**
  - Pro každý z 17 event types v `functions/src/notify/catalog.ts` + `triggers/`:
    - `mention`: pokud target task není pro CM viditelný → skip pro CM recipient.
    - `comment_on_thread`: gate `canReadTask(cm, task)`.
    - `document_uploaded`: jen pokud `sharedWithRoles` obsahuje recipientovu roli.
    - `task_deleted`: CM dostane jen pokud byl assignee/creator.
    - `assigned`, `assigned_with_comment`, `priority_changed`, `deadline_changed`: stávající logika funguje, ale ověřit, že protistrana self-filter (V16.4) zahrnuje CM correctly.
    - `event_*`: events nejsou role-restricted, beze změny.
  - Pure-helper testy v `functions/src/notify/*.test.ts`: per event type CM recipient case.
  - `cs.json` `notifikace.events.*` stringy beze změny (žádný nový event type).
  - Catalog `clientLabelKey` zachované, prefs UI v Settings respektuje role-relevant defaults.
- **Out of scope:** Polish texty empty states (S10).
- **Dependencies (blockedBy):** S04 (klient permissionsConfig + server rules existují)
- **Acceptance criteria:**
  - [ ] Pure-helper test per 17 event types pokrývá CM recipient případ (skip vs. send).
  - [ ] Manuální E2E: OWNER tagne CM v komentu na nápadu → CM nedostane push, neuvidí inbox záznam.
  - [ ] Manuální E2E: OWNER nahraje dokument bez CM share → CM nedostane `document_uploaded`.
  - [ ] Manuální E2E: OWNER assignuje úkol CM → CM dostane `assigned` push + inbox.
  - [ ] `npm test` v `functions/` projde.
- **Size:** L
- **Demo:** Server logy + Firebase Cloud Messaging dashboard ukazují, že notifikace mířená na CM jsou filtrované podle `canReadTask`.

---

### S09: Document sharing UX — sharedWithRoles toggle pro CM

- **Goal:** OWNER/PM nahraje dokument, vidí v sharing UI checkbox "Sdílet se Stavbyvedoucím". Default = nezaškrtnuto.
- **Scope:**
  - `DocumentUploadModal.tsx` / dokumentace edit form: rozšířit sharing UI o CM toggle (vedle existujícího PM toggle, který přejde na `sharedWithRoles` array).
  - State management: zachovat current PM share default; CM share `false` by default.
  - Edit existujícího dokumentu: stejný toggle dostupný v `TaskDetail` pro autora.
  - `cs.json`: nové i18n stringy "Sdílet se Stavbyvedoucím" + helper hint "CM uvidí dokument read-only".
- **Dependencies (blockedBy):** S04 (rules pro CM dokumentace read existují)
- **Acceptance criteria:**
  - [ ] OWNER nahraje nový dokument → vidí 2 checkboxy: "PM" + "Stavbyvedoucí".
  - [ ] Default state: PM zaškrtnuto, Stavbyvedoucí nezaškrtnuto.
  - [ ] Po zaškrtnutí + uložení: `sharedWithRoles` obsahuje obě role.
  - [ ] CM v `/dokumentace` listu vidí jen sdílené.
  - [ ] Edit toggle v `TaskDetail` funguje (autor smí změnit).
- **Size:** S
- **Demo:** OWNER nahraje PDF s rozměry vnitřních dveří → klikne "Sdílet se Stavbyvedoucím" → CM ho ihned vidí a stáhne.

---

## Phase 3 — Polish, edge cases, hardening

### S10: Empty states + i18n polish + PWA update toast

- **Goal:** CM nikdy nedostane "prázdnou bílou stránku". Manželka a PM se dozvědí o nové roli prvním refreshem.
- **Scope:**
  - Empty state komponenty / texty:
    - `/ukoly` pro CM bez úkolů: "Žádný úkol ti zatím nebyl přiřazen."
    - `/otazky` pro CM bez otázek: "Žádné otázky pro tebe nebo od tebe."
    - `/dokumentace` pro CM: "Žádná dokumentace ti zatím nebyla sdílena. Kontaktuj OWNERa pro přístup."
    - `/events`: stávající stačí.
  - PWA update toast: po deploy na ope, první návštěva existujícího uživatele zobrazí toast "Aplikace byla aktualizována — máš nového kolegu Stavbyvedoucího v týmu".
  - Mechanismus: existující SW navigate update flow (`useSwNavigate`) + flag v localStorage / `useInstallState` rozšíření.
  - i18n stringy: finalizace všech "stavbyvedoucí" textů v `cs.json`.
- **Dependencies (blockedBy):** S03, S07, S09
- **Acceptance criteria:**
  - [ ] Všechny 3 empty states viditelné a textově konzistentní s existujícím tone (česky, neformálně-zdvořile).
  - [ ] PWA toast se zobrazí jednou per zařízení po deploy.
  - [ ] `cs.json` neobsahuje žádný hardcoded text v komponentách (grep pro "Stavbyved" v `app/src/components` a `app/src/routes` vrací 0).
- **Size:** S
- **Demo:** Manželka po nasazení otevře appku, vidí toast. Testovací CM otevře `/dokumentace` → empty state s instrukcí.

---

### S11: Legacy `sharedWithPm` audit

- **Goal:** Žádný legacy task neukáže CM nečekaně kvůli bridge fall-through.
- **Scope:**
  - Audit dev + ope databáze: existují tasky s `sharedWithPm: true` a chybějícím `sharedWithRoles`?
  - Per `CLAUDE.md` § 7: "NEPSAT skript, když runtime bridge ve `fromDocSnap` stačí". Bridge V19 sharedWithPm → sharedWithRoles je už hotov (per CLAUDE.md changelog V19).
  - Pokud audit najde edge case, kde bridge nestačí → vytvořit `app/deploy/pending/2026-MM-DD-V24-shared-with-roles-cm-audit.mjs`.
  - Pokud bridge stačí → žádný skript, jen poznámka v CLAUDE.md.
- **Dependencies (blockedBy):** S02
- **Acceptance criteria:**
  - [ ] Dev audit: 0 tasků kde `sharedWithRoles` undefined a `sharedWithPm === true` zároveň (nebo bridge to handluje).
  - [ ] Pokud potřebné → migrační skript v `pending/` s idempotent guard + dry-run flag.
  - [ ] Decision document v `.design/stavbyvedouci-role/MIGRATIONS.md` ("Skript napsán protože X" nebo "Skript není potřeba protože bridge X").
- **Size:** S (čistě audit)
- **Demo:** `MIGRATIONS.md` s rozhodnutím + případně pending skript s ostrou jak proběhl na dev.

---

### S12: Stáňova runbook dokumentace

- **Goal:** Stáňa umí přidat 3. CM uživatele bez Claude.
- **Scope:**
  - `.design/stavbyvedouci-role/RUNBOOK.md` s krokovým postupem:
    1. Pošli novému stavbyvedoucímu pozvánku k Google login (e-mail / Slack).
    2. Po prvním přihlášení vznikne v `/users/{uid}` stub dokument (přes `useAuth` create flow).
    3. Otevři Firebase Console → Firestore → `users` kolekce → vyhledej podle `email`.
    4. Edit dokument: doplň `role: "CONSTRUCTION_MANAGER"`, `displayName`, případně `contactEmail`.
    5. CM refreshne appku, dostane Shell. Hotovo.
    6. Pro odebrání CM (off-boarding): smaž `users/{uid}` dokument, nebo přepiš na `role: "PROJECT_MANAGER"` pokud přechází z CM na PM.
  - Reference v `CLAUDE.md` § 3 Permissions model (link na RUNBOOK).
- **Dependencies (blockedBy):** S01
- **Acceptance criteria:**
  - [ ] `RUNBOOK.md` existuje, je strukturovaný, s konkrétními kroky.
  - [ ] Stáňa přečte runbook a dokáže přidat fake testovacího CM bez asistence.
- **Size:** S (čistě dokumentační)
- **Demo:** Stáňa otevře RUNBOOK.md, projde kroky na vlastní fake účet, hotovo do 3 minut.

---

### S13: Design-review pass

- **Goal:** Catch-all kontrola po implementaci, najdi co Phase 1-2 missed.
- **Scope:**
  - Spustit `/designer-skills:design-review` na běžícím dev buildu.
  - Smoke test všech 22 položek z `DESIGN_BRIEF.md` § 11 Definition of Done.
  - File follow-up slices pro nálezy.
  - Ověřit, že OWNER/PM workflow nemá regrese (kompletní happy path obou rolí).
- **Dependencies (blockedBy):** S01–S12
- **Acceptance criteria:**
  - [ ] `DESIGN_REVIEW.md` produkován s findings grouped by severity.
  - [ ] Critical/High findings mají follow-up slice S14+.
  - [ ] OWNER/PM smoke test pass.
  - [ ] CM end-to-end smoke test (login → ukol → DONE → dokumentace read).
- **Size:** M
- **Demo:** `DESIGN_REVIEW.md` v `.design/stavbyvedouci-role/`, případné follow-up slices přidané do tohoto souboru.

---

## Out-of-phase backlog

Krátký list, prune aggressively:

- **Admin panel** pro správu CM userů — odložené, vznikají ručně.
- **Storage budget alarm** — ops task, ne feature.
- **Per-user (ne per-role) sharing** — pokud někdy bude potřeba sdílet jednomu konkrétnímu CM ne celému teamu.
- **Bulk grant** "sdílej tuhle složku dokumentace s CM" — multi-select UI.
- **Stavební edge cases** (rukavice, mokré ruce, oslnění slunce) — UX research téma.
- **Audit log read accesses** (kdo si co přečetl a kdy) — compliance feature.

---

## Risks & mitigations

Z `DESIGN_BRIEF.md` § 9, aktualizováno po slicing pass:

1. **Bootstrap user doc (high/high)** — pokrytý v S01 graceful empty state + S12 runbook.
2. **Notification recipient bugs (medium/medium)** — pure-helper testy v S08 per event type.
3. **Hard cutover bez warningu (high/low)** — PWA toast v S10.
4. **Plain-text mention nápadu v komentu (medium/low)** — known limitation, dokumentováno.
5. **Scope creep (high/medium)** — TASKS.md je explicit prioritized; pokud cutneš, jdou ven od konce: S13 (design review) → S11 (legacy audit) → S10 (toast/empty states) → S09 (sharing UX). **NIKDY NESMÍ SPADNOUT: S01–S07 (Phase 1).**
6. **NOVÉ: Cross-CM team scope perf (low/low)** — read rule používá `resource.data.authorRole == "CONSTRUCTION_MANAGER"`, což je field check, ne extra `get()`. OK pro výkon při ~100 tasků datasetu.
7. **NOVÉ: Firestore composite index pro CM queries (medium/medium)** — `where("type", "in", [...])` + `where("assigneeUid", "==", ...)` + order by `updatedAt` může vyžadovat composite index. Nutno připravit `firestore.indexes.json` v rámci S03 a deploynout.

---

**Build plan ready.**

Next: `/frontend-design` to start implementing **S01**, nebo `/design-flow` pokračovat v orchestrované sekvenci.
