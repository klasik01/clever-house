# V26 — Hlášení ze stavby — Design Review

> Date: 2026-04-29
> Status: 8/8 slices complete, ready to deploy
> Tests: app 538/538 + 2 skipped, functions 184/184

---

## DoD — checklist

| # | Položka | Status | Evidence |
|---|---|---|---|
| 1 | `SiteReport` interface v `types.ts` + functions mirror | ✅ | `types.ts:268-300`, `functions/notify/types.ts:76-87` |
| 2 | `firestore.rules` `/reports` block | ✅ | rules `match /reports/{reportId}` — read isSignedIn, create validated, update readBy-only, delete author |
| 3 | `storage.rules` reports paths + 50MB video | ✅ | `reports/{uid}/{reportId}/{filename}` block |
| 4 | `lib/reports.ts` CRUD | ✅ | createReport, subscribeReports, markReportRead, deleteReport, countUnreadReports, isReportUnread |
| 5 | `HlaseniComposer` modal | ✅ | message + camera/gallery + 3 importance pills + send/cancel |
| 6 | Radius menu update | ✅ | -Otázka +Hlášení (Megaphone icon); composer trigger via setHlaseniOpen |
| 7 | `/hlaseni` route + list | ✅ | `routes/Hlaseni.tsx` + `useReports` subscription |
| 8 | Header megafon ikona + badge | ✅ | `Shell.HlaseniHeaderLink` s `countUnreadReports` |
| 9 | Detail popup auto-mark readBy | ✅ | `HlaseniDetailPopup` useEffect → markReportRead |
| 10 | Critical in-app banner | ✅ | `CriticalReportBanner` (top sticky, dismissable, transient) |
| 11 | CF trigger + catalog entry | ✅ | `triggers/onReportWrite.ts` + `notify/catalog.ts` site_report_created (priority 22) |
| 12 | i18n hlaseni namespace | ✅ | `cs.json` hlaseni.* + tabs.hlaseni + notifikace.events.site_report_created |
| 13 | Tests pass | ✅ | 538 + 184 |

---

## Co se změnilo (souhrn)

**Schema:**
- `types.ts` přidaný `SiteReport`, `ReportImportance`, `ReportMedia`, + `site_report_created` v `NotificationEventKey`
- `functions/notify/types.ts` mirror + `ReportDoc` pro CF trigger payload

**Backend:**
- `app/deploy/firestore.rules` — `/reports/{reportId}` block: read all signed-in, create validated shape, update jen readBy+updatedAt, delete author-only
- `app/deploy/storage.rules` — `reports/{uid}/{reportId}/{filename}` block, 10MB image / 50MB video
- `functions/src/triggers/onReportWrite.ts` — fan-out na všechny workspace useři kromě actora
- `functions/src/notify/catalog.ts` — site_report_created entry, dedupe priority 22, render funkce s emoji prefixem podle importance

**Frontend:**
- `lib/reports.ts` — subscribeReports, createReport, markReportRead (arrayUnion), deleteReport, countUnreadReports, isReportUnread
- `lib/attachments.ts` — uploadReportMedia (image compression OR video as-is, 50MB cap)
- `hooks/useReports.ts` — realtime subscription
- `components/HlaseniComposer.tsx` — modal s message + media uploader + importance picker + send
- `components/HlaseniDetailPopup.tsx` — read-only detail popup s auto-mark readBy
- `components/CriticalReportBanner.tsx` — transient sticky banner pro critical reports
- `components/FabRadial.tsx` — radius menu: -Otázka +Hlášení; modal trigger
- `components/Shell.tsx` — Header s Megaphone ikonkou + badge unread + CriticalReportBanner mount
- `routes/Hlaseni.tsx` — list view, importance border-l, deep-link `#r-{id}`
- `App.tsx` — `/hlaseni` route registered

**i18n (`cs.json`):**
- `hlaseni.*` namespace (24 stringů)
- `tabs.hlaseni`
- `notifikace.events.site_report_created` + Hint
- `NOTIFICATION_EVENTS` rozšířeno o "site_report_created" + DEFAULT_PREFS

---

## Známá omezení (V26 MVP)

1. **Mazání není v UI.** Server rule povoluje autorovi delete, ale composer/list nemá mažbu button. MVP per Codequ. Budoucí: trash icon + confirm dialog.
2. **Edit hlášení = NE.** Per V26 brief Mezera D=NE. Pokud user pošle s překlepem, pošle nové. Komenty v hlášení neexistují.
3. **Storage budget.** Video 50MB × 100 hlášení = 5 GB Firebase free. Realisticky se asi rychle naplní. Mitigace: scheduled CF cleanup po 90 dnech (V27 future).
4. **Critical popup je transient client-side.** Žádný server state. Pokud user appku nemá otevřenou, banner se neukáže — push notifikace stačí. Mezera C dle Stáňa.
5. **Composite indexes.** Žádné — `subscribeReports` query je single-orderBy `createdAt desc`, Firestore auto-index.
6. **Push ikona** v notifikační inbox — Megaphone (per `NotificationList.tsx` + `NotificationPrefsForm.tsx`).
7. **Radius menu po V26** = [Nápad (jen OWNER) | Dokumentace | FAB | Úkol | Hlášení | Událost]. **Otázka přesunuta** dovnitř Composer pills v Úkol flow (dle Mezera E=a) — Composer.tsx již podporuje pills `["napad","otazka","ukol","dokumentace"]`.

---

## Pending pro Stáňu

1. Deploy:
   ```bash
   cd app/deploy
   npm run rules:deploy:dev:dry  # ověř
   npm run deploy:dev            # rules + functions + indexes
   ```
2. Smoke test flow:
   - Vytvoř hlášení (normal): foto + zpráva → odešli → ověř že ostatní vidí v listu
   - Vytvoř hlášení (important): push notifikace dorazí
   - Vytvoř hlášení (critical) z jednoho zařízení → druhé zařízení s otevřenou appkou → banner top-screen
   - Klikni na hlášení v listu → popup → readBy se auto-update → badge se sníží
   - Refresh: badge stays at right unread count
3. Mobile camera test:
   - iPhone PWA: klik "Foťák / video" → otevře native fotoaparát (per `capture="environment"`)
   - Android Chrome: stejně
4. Po stable → `npm run deploy:ope`

## Roadmap V27 (out of scope)

- Trash UI + confirmation
- Scheduled cleanup CF (delete reports + media >90 dní)
- Filter v listu (per importance / čas)
- "Vytvořit úkol z tohoto hlášení" tlačítko v detail popupu (broadcast → workflow bridge)
- Storage budget alarm

---

**V26 ready to deploy. Žádné blocking issues.**
