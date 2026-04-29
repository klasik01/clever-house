# V25 — Canonical Status Flow — Design Review

> Generated: 2026-04-29 (V25-S35)
> Status: 6/6 slices completed, awaiting deploy + smoke test
> Test results: app 526/526 + 2 skipped (orphan stubs), functions 184/184

---

## Definition of Done — checklist

| # | Item | Status | Důkaz |
|---|---|---|---|
| 1 | TaskStatus union 4 hodnot | ✅ | `types.ts:38` — `OPEN \| BLOCKED \| CANCELED \| DONE` |
| 2 | Comment.workflowAction 6 akcí | ✅ | `types.ts:103` — `flip / complete / block / reopen / cancel` (+legacy `close`) |
| 3 | Migrace nasazena na dev | ⚠ pending Stáňa | `app/deploy/pending/2026-04-29-V25-canonical-status.mjs` připraven; `npm run deploy:dev:dry` ověří, `deploy:dev` nasadí |
| 4 | CommentComposer 6 akcí kontextově | ✅ | `V25WorkflowActions` sub-component; mode dispatch podle status |
| 5 | StatusPicker/Badge/FilterChip 4 statusy | ✅ | `StatusBadge.statusIcon/Colors` + `ALL_STATUSES` zúženo; `OTAZKA_STATUSES` v `lib/status.ts` má 4 hodnoty |
| 6 | BLOCKED vyžaduje neprázdný comment body | ✅ | `CommentThread.handleSubmit` early return při block bez bodu |
| 7 | Reopen flow + assignee picker | ✅ | terminal mode v `V25WorkflowActions` ukáže `Znovu otevřít → {peer}` s peer dropdown |
| 8 | 5 nových notifikačních eventů | ✅ | `catalog.ts` task_completed/blocked/unblocked/canceled/reopened, dedupe priority 17–21 |
| 9 | OWNER + PM smoke (no regrese) | ⚠ pending | Po deploy ověř |
| 10 | CM full action set (V24 revert) | ✅ | V25 unified gating: `canEdit \|\| isAssign → full mode`; CM-as-assignee má stejné akce jako PM |
| 11 | npm test passes | ✅ | 526/526 + 184/184 |

---

## Změny per slice

### S30 — Foundations
- `types.ts` TaskStatus 4 + workflowAction 6 + 5 nových `NotificationEventKey`
- `functions/notify/types.ts` mirror
- `lib/status.ts` simplified, defensive bridge zůstává
- `lib/comments.ts` `createComment` workflow rozšířený o všechny 6 akcí
- Removed dead helpers `answerAsProjektant`, `needMoreInfoAsProjektant`
- 8 dead files stubbed (`enums`, `eventsFilter*`, `prehled*`, `Harmonogram`, `Lokace`, `Prehled`)
- Migration script: `2026-04-29-V25-canonical-status.mjs` (idempotent + dry-run flag)

### S31 — CommentComposer 6-action UI
- `CommentComposer.tsx`: `V25WorkflowActions` sub-component
- 4 modes: `full` (OPEN), `blocked` (BLOCKED), `terminal` (DONE/CANCELED), `completeOnly` (V24 legacy fallback — nyní nepoužívaný)
- `CommentThread.tsx`: dispatch logiky + handleSubmit handles 6 actions
- Block requires non-empty body (klient gate)
- Cancel button author-only; visible only when task není terminal/canceled

### S32 — Status pickers/badges/filters
- `StatusBadge.tsx`: `ALL_STATUSES`, `statusIcon`, `statusColors` zúženy
- `lib/filters.ts`: `applyOpenClosed` přepínač "DONE" místo "Hotovo"
- `Export.tsx` / `Zaznamy.tsx` / `TaskDetail.tsx`: legacy comparisons → canonical
- `cs.json`: `actionComplete/Block/Reopen/Cancel/Flip/Send` + `blockReasonRequired` + `reopenPickAssignee` + 4 `workflow*Badge` strings; tabs.* legacy `prehled/harmonogram/todoHarmonogram` zachované (orphan ale neškodné)
- `notifications.ts`: 5 nových klíčů v `NOTIFICATION_EVENTS` + `DEFAULT_PREFS`

