# PERMISSIONS_GENERATED.md

> **Auto-generated** z `app/src/lib/permissionsConfig.ts`. **Neměň ručně** —
> uprav config a spusť `npm run docs:permissions`.

Vygenerováno: 2026-04-29

## Klientská permission matrix

Pro každou akci: které role smí, jestli je gated ownership-em, a kam mrknout do `firestore.rules` při sync auditu.

| Action | OWNER | PROJECT_MANAGER | CONSTRUCTION_MANAGER | Ownership | Rules at | Popis |
| ------ | ----- | --------------- | -------------------- | --------- | -------- | ----- |
| `task.read` | ✅ | ✅ | ✅ | `anyone` | `tasks/read = canReadTask(resource.data) — isOwner() OR isProjectManager() OR (isConstructionManager() AND canReadTaskByCm(resource.data))` | Přečíst task. OWNER+PM listing i detail (V15.2). CM má scoped gate (V24, viz canReadTaskByCm) — server vrací jen otazka/ukol vlastní/cross-CM team + sdílenou dokumentaci. Klient mirroruje přes canViewTask. |
| `task.create.napad` | ✅ | ❌ | ❌ | `anyone` | `tasks/create — authorRole != 'CONSTRUCTION_MANAGER' OR type in ['otazka','ukol']` | Vytvořit nápad. Jen OWNER — PM nápady neeviduje (jen na ně reaguje), CM rodinný brainstorming nikdy nevidí (V24 NDA hranice). |
| `task.create.otazka` | ✅ | ✅ | ✅ | `anyone` | `tasks/create + composer allowedTypes` | Vytvořit otázku. Všechny role mohou klást otázky. |
| `task.create.ukol` | ✅ | ✅ | ✅ | `anyone` | `tasks/create + composer allowedTypes` | Vytvořit úkol. Všechny role mohou tvořit úkoly. |
| `task.create.dokumentace` | ✅ | ✅ | ❌ | `anyone` | `tasks/create — authorRole != 'CONSTRUCTION_MANAGER' OR type in ['otazka','ukol']` | Vytvořit dokumentaci. OWNER i PM. CM má read-only (V24) — jen vidí sdílené dokumenty, nevytváří. |
| `task.edit` | ✅ | ✅ | ✅ | `author-or-cross-team` | `tasks/update — isTaskAuthor() OR isCrossOwnerEditable() OR isCrossCmEditable()` | Editovat task. Autor vždy. OWNER navíc edituje libovolný OWNER-created (cross-OWNER, V17.1). CM navíc edituje libovolný CM-created (cross-CM team, V24). PM jen vlastní. |
| `task.delete` | ✅ | ✅ | ✅ | `author` | `tasks/delete = isTaskAuthor()` | Smazat task. Pouze autor — i cross-OWNER / cross-CM respektuje ownership pro delete. |
| `task.comment` | ✅ | ✅ | ✅ | `anyone` | `comments/create gated na canReadTask(parent) + tasks/update isCommentSideEffect() + canReadTask` | Napsat komentář. Všechny role s read access na parent task. CM nemůže komentovat napad ani nesdílenou dokumentaci (V24 — comments rule gated na canReadTask). |
| `task.changeType` | ✅ | ✅ | ✅ | `author-or-cross-team` | `tasks/update — isTaskAuthor() OR isCrossOwnerEditable() OR isCrossCmEditable() (changeType je podmnožina edit)` | Změnit typ tasku (otázka ↔ úkol). Mutace v místě — zachová ID, autora, komentáře. Stejný permission pattern jako task.edit (cross-OWNER + cross-CM). |
| `task.link` | ✅ | ✅ | ✅ | `author-or-cross-team` | `tasks/update — isTaskAuthor() OR isCrossOwnerEditable() OR isCrossCmEditable() (link je podmnožina edit)` | Přidat / odebrat propojení mezi otázkou/úkolem a tématem (nápadem). Vyžaduje edit právo na obě strany. CM nikdy nedosáhne na napad jako druhou stranu (canViewTask vrátí false), takže CM smí linkovat jen mezi svými otázkami/úkoly. |
| `event.read` | ✅ | ✅ | ✅ | `anyone` | `events/read = isSignedIn()` | Přečíst event. Všechny role; listing filtrujeme klientsky na 'jsem invitee/autor'. Events nejsou role-restricted (V24 — CM smí vidět + tvořit). |
| `event.create` | ✅ | ✅ | ✅ | `anyone` | `events/create — authorRole in [OWNER, PROJECT_MANAGER, CONSTRUCTION_MANAGER]` | Vytvořit event s pozvánkou pro >=1 invitee. Všechny role. |
| `event.edit` | ✅ | ✅ | ✅ | `author-or-cross-team` | `events/update — isTaskAuthor() OR isCrossOwnerEditable() OR isCrossCmEditable()` | Editovat event. Stejný pattern jako task — autor + cross-OWNER + cross-CM team. |
| `event.delete` | ✅ | ✅ | ✅ | `author` | `events/delete = isTaskAuthor()` | Smazat event. Jen autor (i cross-OWNER / cross-CM respektuje). |
| `event.rsvp` | ✅ | ✅ | ✅ | `anyone` | `events/{id}/rsvps/{userId}/write = self` | Odpovědět na pozvánku (Můžu/Nemůžu). Self-write na rsvps/{userId}. Pozvánka může jít komukoli z rolí. |
| `documentTypes.manage` | ✅ | ❌ | ❌ | `anyone` | `documentTypes/write = isOwner()` | Spravovat typy dokumentů (admin seznam pro upload modal). |
| `categories.manage` | ✅ | ❌ | ❌ | `anyone` | `categories/write = isOwner()` | Spravovat kategorie (workspace-wide taxonomy). |
| `locations.manage` | ✅ | ❌ | ❌ | `anyone` | `locations/write = isOwner()` | Spravovat lokace (workspace-wide taxonomy). |
| `settings.profile` | ✅ | ✅ | ✅ | `anyone` | `users/{uid}/update — self + diff hasOnly([whitelist])` | Upravit vlastní přezdívku, contactEmail, notification prefs (diff-gate v rules). Všechny role. |
| `settings.calendarToken` | ✅ | ✅ | ✅ | `anyone` | `users/{uid}/update — self + diff hasOnly([calendarToken,…])` | Generovat / rotovat osobní token pro webcal subscription. Všechny role. |

## Ownership semantika

- **`anyone`** — stačí mít roli v allow-listu, žádné autorství navíc.
- **`author`** — jen autor (createdBy === me). Cross-OWNER NEMÁ.
- **`author-or-cross-team`** — autor + cross-team. V17.1: OWNER edituje OWNER-created. V24: CM edituje CM-created. PM je jednotlivec, cross-team mu nepomůže.

## Jak to udržovat

Při změně permissions:

1. Uprav `app/src/lib/permissionsConfig.ts`.
2. Updatuj `app/deploy/firestore.rules` podle `rulesAt` pointru.
3. Spusť `npm run docs:permissions` — regeneruje tenhle soubor.
4. Spusť `npm test` — ověří invariant testy.
5. Commit všechno společně.
