# Chytrý dům na vsi — V3 Design Brief

**Date**: 2026-04-20
**Author**: Stanislav Kasika
**Status**: Draft

Odvozeno z `V3_DISCOVERY.md`.

## 1. Problem Statement

Dnešní aplikace umí jednu výměnu OWNER ↔ PM: OWNER vloží otázku, PM odpoví nebo požádá o doplnění. Ale nikde se nenavazuje — OWNER nemá kam pod otázkou reagovat a hodit ji zpět na PM, a nikdo nevidí, kdo je právě na tahu a co je urgentní. V3 mění otázku z jednorázové Q&A na **ticket s vláknem diskuse, explicitním vlastníkem odpovědi, prioritou a deadline**, aby žádná otázka neseděla bez pohybu déle, než musí.

## 2. Primary User

Stanislav (OWNER) a Projektant domu (PM) se střídají jako autor a resolver na každé otázce. Scénář: OWNER večer na mobilu píše „jakou dáme izolaci stropu?", odešle PM. PM ráno v kanceláři na desktopu čte, potřebuje doplnit „jakou máš výšku krovu?" — napíše komentář, přehodí ticket zpět na OWNERa. OWNER druhý večer odpoví v komentáři a přehodí nazpět. Cyklus pokračuje dokud není rozhodnuto — každý krok je vidět v threadu a **z listu tasků vždy poznáš, kdo má teď co udělat**.

## 3. Success Metrics

- **Primary**: v jakýkoliv moment **max 3 otázky ve stavu „Čekám" starší než 5 dní** — čteno na `/prehled`
- **Secondary**: medián času od vytvoření komentáře k reakci druhé strany **≤ 2 dny** (vizualizováno na `/prehled`, metrika začne měřit ode dne shipu V3.0)
- **Guardrail**: žádná migrace existujících otázek nesmí rozbít current flow — všechny dnešní tasky po V3 migraci pokračují v práci s default hodnotami (priority=P2, deadline=null, assignee=puvodní PM)

## 4. Scope

### In scope (V3)

- Vlákno komentářů pod každým tasks (otázka i nápad) — threaded, autor může editovat/mazat svůj, ostatní pouze psát
- Komentář smí obsahovat max 3 obrázky a max 10 odkazů, markdown text bez limitu délky, @mention, emoji reakce
- `@mention` — autocomplete z uživatelů workspace (bez notifikace, mentions se uloží do `mentionedUids[]` pro budoucí V4)
- Assignee na otázce (kdo je teď na tahu), dropdown z workspace uživatelů, akce „hodit zpět na autora" / „hodit na někoho"
- Priorita otázky P1/P2/P3 (barevný badge, viditelný v listu i v detailu)
- Deadline otázky s indikátorem zbývajícího času („za 3 dny" / „po termínu 2 dny")
- Stránka `/prehled` — analytika: Čeká na mě, Čeká na někoho jiného, Po deadline, Uvízlé ≥5 dní, počet k M2 cíli
- Kategorie na tasku jako N:M badge (multi-select)
- Přepínač Lokace/Kategorie v listech (side-by-side taby na `/`)
- Reset filtrů v listech (tlačítko / X per chip)
- Hard delete komentáře + cascade remove obrázků ze Firebase Storage
- Generovaný avatar (initials + gradient deterministický z UID) + displayName z Firebase Auth

### Out of scope (→ V4)

- Push notifikace
- Email notifikace
- Self-service invite flow (pozvat emailem)

### Explicit non-goals

- Nebudeme stavět **plnohodnotný Jira-clone**: žádné sprints, žádné custom workflows, žádná velocity-based analytika. V3 je lehký discussion-ticket systém pro 2 lidi, ne agilní PM nástroj
- `@mention` **neinformuje** tagnutého uživatele mimo app (vědomě polo-feature, V4 dodá notifikace)
- Žádná rich-text editace komentářů (markdown přes Tiptap jen v task body, komentáře zůstávají plain markdown textarea kvůli jednoduchosti composeru — B3 rozhodnutí z V2 se rozšíří)
- Nebudeme řešit audit log ani version history

## 5. Constraints