### S33 — Notifikační katalog
- `catalog.ts`: 5 nových entries s render funkcemi
- Dedupe priority: 17 (completed), 18 (blocked), 19 (unblocked), 20 (canceled), 21 (reopened)
- `NotificationList.tsx` + `NotificationPrefsForm.tsx`: nové ikony (CheckCircle, CircleSlash, Unlock, XOctagon, RotateCcw)
- i18n `notifikace.events.task_*` + Hint stringy

### S34 — Permission gating
- `CommentThread.tsx` workflowMode dispatch: `canEdit || isAssign → full`
- CM-as-assignee má stejné akce jako PM-as-assignee (V25 dle Stáňa)
- Reopen open pro každého s read access (canViewTask gate je v parent TaskDetail)

### S35 — Tests + Review
- `permissions.test.ts`, `permissionsConfig.test.ts`, `notifications.test.ts`, `filters.test.ts`, `status.test.ts` updated for V25 mappings
- `eventsFilter.test.ts` + `prehled.test.ts` stubbed (orphan files; described in V20 cleanup)
- 526 + 184 = 710 tests pass

---

## Známá omezení (V25)

1. **Auto-reopen po komentáři neexistuje.** Per Codequ pravidla — komentář na DONE/CANCELED nemění stav. Reopen vyžaduje explicit kliknutí.
2. **Workflow side-effect rule v `firestore.rules`** zůstává permissive (any signed-in s read access může flipnout status přes batch). Klient gates dál (workflow buttons jen pro participants), ale v V1 server nevyžaduje per-action validation. Tighter server gate odložen do hardening.
3. **Plain text mention nápadu v komentu** zůstává known limitation z V24.
4. **Legacy comments** s `workflowAction: "close"` se renderují stejně jako "complete" (V25 alias). Komentový badge ukáže `workflowCloseBadge` text.
5. **napad lifecycle** jen mírně dotčen — status pole se přemapovalo na canonical, ale nápad nemá assignee, takže workflowMode je null. Vystup doplnění zůstává explicitní cesta uzavření.

---

## Pending pro Stáňu

1. **Migration dry-run + ostrý:**
   ```
   cd app/deploy
   node pending/2026-04-29-V25-canonical-status.mjs dev --dry-run
   # zkontroluj output, kolik tasků se přemapuje
   node pending/2026-04-29-V25-canonical-status.mjs dev
   # ověř na dev
   npm run deploy:ope:dry  # dry-run plný orchestr
   npm run deploy:ope     # ostrý — orchestrátor archivuje skript po úspěchu
   ```

2. **Smoke test 4 statusů × 3 role:**
   - OPEN/PM-as-assignee → 4 buttony (Blokováno + Hotovo + Předat + autor Cancel pokud OWNER)
   - BLOCKED → Hotovo + Odblokovat → peer
   - DONE → Reopen → peer
   - CANCELED → Reopen → peer

3. **i18n cleanup volitelně:** smaž orphan `tabs.prehled`, `tabs.harmonogram`, `tabs.todoHarmonogram`, namespace `harmonogram.*`, `prehled.*`, `prehledCard.*`. Nemají dopad ale dělají bordel.

4. **Git rm dead files** (stubbed za V25):
   ```
   git rm app/src/lib/{enums,eventsFilter,eventsFilter.test,prehled,prehled.test}.ts \
          app/src/routes/{Harmonogram,Lokace,Prehled}.tsx
   ```

5. **PWA toast:** stávající UpdateBanner se postará o SW update. Ručně manželce + PM e-mail "ráno V25 — workflow přepracován, neptej se mě, klikni si akce v komentáři přímo".

---

**V25 ready to deploy. Žádné blocking issues.**
