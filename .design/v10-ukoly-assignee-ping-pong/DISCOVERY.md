# V10 — Úkoly assignee-driven ping-pong

## Problem statement
Po prvních týdnech reálného používání na ope narazil owner (Stanislav) na
několik UC, které V5–V9 navrhly špatně:

1. Role-based workflow (`ON_CLIENT_SITE` / `ON_PM_SITE`) předpokládá dva hráče
   (klient + projektant). Reálně ale existují tři: Stanislav, jeho žena (oba
   OWNER) a projektant (PM). Úkoly mezi sebou předávají všichni tři.
2. Slovo "otázka" je v Czech UX neintuitivní — uživatel myslí "úkol".
3. PM nemůže zakládat úkoly ani převádět nápady na úkoly — musí o to požádat
   klienta.
4. Share-with-PM checkbox má modré zaškrtávátko, vyčnívá z warm stone palety.

V10 přepíná na **assignee-driven ping-pong**: `assigneeUid` je source of truth
"kdo to teď řeší". Status padá na tři terminální stavy + OPEN.

## Primary user
Každý, kdo má v workspace úkol na sobě — OWNER (klient + žena) i PM
(projektant).

## Success metric
- Počet úkolů, kde assignee = me a visuální badge chybí → **0** po nasazení.
- Počet manuálních retagů přes UI (assignee změna bez ping-pongu) klesne
  — protože default send-to picker nabídne správnou osobu.

## Top 3 risks
1. **Legacy status data** — existující úkoly mají `ON_CLIENT_SITE` /
   `ON_PM_SITE`. Mapper je převede na `OPEN` při čtení. Ale `assigneeUid`
   na starých záznamech může být `null` → ball-on-me by nefungoval. Fix:
   fallback `assigneeUid ?? createdBy` pro ball-on-me check.
2. **Nebezpečí omylem poslat špatnému uživateli** — default peer je řešitel
   před tebou, ale když multi-hop ping-pongu je víc, může se poplést.
   Mitigace: UI picker vždy vidět = user klikne, vidí jméno, potvrdí.
3. **Firestore rules rozšíření pro multi-OWNER napady** — otevírá víc
   dat mezi OWNER accounty. Pokud by někdo přizval externího klienta
   jako OWNER, uvidí napady té rodiny. Mitigace: workspace je single-tenant
   (jeden dům, jedna rodina); pro V10 akceptovatelné.

---

## 1. Rozhodnutí z interview

| Otázka | Rozhodnutí |
|---|---|
| Víc lidí na úkolu současně? | **Ne — vždy jeden aktivní řešitel (ping-pong).** |
| Status model | **Zjednodušit:** OPEN / BLOCKED / CANCELED / DONE. `assigneeUid` = "kdo to má." |
| Multi-OWNER vizibilita nápadů | **Všichni OWNER vidí nápady všech OWNER-ů.** |
| Default peer v send-to picker | **Předchozí předkladatel** (kdo mi to poslal) |

## 2. Scope

### In scope
- Terminologie "otázka" → "úkol" v UI (data type stays `"otazka"`).
- Status model: canonical set `OPEN | BLOCKED | CANCELED | DONE`.
- `assigneeUid` je single source of truth pro ball-on-me.
- CommentComposer flip button → dropdown-picker peerů.
- Ukoly filter "Moje / Všechny" (default Moje).
- PM má FAB + převod napad→úkol v PM view.
- Multi-OWNER visibility nápadů (Firestore rules + UI list).
- Share-with-PM checkbox barva: modrá → accent.
- "Převést na další otázku" → "Vytvořit další úkol".

### Out of scope
- Editace jmen rolí ("klient" / "projektant") v nastavení workspace.
- Úkol přiřazený víc lidem současně (explicitně odmítnuto v interview).
- Externí invited uživatele (dnes je workspace single-tenant = jedna rodina + PM).
- Notifikace když někdo pošle úkol na mě (push, email).

### Co bych cut při půlce času
- Filtr "Moje / Všechny" — default může být "Všechny" a multi-OWNER to zvládnou.
- Share-with-PM barva — kosmetické.

## 3. Datové změny

### Types
```ts
// NEW canonical
export type OtazkaStatusCanonical =
  | "OPEN"      // pracuje se
  | "BLOCKED"   // externě blokováno
  | "CANCELED"  // zrušeno
  | "DONE";     // hotovo

// Legacy mapper (všechno "otevřené" → OPEN):
//   "Otázka", "Čekám"         → OPEN
//   "ON_PM_SITE", "ON_CLIENT_SITE" → OPEN
//   "Rozhodnuto", "Ve stavbě", "Hotovo" → DONE
//   "DONE" / "BLOCKED" / "CANCELED" pass-through.
```

