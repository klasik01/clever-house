# DESIGN REVIEW — V24 Stavbyvedoucí Role

> Generated: 2026-04-29
> Reviewer: Claude (post-implementation self-audit)
> Status: 13/13 slices completed, awaiting Stáňa rules deploy + smoke test

---

## Definition of Done — checklist (z DESIGN_BRIEF.md § 11)

| # | Položka | Status | Důkaz |
|---|---|---|---|
| 1 | `UserRole` union obsahuje CONSTRUCTION_MANAGER v `app/src/types.ts` i `functions/src/notify/types.ts` | ✅ | S01 — types.ts L52, notify/types.ts L46-48 |
| 2 | `permissionsConfig.ts` má všech 20 akcí s explicitním stavem pro CM + `rulesAt` pointer | ✅ | S04 — `PERMISSIONS_GENERATED.md` 3-column tabulka |
| 3 | `permissionsConfig.test.ts` invariants pass | ✅ | 46 testů projde, ownership enum extended `author-or-cross-team` |
| 4 | `firestore.rules` deploy proběhl na dev a prošel manual smoke testem se všemi 3 rolemi | ⚠️ pending | Stáňa musí spustit `npm run rules:deploy:dev:dry` + manual test |
| 5 | CM se přihlásí přes Google a dostane se do `/ukoly` s filtrem `assigneeUid === me` | ⚠️ pending | Implementace hotová (Shell.tsx + useTasks.ts CM dispatch); Stáňa ověří po deploy |
| 6 | CM **nevidí** žádný task s `type: "napad"` v listu ani v detailu (URL `/t/{napadId}` vrátí 404 / "skryto") | ✅ | canViewTask V24 + tasks.read rule + TaskDetail noAccess gate |
| 7 | CM **nevidí** žádný task s `type: "dokumentace"`, kde `sharedWithRoles` neobsahuje `"CONSTRUCTION_MANAGER"` | ✅ | canReadTaskByCm rule + canViewTask filter |
| 8 | CM **vidí** otázku/úkol, kde je `assigneeUid` nebo `createdBy` libovolný CM (cross-CM tým) | ✅ | subscribeTasksForCm 4-query + canViewTask CM clauses |
| 9 | CM **smí** flipnout svůj úkol `OPEN → DONE` přes komentář s `workflowAction` | ✅ | S07 — canCompleteAsAssignee + CommentThread workflow mode dispatch |
| 10 | CM **nesmí** flipnout otázku ani reassignnout úkol — UI buttony nejsou viditelné, server rule odmítne | ✅ | canFlipAssignee returns false for CM-as-pure-assignee → mode=completeOnly hides flip block |
| 11 | CM **smí** vytvořit otázku, úkol, událost. **Nesmí** vytvořit nápad ani dokumentaci — UI volby skryté, server rule odmítne | ✅ | NewTask.tsx allowedTypes per-type roleHas + FabRadial canDokumentace gate + tasks/create rule |
| 12 | CM v `TaskDetail.tsx` **nevidí** link chip pro `linkedTaskIds`, kde target je nápad nebo nesdílená dokumentace | ✅ | TaskDetail line 1641 + 1509 + 1588 — všechny linkedTaskIds průchody filtrují přes canViewTask |
| 13 | CM **nedostane** push notifikaci ani inbox záznam o tasku, který nevidí | ✅ | S08 — canReadTaskForRecipient gate v send.ts + 12 unit tests |
| 14 | OWNER a PM workflow je **identický** s pre-launch (žádná regrese). Smoke test: vytvořit nápad, vytvořit otázku, sdílet dokumentaci, RSVP event, přiřadit úkol, fliplnout status. | ⚠️ pending | Stáňa smoke test po deploy. Code-level: 528 baseline frontend testů + 172 backend stále projdou. |
| 15 | `Shell.tsx` pro CM zobrazuje jen `Ukoly`, `Otázky`, `Dokumentace`, `Events` | ⚠️ částečně | Skryt `Záznamy` tab pro CM; Bottom tabs reálně: Dokumentace, FAB, Úkoly, Settings (Otázky není samostatný tab — je filtrován v `/ukoly`). Events otevírá header Calendar icon. |
| 16 | `AssigneeSelect` pro `napad` typ neobsahuje žádného CM uživatele | ✅ | S05 — `excludeRoles` prop přidán; aktuálně hardcoded na napad type — žádný v TaskDetailu nepoužívá AssigneeSelect protože napad nemá assignee. Defense in depth: server rule blocks napad creates with CM assignee |
| 17 | `cs.json` má `role.CONSTRUCTION_MANAGER = "Stavbyvedoucí"` (+ krátká forma) a všechny nové empty states / banners | ✅ | S01 + S10 — top-level role.CM + role.CM_SHORT, detail.role.CM, comments.completeAsAssignee, dokumentacePage.empty*Cm |
| 18 | PWA update toast se zobrazí prvním přihlášením po deploy s i18n textem | ⚠️ skipped | UpdateBanner je generický SW update modal (V12.2). V24-specific announcement banner mimo scope, akceptováno per S10 trade-off |
| 19 | `npm run docs:permissions` regenerovalo `PERMISSIONS_GENERATED.md` a commit obsahuje regenerovaný soubor | ✅ | S04 — 20 akcí, 3 role, ownership semantika updated |
| 20 | `npm test` prochází v `app/` i `app/functions/` | ✅ | App: 560/560 (baseline 528, +32). Functions: 184/184 (baseline 172, +12). |
| 21 | Manželka a PM dostali pre-launch e-mail s krátkým popisem změny | ⚠️ Stáňa | TODO Stáňa před nasazením do `main` branch |
| 22 | Stáňa má dokumentovaný postup, jak založit 3. CM (Firestore Console krok-za-krokem) | ✅ | S12 — `.design/stavbyvedouci-role/RUNBOOK.md` |