- **Timeline**: Soft, bez externího deadline. Ship-when-ready po vrstvách A → B → C (V3.0 → V3.1 → V3.2)
- **Budget**: Solo dev (Stanislav), 8h/den kapacita, 0 Kč externí náklady
- **Tech stack**: Stávající — React 18 + Vite 5 + TypeScript + Tailwind 3, Firebase Auth + Firestore + Storage (free tier, bez Cloud Functions), vite-plugin-pwa, react-router v6, Tiptap (už v V2), browser-image-compression, pdfmake. Bez nových velkých závislostí
- **Accessibility**: WCAG AA baseline (už z V2), role="tablist" + aria-selected pro přepínače, čitelné stavy pro všechny tři priority (ne jen barva — badge + text), respect `prefers-reduced-motion`
- **Brand / legal / regulatory**: Warm earth olive (RAL 6013) + Stone beige + dub accent (tokens.css z V2), Apple-HIG inspired, CZ-only. Žádný GDPR-export UI — user zůstává vlastníkem svých dat ve svém Firebase projektu
- **Team**: 1 dev (OWNER = Stanislav). 1 tester/reviewer (PM = Projektant)

## 6. Tone & Aesthetic

- **Feel (3 adjectives)**: **klidná**, **přehledná**, **stavařská** (odkazuje na řemeslo a materiálnost, ne corporate hladkost)
- **Reference products**: Jira (komentáře a @mention); Linear (clean ticket state, priority/assignee jako first-class citizens); Notion (threads + emoji reactions jako implicitní konvence); Apple HIG (iOS segmented control, swipe akce)
- **Anti-references**: Žádný jednotlivý — user **[UNANSWERED]** z DISCOVERY Q8.3. **Default:** vyhýbej se Jira-like „konfigurovatelnosti všeho" (workflows, custom fields, permission schemes) — V3 má **jen hard-coded workflow**, žádná admin UI pro konfiguraci
- **Named aesthetic philosophy**: **Apple-HIG inspired, warm earth variant** — pokračování z V1/V2. Žádný „neobrutalism", žádný editorial-heavy typography, žádný dark-only

## 7. Content & Data

- **Existuje**:
  - V2 schema `tasks/{id}` s poli `title`, `body` (markdown), `type`, `status`, `categoryId`, `locationId`, `attachmentImages[]`, `attachmentLinks[]`, `linkedTaskIds[]`, `linkedTaskId`, timestamps, `createdBy`
  - `categories/{id}`, `users/{id}` (workspace profile s rolí)
  - LOCATIONS je hard-coded konstanta v kódu (ne Firestore)
- **Chybí** (musí se dodat ve V3 migraci):
  - `tasks/{id}.priority: "P1" | "P2" | "P3"` (otázky dostanou default `"P2"`)
  - `tasks/{id}.deadline: Timestamp | null`
  - `tasks/{id}.assigneeUid: string | null` (otázky dostanou UID původního PM z `workspace/config`)
  - `tasks/{id}.categoryIds: string[]` (migrace z `categoryId` — read bridge helper)
  - `tasks/{id}.commentCount: number` (dopočítaný cache, pro list rendering bez subscribe na subcollection)
  - `tasks/{id}/comments/{cid}` subcollection — plné schema viz V3_DISCOVERY Q5.6
  - `users/{uid}.email`, `users/{uid}.displayName` — už je, ale V3 bude user lookup víc využívat (mention autocomplete)
- **Vlastník**: Stanislav (Firebase projekt pod jeho Google účtem)

## 8. Competitors & References

| Product | What we match | What we avoid |
|---|---|---|
| **Jira** | Threaded komentáře, @mention autocomplete, assignee dropdown, priority badges | Custom workflows, permission schemes, overkill konfigurovatelnost |
| **Linear** | Clean ticket view, priority/status jako first-class badges | Cycles/sprints (ne náš use-case), keyboard-first UX (mobile-first u nás) |
| **Notion** | Emoji reactions jako lightweight feedback, comment threads v kontextu | Blocks-based editor v komentářích (jen plain markdown) |
| **GitHub Issues** | Per-comment attachments, hard delete s cleanupem, mention bez full-notif | Labels system (máme `categoryIds[]` = jednodušší), milestones (není třeba) |

## 9. Risks & Unknowns

1. **UI overload** — _Likelihood: vysoká_ / _Impact: vysoký_ / _Mitigation_: progressive disclosure (emoji reactions schované za "+", komentáře collapsed po 5, priority jen barevný badge bez popisku). Po shipu A povinný design-review před shipem B. User výslovně označil jako hlavní riziko (Q9.1).