### Ball-on-me predicate
```ts
function isBallOnMe(task: Task, uid: string): boolean {
  if (task.type !== "otazka") return false;
  if (canonicalStatus(task.type, task.status) !== "OPEN") return false;
  const assigned = task.assigneeUid ?? task.createdBy; // legacy fallback
  return assigned === uid;
}
```

### Comment workflow (revised)
Comment.workflowAction už má `"flip" | "close"`. Zůstává. Sémantika flipu ale
nově:
- `flip` nepřehazuje status, jen updatuje `assigneeUid` (+ logs
  `assigneeAfter` ve Comment).
- `close` → status `DONE` (assigneeUid nezměněn).
- Status nad-OPEN změny (BLOCKED / CANCELED) jdou přes `StatusSelect`, ne přes
  komentář.

## 4. UI změny

### Terminologie
- `tabs.ukoly` = "Úkoly" (už je)
- `detail.typeOtazka` = "Úkol" (bylo "Otázka")
- `aria.typeOtazka` = "Úkol"
- `otazky.pageTitle` = "Úkoly"
- `comments.flipToClient` / `flipToPm` → nahradit za dynamický label
  `"Poslat {name}"`
- Status labels `statusOtazka.*` → přepsat na canonical set:
  - `OPEN` = "Otevřený"
  - `BLOCKED` = "Blokováno"
  - `CANCELED` = "Zrušeno"
  - `DONE` = "Hotovo"
- "Převést na další otázku" → "Vytvořit další úkol"

### Send-to picker v CommentComposer
```
┌─────────────────────────────────────────┐
│ [textarea]                              │
│ ─────────────────────────────────────── │
│ [📷][🔗]                   [Uzavřít] [Poslat ↓ Projektant ▾] │
└─────────────────────────────────────────┘
```
- Primary button zobrazí jméno defaultního peera (z posledního flip comments).
- Vpravo chevron-down → dropdown s všemi workspace users (kromě me).
- Po výběru se nová volba stane defaultem pro další send.

### Úkoly filter row
```
[Status ▾] [Priorita ▾] [Lokace ▾] [Kategorie ▾] [👤 Moje ▾] [⟲ Reset]
```
- Default: "Moje úkoly" = assigneeUid === currentUid.
- Přepnuté "Všichni" → všechny úkoly (dnes už takto visible pro PM).

### PM FAB
Shell: `<FabCell />` nejen pro `!isPm`. PM taky landing na `/novy`, kde zvolí
type = otazka nebo napad. Nápad vytvořený PM je default shared.

### PM convert button
V `TaskDetail` PM view napadu přidat tlačítko "Vytvořit úkol z nápadu" podobné
OWNER converting flow.

### Share-with-PM checkbox barva
```tsx
// OLD
className="size-4 rounded border-line text-accent-visual"
```
Už to je `text-accent-visual`, pokud uživatel vidí modrou, není to
`--color-accent`. Pravděpodobně `accent-color: blue` fallback
browseru. Fix: inline `style={{ accentColor: "var(--color-accent-visual)" }}`.

## 5. Implementation checklist

- [ ] **V10-S1 Types + lib/status.ts** — new canonical set, updated mapper, statusLabel, StatusSelect options.
- [ ] **V10-S2 Ball-on-me** — Shell badge, NapadCard border, Ukoly list sort, TaskDetail banner — assignee-based.
- [ ] **V10-S3 CommentThread/Composer send-to picker** — dropdown with peers, default = předchozí flip target.
- [ ] **V10-S4 Úkoly filter "Moje"** — AssigneeFilterChip (or reuse FilterChips pattern).
- [ ] **V10-S5 PM FAB + convert napad→úkol** — Shell + TaskDetail PM view.
- [ ] **V10-S6 Multi-OWNER napady vizibility** — firestore.rules + ensure useTasks returns them.
- [ ] **V10-S7 i18n "otázka"→"úkol"** — všechny strings.
- [ ] **V10-S8 Share-with-PM checkbox barva** — accent-color inline style.
- [ ] **V10-S9 "Vytvořit další úkol"** button label.
- [ ] **V10-S10 Update existujících testů** — status labels, workflow flipTarget, atd.

## 6. Risky / open questions

- **Editace assignee přímo v detailu** — dnes tam AssigneeSelect je. Po V10
  zůstává (OWNER + PM mění assignee i mimo komentář). Ale komentář-based flip
  by měl být primary flow. Akceptujeme redundanci.
- **"Uzavřít" v komentáři** — kdo smí uzavřít úkol? Dnes každý. Zachovat.
- **Nápad převáděný PM-em na úkol** — kdo je výchozí `assigneeUid`? Nejspíš
  PM (creator), nebo nullable a nechat na něm. Default: `assigneeUid = currentUid`
  (tj. ten kdo convertuje = první řešitel). OWNER si ho může vrátit.

