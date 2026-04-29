# PERMISSIONS_GENERATED.md

> **Auto-generated** z `app/src/lib/permissionsConfig.ts`. **Neměň ručně** —
> uprav config a spusť `npm run docs:permissions`.

Vygenerováno: 2026-04-29

## Klientská permission matrix

Pro každou akci: které role smí, jestli je gated ownership-em, a kam mrknout do `firestore.rules` při sync auditu.

| Action | OWNER | PROJECT_MANAGER | Ownership | Rules at | Popis |
| ------ | ----- | --------------- | --------- | -------- | ----- |
| `task.read` | ✅ | ✅ | `anyone` | `tasks/read = isSignedIn()` | Přečíst libovolný task v workspace (V15.2 — listing i detail). |
| `task.create.napad` | ✅ | ❌ | `anyone` | `tasks/create + UI gate v NewTask (allowedTypes)` | Vytvořit nápad. Jen OWNER (PM nápady neeviduje, jen na ně reaguje). |
| `task.create.otazka` | ✅ | ✅ | `anyone` | `tasks/create + composer allowedTypes` | Vytvořit otázku. |
| `task.create.ukol` | ✅ | ✅ | `anyone` | `tasks/create + composer allowedTypes` | Vytvořit úkol. |
| `task.create.dokumentace` | ✅ | ✅ | `anyone` | `tasks/create + composer allowedTypes` | Vytvořit dokumentaci. OWNER i PM (v budoucnu i další role). |
| `task.edit` | ✅ | ✅ | `author-or-cross-owner` | `tasks/update — isTaskAuthor() OR isCrossOwnerEditable()` | Editovat task. Autor vždy; OWNER navíc edituje libovolný OWNER-created. |
| `task.delete` | ✅ | ✅ | `author` | `tasks/delete = isTaskAuthor()` | Smazat task. Pouze autor — i cross-OWNER respektuje ownership pro delete. |
| `task.comment` | ✅ | ✅ | `anyone` | `comments/create + tasks/update isCommentSideEffect()` | Napsat komentář. Kdokoliv signed-in. Side-effect na parent (commentCount/status/assignee) řeší isCommentSideEffect rule. |
| `task.changeType` | ✅ | ✅ | `author-or-cross-owner` | `tasks/update — isTaskAuthor() OR isCrossOwnerEditable() (changeType je podmnožina edit)` | Změnit typ tasku (otázka ↔ úkol). Mutace v místě — zachová ID, autora, komentáře. Stejný permission pattern jako task.edit. |
| `task.link` | ✅ | ✅ | `author-or-cross-owner` | `tasks/update — isTaskAuthor() OR isCrossOwnerEditable() (link je podmnožina edit)` | Přidat / odebrat propojení mezi otázkou/úkolem a tématem (nápadem). Vyžaduje edit právo na obě strany — gating provádí caller per-task přes canActOn('task.link', ...) na obou dokumentech. |
| `event.read` | ✅ | ✅ | `anyone` | `events/read = isSignedIn()` | Přečíst event. Kdokoliv signed-in; listing filtrujeme klientsky na 'jsem invitee/autor'. |
| `event.create` | ✅ | ✅ | `anyone` | `events/create` | Vytvořit event s pozvánkou pro >=1 invitee. |
| `event.edit` | ✅ | ✅ | `author-or-cross-owner` | `events/update — isTaskAuthor() OR isCrossOwnerEditable()` | Editovat event. Stejný pattern jako task — autor + cross-OWNER. |
| `event.delete` | ✅ | ✅ | `author` | `events/delete = isTaskAuthor()` | Smazat event. Jen autor. |
| `event.rsvp` | ✅ | ✅ | `anyone` | `events/{id}/rsvps/{userId}/write = self` | Odpovědět na pozvánku (Můžu/Nemůžu). Self-write na rsvps/{userId}. |
| `documentTypes.manage` | ✅ | ❌ | `anyone` | `documentTypes/write = isOwner()` | Spravovat typy dokumentů (admin seznam pro upload modal). |
| `categories.manage` | ✅ | ❌ | `anyone` | `categories/write = isOwner()` | Spravovat kategorie (workspace-wide taxonomy). |
| `locations.manage` | ✅ | ❌ | `anyone` | `locations/write = isOwner()` | Spravovat lokace (workspace-wide taxonomy). |
| `settings.profile` | ✅ | ✅ | `anyone` | `users/{uid}/update — self + diff hasOnly([whitelist])` | Upravit vlastní přezdívku, contactEmail, notification prefs (diff-gate v rules). |
| `settings.calendarToken` | ✅ | ✅ | `anyone` | `users/{uid}/update — self + diff hasOnly([calendarToken,…])` | Generovat / rotovat osobní token pro webcal subscription. |

## Ownership semantika

- **`anyone`** — stačí mít roli v allow-listu, žádné autorství navíc.
- **`author`** — jen autor (createdBy === me). Cross-OWNER NEMÁ.
- **`author-or-cross-owner`** — autor + (OWNER edituje OWNER-created) — V17.1 cross-OWNER pattern.

## Jak to udržovat

Při změně permissions:

1. Uprav `app/src/lib/permissionsConfig.ts`.
2. Updatuj `app/deploy/firestore.rules` podle `rulesAt` pointru.
3. Spusť `npm run docs:permissions` — regeneruje tenhle soubor.
4. Spusť `npm test` — ověří invariant testy.
5. Commit všechno společně.
