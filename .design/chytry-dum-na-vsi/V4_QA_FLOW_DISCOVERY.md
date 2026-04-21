# V4 — Q&A flow via comments

**Date:** 2026-04-21
**Scope:** Ditch projektantAnswer panel; repurpose comment thread as the Q&A channel; add workflow actions (send+flip, send+close) to composer; add "it's on you" indicators.

## Problem Statement

Současný OWNER↔PM flow na otázce má dva nezávislé systémy:
1. **`projektantAnswer`** single-field na tasku + speciální „Odpovídám" panel pro PM (odpověď se přepisuje, žádná historie)
2. **CommentThread** subcollection s diskusí (mentions, reakce, atd.)

Vyvolává to zmatek: kam psát odpověď? Které pole je zdroj pravdy? A chybí historie odpovědí při iterativním doplňování.

**Cíl V4:** Komentáře jsou JEDINÝ kanál pro Q&A. `projektantAnswer` se už nepoužívá. CommentComposer dostane 3 send tlačítka, která zároveň ovládají workflow (assignee + status).

## Primary User

OWNER + PM rovnocenně — oba budou mít stejný set comment+workflow akcí v detailu otázky.

## Success Metric

**Zero orphan answers** — ani jedno ze 100 tasků nemá zvlášť uložený `projektantAnswer` po spuštění V4. Všechna reakce historie v `comments/`.

## Top 3 Risks

1. **Migrace legacy `projektantAnswer`** — 0 prod data takže OK, jinak bych musel vyrábět migration job který pro každý task s non-null answer vytvoří syntetický comment.
2. **Confusion při send+close** — user chce „poslat komentář a uzavřít" na jeden tap, ale co když se rozmyslí? Undo toast (5s) by mohl pomoci.
3. **"Ball on me" overindication** — 4 místa (tab badge + list dot + detail banner + Přehled). Risk nadbytku. Mitigace: zkusit, sledovat, škrtnout pokud nikdo nepoužívá.

## Answers

### Q1 — Data model
**A — Subcollection `tasks/{id}/comments/{cid}`** — už existuje z V3.0. Žádná nová kolekce.
- `comment.workflowAction?: "flip" | "close" | null` — informativní, jaký byl záměr při send (pro audit + history rendering)
- `comment.statusAfter?: TaskStatus` — snapshot statusu po akci (pro history)
- Pokud `workflowAction = "flip"`, současně se na tasku updatuje `assigneeUid` + `status`
- Pokud `"close"`, status → Hotovo/Rozhodnuto, assigneeUid zůstane

### Q2 — Komentáře = Q&A kanál
**User pivot:** Místo separátní Answer entity **rozšíříme CommentComposer o workflow akce**.

Akce v composer pro otázku:
- **Odeslat komentář** (plain, no workflow change — jen chat)
- **Odeslat a přehodit na {druhého uživatele}** — comment + `assigneeUid` → peer + `status` → „Otázka" (nebo „Čekám" podle kontextu)
- **Odeslat a uzavřít** — comment + status → „Hotovo" (konečné rozhodnutí)

Tři buttons, default (middle) je "přehodit" — nejčastější akce v iterativním flow.

Pro nápad: composer má jen plain Send (není tam flow).

### Q3 — „Potřebuji doplnit" disable — NOT APPLICABLE
Samostatný Odpovídám panel + jeho disable logika ruší se. Composer je symetrický pro OWNER i PM; kdo má v danou chvíli na sobě, ten edituje. Disable není třeba.

### Q4 — „Ball on me" indikace — všech 4 míst
- **a) Shell tab badge** na „Záznamy" — počet tasků kde `assigneeUid === user.uid && status ∈ ["Otázka", "Čekám"]`
- **b) List card** — barevný left-border (nebo dot) když jsi assignee
- **c) Detail banner** pod titulkem: „Je to na tobě"
- **d) /prehled** — má již „Čeká na mě" counter; zůstává beze změny
- **e) Push/email** — V4 stále out-of-scope (bude V5+)

## Scope (in/out)

### In
- Subcollection `comments` rozšíření o `workflowAction` + `statusAfter` polí
- CommentComposer v otázce má 3 send buttons s icons + label
- Na otázce se odpovídám panel **úplně odstraní** (PM view přestane mít textarea + dva dedikované buttons)
- History rendering: předchozí workflow-comments v threadu dostanou levý border v barvě `statusAfter` (stejný pattern jako linked otázka)
- 4 indikační místa implementována
- `projektantAnswer` + `projektantAnswerAt` pole na tasku **přestanou se zapisovat**. Čtení pro legacy existuje 1 release, pak dropnout.

### Out of scope V4
- Push/email notifikace (V5)
- @mention PM+notif (máme polo-mention už z V3)
- Bulk "uzavři všechny starší než X dní"
- Export historie odpovědí do PDF

## Next step

`brief-to-tasks` — rozseká na 4-5 shipable slice-ů.