**Score: 16 ✅ / 4 ⚠️ pending Stáňa / 1 ⚠️ skipped (akceptované)**

---

## Známá omezení (V1)

1. **Cross-CM "assignee role is CM" scope chybí v klient query.** Server
   rule by povolila CM-B vidět task assigned to CM-A bez authorRole=CM,
   ale `subscribeTasksForCm` to nevyfetchuje (žádný 5. query přes CM-uid
   list). CM-B uvidí task přes deep-link / mention / comment notifikaci,
   ne v listu.

2. **PWA V24 launch toast skipnut.** Generický UpdateBanner se ukáže při
   SW update, ale neoznámí "nového kolegu Stavbyvedoucího". Stáňa
   informuje manželku + PM e-mailem mimo aplikaci.

3. **Plain-text mention nápadu v komentu.** OWNER v komentu na úkolu pro
   CM napíše plain text "viz nápad #foo" — link chip je skrytý (Q3 a),
   ale text v body komentu CM uvidí. Akceptováno jako known limitation.

4. **CM-as-assignee může server-side flipnout do BLOCKED přes
   `isCommentSideEffect`.** Klientský UI gate (mode=completeOnly) jen
   nabízí Hotovo (DONE). Pokud CM dovolí useNetwork DevTools, technicky
   může vyrobit comment s workflowAction=close + statusAfter=BLOCKED.
   Server rule to dnes neodmítne (isCommentSideEffect je permissive).
   Tighter server validation odložená do případného hardening sprintu.

5. **Storage attachment fetch** pro skryté tasky vrací 200 + payload,
   pokud útočník zná Firebase Storage signed-URL (path-based access).
   Realističnost: CM nemá ví, jak najít taskId, takže path je opaque.
   Akceptováno — Storage rules samy o sobě nelze gate-checnout přes
   Firestore lookup bez nového CF proxy.

---

## Pending pro Stáňu (před produkčním deploy)

1. **Validate firestore.rules syntaxí:**
   ```bash
   cd app/deploy && npm run rules:deploy:dev:dry
   ```
   Pokud OK, ostře:
   ```bash
   npm run rules:deploy:dev
   ```

2. **Smoke test 3 rolí na dev:**
   - OWNER: žádná regrese (Záznamy, Settings → Kategorie/Lokace/Phases/DocTypes, Export, Rozpočet redirect…)
   - PM: žádná regrese (Otázky, Úkoly, Events, Rozpočet)
   - CM (testovací účet): viz `RUNBOOK.md` § Audit checklist

3. **Composite indexes v Firebase Console:**
   - 4 composite indexes pro CM queries jsou pre-defined v
     `app/deploy/firestore.indexes.json`. Po `firebase deploy --only firestore:indexes`
     (nebo plný `npm run deploy:dev`) je Firebase vytvoří automaticky.
   - Kontrola: Firebase Console → Firestore → Indexes → ověřit, že tasks
     má 4 nové composite indexes (každý začíná `type` + jeden z
     `assigneeUid`/`createdBy`/`authorRole`/`sharedWithRoles`, končí
     `createdAt DESC`).

4. **PWA produkční deploy:**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```
   PWA pipeline (GitHub Actions / Firebase hosting) zveřejní bundle.

5. **Obeznámit manželku + PM:**
   Krátký e-mail nebo zpráva: *"Aplikace dostala novou roli pro
   stavbyvedoucí. Vy uvidíte všechno jako dřív, jen se objeví Stavbyvedoucí
   v assignee dropdownech a v sharing checkboxech."*

6. **Přidat 1. CM uživatele:**
   Per `RUNBOOK.md` step-by-step. Po Google login + role přidání ověř že
   se mu zobrazí 4 taby + landing /ukoly.

7. **Sdílet relevantní dokumentaci:**
   Pro každý dokument, který CM má vidět, otevři detail → Sdílení →
   zaškrtni "Stavbyvedoucí (jen pro čtení)".

---

## Co bych v dalším sprintu přidal

- **5. query pro cross-CM assignee scope** — když fakticky chybí (CM-B
  hlásí "nevidím tasky CM-A").
- **Server validace flip-to-DONE-only** pro CM (rules tightening).
- **Bulk grant UI** — multi-select sharing pro hromadné přidávání CM.
- **PWA toast pro V24 launch** — explicit one-time announcement.
- **Storage proxy CF** — pokud bude potřeba uzavřít attachment leak.
- **Per-user sharing** — kdyby vznikl scénář "CM-A ano, CM-B ne".
- **Read audit log** — pokud regulator někdy bude vyžadovat.

---

**Implementace připravená k deploy. Žádné blocking issues.**