2. **Polo-mention bez notifikací** — _Likelihood: jistá_ / _Impact: střední_ / _Mitigation_: v8.0 promissní onboarding toastu „Pozn.: tagnutí lidé dostanou notifikaci až v další verzi", dokumentace v `/prehled`. V4 musí přinést push/email jinak mention feature ztrácí důvěru.

3. **PM adoption** — _Likelihood: střední_ / _Impact: vysoký_ / _Mitigation_: `/prehled` metrika uvízlých otázek je kickback mechanism — OWNER uvidí pokud PM zamrzl, má data pro konverzaci offline. Pokud za 2 týdny po shipu není traction, spustit V4 notifikace napříč.

## 10. Open Questions

- [ ] Navigace `/prehled` — new tab bar slot (místo čeho?) nebo položka v `/nastaveni` → Více?
- [ ] Assignee pool — jen OWNER+PM role, nebo kdokoli s účtem ve workspace? (DISCOVERY říká „každý přihlášený může komentovat" ale neříká kdo může být _cíl_ přiřazení)
- [ ] `/prehled` — jen aktuální stav (live), nebo i 7-day time-series ("Uvízlé otázky this week" graf)?
- [ ] Reset filtrů UI — jedno tlačítko „Reset vše" nebo per-chip X?
- [ ] Avatar seed — UID hash vs. email hash (jak udržet stejný avatar kdyby user změnil email?)
- [ ] Migrace `categoryId` → `categoryIds[]` — breaking (0 prod data) nebo bridge helper? (User v V2 zvolil breaking; V3 pravděpodobně taky, ale potvrdit)
- [ ] Komentáře v exportu (PDF + text) — V3 je zahrne? Pokud ano, limit na N posledních?
- [ ] Anti-reference — DISCOVERY Q8.3 zůstalo `[UNANSWERED]`. Default: vyhnout se Jira admin-konfigurovatelnosti. User může změnit.

## 11. Definition of Done

Po V3 shipu musí být všechny tyto věty `true`:

- [ ] V detailu libovolné **otázky** vidím vlákno komentářů, můžu napsat komentář s ≥0 a ≤3 obrázky a ≤10 odkazy, můžu v něm tagnout `@user` a zareagovat emoji 👍 / ❤️ na cizí komentář
- [ ] V detailu libovolného **nápadu** vidím vlákno komentářů se stejnými pravidly
- [ ] Autor komentáře vidí tlačítko Edit + Delete; ostatní přihlášení vidí jen tělo
- [ ] Delete komentáře vymaže jak dokument z Firestore, tak všechny obrázky z Firebase Storage (žádné orphaned binaries)
- [ ] Otázka má **assignee** pole viditelné v detailu i v kartě listu; OWNER může assignee změnit tlačítkem „Hodit na…" (dropdown)
- [ ] Otázka má **priority badge** P1/P2/P3 s barevným odlišením (červená/olive/šedá) a **readable text** (žádná jen-barva komunikace)
- [ ] Otázka má volitelný **deadline**; kdyby byl po termínu, badge ukazuje „Po termínu X dní" červeně
- [ ] Stránka `/prehled` existuje a zobrazuje: (a) počet otázek `Čeká na mě`, (b) počet otázek `Po deadline`, (c) počet `Uvízlé ≥5 dní` s lock na M2 = 3, (d) link-out seznam každé skupiny
- [ ] V listech (`/napady`, `/otazky`, `/lokace/:id`) je přepínač **Lokace ↔ Kategorie** (tabs) a **Reset filtrů** tlačítko
- [ ] Na kartě tasku vidím **assignee avatar**, **priority badge**, **deadline chip** (pokud existuje)
- [ ] Migrace neporušila žádnou dnešní otázku — všechny mají valid `priority: "P2"`, `assigneeUid: <původní PM>`, `categoryIds: [<original>]`
- [ ] Firestore security rules: komentář smí psát kdokoli auth, smí editovat/mazat jen `authorUid === request.auth.uid`; task editace (`priority`, `deadline`, `assigneeUid`, atd.) jen `task.createdBy === request.auth.uid`
- [ ] Offline chování: psaní komentáře nebo nahrávání obrázku offline je **zablokované s hláškou** (žádný silent-failure)
- [ ] PWA manifest + service worker fungují na `https://klasik01.github.io/clever-house/` beze změny oproti V2
- [ ] Typecheck (`npm run typecheck`) čistý, build (`npm run build`) bez errorů
