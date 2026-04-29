# V26 — Hlášení ze stavby

**Date**: 2026-04-29
**Author**: Stanislav Kasika (proposal: Codequ)
**Status**: Implementing

---

## 1. Problem

Stavbyvedoucí volá / píše SMS / WhatsApp "přivezli beton" / "začala betonáž" /
"problém s příjezdem" — informace se ztrácí v messaging silos. Workflow tasky
nejsou pro tohle vhodné (vyžadují assignee, status, deadline). Potřebujeme
**broadcast kanál** mimo workflow.

## 2. Primary User

CM (stavbyvedoucí na stavbě) jako primárně tvůrce. OWNER + PM jako
primární čtenáři. Občas i OWNER/PM tvoří hlášení (např. plánovaná návštěva).

## 3. Success Metrics

- 0 stavebních informací nezůstává v WhatsApp/SMS
- Critical hlášení dorazí Stáňovi do 24h (vs. dnes 48-72h via WhatsApp scroll)

## 4. Scope

### In scope (V26 MVP)

- Nová Firestore kolekce `/reports` (samostatná, NE rozšíření tasks)
- `SiteReport` schema: id, message, importance, media[], createdBy, createdAt, updatedAt, readBy[]
- `ReportImportance: "normal" | "important" | "critical"`
- `ReportMedia: { id, url, path, contentType, kind: "image" | "video" }`
- Storage paths: `/reports/{uid}/{reportId}/{filename}`, **50MB limit pro video**
- Composer modal: message (textarea, povinný) + photo/video uploader + importance picker (3 pills) + Odeslat/Zrušit
- Mobile camera: `<input type="file" accept="image/*,video/*" capture="environment">`
- Notifications:
  - `normal`: push + inbox (broadcast všem v workspace, self-filter)
  - `important`: push + inbox
  - `critical`: push + inbox + transient in-app banner při open app
- List `/hlaseni` (route + Hlaseni.tsx component)
- Header ikona vedle kalendáře (megafon/výstraha) s badge unread count
- Detail popup over list (žádná samostatná route, hash deep-link `/hlaseni#r-{id}`)
- Auto-mark readBy na detail open
- Permission: OWNER + PM + CM read & create. Mazání jen author + OWNER (V1: skryto)
- Radius menu: -Otázka +Hlášení; Otázka přesunuta do `Composer` pills v Úkol flow
- 5 nový notification event v catalog: `site_report_created`
- Critical banner non-blocking (transient, žádná persistence)

### Out of scope

- Komentáře / reakce / status / workflow (broadcast, ne workflow)
- Edit hlášení (text-only typo nelze fixnout — pošli nové)
- Mazání UI v MVP (server gate povolen autorovi)
- Filter/search v listu (V1)
- Per-importance recipient prefs (V1 — všichni dostávají vše per-importance default)
- napad changes (zůstává v radius menu pro OWNER)

## 5. Constraints

- React 19 + Vite + TS PWA
- Firebase europe-west1, Cloud Functions Node 20
- Žádný nový npm dependency
- Žádný nový Firebase produkt
- Storage rules: 50MB limit pro `reports/**/*.mp4`, 10MB pro images (per existing `reports/.../*` paths)

## 6. Definition of Done

- [ ] `SiteReport` interface v `types.ts` + functions mirror
- [ ] `firestore.rules` má `/reports` block s create/read/delete pravidly
- [ ] `storage.rules` má `reports/{uid}/{reportId}/{filename}` block s 50MB limit
- [ ] `lib/reports.ts` CRUD: createReport, subscribeReports, markReportRead, deleteReport
- [ ] HlaseniComposer modal funguje: message + camera + importance + send
- [ ] Radius menu: Hlášení button přidaný, Otázka odebraná
- [ ] `/hlaseni` route + list zobrazuje hlášení (sorted desc by createdAt)
- [ ] Header megafon ikona + badge unread count
- [ ] Detail popup auto-marks readBy on open
- [ ] Critical hlášení push: in-app banner při open
- [ ] CF trigger `onReportWrite` posílá notifikace per importance
- [ ] Notification catalog má `site_report_created` entry, dedupePriority 22
- [ ] i18n: hlaseni namespace + notifikace.events.site_report_created
- [ ] Tests: pure helpers + composer + recipient logic
- [ ] OWNER + PM + CM smoke test

## 7. Risks

1. **Video upload na slabém signálu** — 50MB upload v autě s 3G může selhat. Mitigace: progress indicator + retry button. V1 přijatelný.
2. **Critical banner při deep work** — ruší. Mitigace: dismissable, není blocking. V1 přijatelný.
3. **Storage budget alarm** — Firebase Storage zdarma jen 5GB. Hlášení s videi to vyčerpá. Mitigace: TBD scheduled CF cleanup pro hlášení >90 dní.
4. **CM-OWNER NDA boundary** — hlášení je broadcast across all roles. CM uvidí hlášení od OWNER, OWNER uvidí od CM. Per Stáňa V26 = ok.
