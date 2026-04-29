# Stavbyvedoucí Role (CONSTRUCTION_MANAGER) — Design Brief

**Date**: 2026-04-29
**Author**: Stanislav Kasika
**Status**: Draft

---

## 1. Problem Statement

Stavbyvedoucí (CM) je externí dodavatel pod NDA a pracuje pro PM. Pokud
mu dnes přidělíme `PROJECT_MANAGER` roli, uvidí celý brainstorming OWNER
(Stáňa + manželka) v `Zaznamy` — což je trapné a porušuje hranice NDA
mezi rodinou-zákazníkem a externí firmou. Aplikace nemá střední úroveň
přístupu mezi "rodinný OWNER prostor" a "externí PM s plným přístupem",
takže PM dnes řeší úkoly se stavbyvedoucími telefonem mimo systém — a
ztrácí auditní stopu.

## 2. Primary User

**Stavbyvedoucí ze stejné firmy jako PM** (2 identifikovaní lidé). Před
příchodem do appky telefonovali s PM nebo dostávali úkoly ústně na
stavbě. Jejich job-to-be-done: ráno za 10 sekund vidět, co dnes řešit,
být upozorněn na akutní problémy, a stáhnout si dokumentaci, kterou
potřebuje pro práci.

**Konkrétní scénář:** Stavbyvedoucí v 6:30 v autě cestou na stavbu otevře
appku. Vidí 3 úkoly s deadlinem dnes a 1 otázku od OWNER. Klikne na úkol
"Vyřešit polohu vnitřních dveří v ložnici", přečte si komentář od PM,
otevře přiloženou dokumentaci s rozměry, a po příjezdu na stavbu
odbaví — bez jediného telefonu.

## 3. Success Metrics

- **Primary:** ≥ 80 % zadaných úkolů CM dokončí bez dotazu na OWNERa
  "kde to najít" — měřeno za 90 dní po nasazení (auditem chat historie
  WhatsApp / hovorů PM ↔ Stáňa).
- **Secondary:** 0 incidentů, kdy CM uvidí task s `type: "napad"` nebo
  nesdílenou dokumentaci — měřeno přes Firebase Console rules monitoring
  + manuální audit Network panelu při onboardingu.
- **Guardrail:** Žádná regrese v existujícím OWNER ↔ PM workflow.
  `permissionsConfig.test.ts` invariants pass + manuální smoke test
  všech 20 permission akcí pro OWNER a PM po nasazení.

## 4. Scope

### In scope (v1)

- `UserRole` union: přidání `CONSTRUCTION_MANAGER` (`app/src/types.ts` +
  mirror v `functions/src/notify/types.ts`).
- `permissionsConfig.ts`: revize všech 20 permission akcí pro CM podle
  permission matrice v `DISCOVERY.md` § Block 3.
- `firestore.rules`: composite read gate (typ + sharedWithRoles +
  assignee/creator + cross-CM tým), edit pattern `author-or-cross-CM`,
  create gates pro `napad` a `dokumentace` zakázány pro CM.
- `Shell.tsx`: skrytí tabu `Zaznamy`, `Harmonogram`, `Prehled` pro CM.
- `AssigneeSelect`: CM se nezobrazuje pro `napad`, normálně pro
  `otazka/ukol`.
- `Composer.tsx`: pro CM jen `otazka` a `ukol` create.
- `RichTextEditor` v read-only režimu pro CM na `dokumentaci`.
- `TaskDetail.tsx`: filtrace `linkedTaskIds` přes `canReadTask` před
  vykreslením link chips (Hide entirely policy).
- Notification catalog: revize všech 17 event types pro CM jako
  recipient. `mention`, `comment_on_thread`, `document_uploaded`,
  `task_deleted` musí gate-checknout `canReadTask(cm, task)`.
- Workflow akce na komentech: CM smí flipnout svůj úkol `OPEN → DONE`,
  nesmí flipnout otázku, nesmí reassignnout.
- `cs.json`: `role.CONSTRUCTION_MANAGER = "Stavbyvedoucí"` (krátká forma
  "Stavbyved."), empty states, read-only banner texty, PWA update toast.
- `permissionsConfig.test.ts`: invariant testy projdou.
- `npm run docs:permissions`: regenerace `PERMISSIONS_GENERATED.md`.

### Out of scope

- Admin panel pro správu CM userů — vznikají ručně přes Firestore Console.
- Read access audit log.
- Audit log změn role.
- Heartbeat notifikace "byl přidán nový CM" pro OWNER/PM.
- Feature flag — hard cutover přes git push, jako každá jiná feature.
- Per-user (ne per-role) sharing dokumentace — jen role-level
  `sharedWithRoles`.
- Bulk grant ("sdílej tuhle složku s CM") — jen single-doc share.

### Explicit non-goals

- **Nenahrazujeme telefon mezi PM a CM** — appka je doplněk a auditní
  stopa, ne náhrada hovoru. Brief tedy *neusiluje* o "vše skrz appku" —
  to by vyžadovalo jiný JTBD a přijde to jako budoucí téma.
- **Nedeláme Storage budget alarm v rámci téhle feature.** Je to známé
  riziko, ale spadá pod ops, ne pod CM roli.

## 5. Constraints

- **Timeline:** Žádný hard deadline. Soft pace, žádný rush.
- **Budget:** N/A — interní projekt, time-only investice.
- **Tech stack:** React 19 + Vite + TS, Firebase (europe-west1), Cloud
  Functions Node 20, app Node 24.15, Vitest + RTL. **Žádný nový npm
  dependency**, žádný nový Firebase produkt.
- **Accessibility:** WCAG AA baseline zachován, `min-h-tap` 44px
  konvence, mobile-first.
- **Brand / legal / regulatory:** NDA mezi OWNER a externí firmou (PM +
  CM). CM nesmí vidět rodinný brainstorming OWNER+manželka v `Zaznamy`.
  GDPR off-boarding: smaže Stáňa user dokument, broken `createdBy`
  zůstane (status quo pro PM, akceptováno).
- **Team:** Claude implementuje komplet (rules + frontend + i18n +
  testy + deploy orchestraci).

## 6. Tone & Aesthetic

- **Feel (3 adjectives):** funkční, klidný, srozumitelný (žádný hluk
  pro CM, který chce jen vidět co dělat).
- **Reference products:** stávající `Chytrý dům na vsi` aplikace —
  nová role nepřináší nový vizuální jazyk, reuse `theme.ts`,
  `typeColors.ts`, UI primitivů (`StatusPickerInline`, `SwipeReveal`,
  `Composer`).
- **Anti-references:** N/A — žádný explicitní anti-vzor pro tuto feature.
- **Named aesthetic philosophy:** N/A — držíme existující design system.

## 7. Content & Data

- **Co existuje:** Tasks (s `type`, `sharedWithRoles`, `assigneeUid`,
  `createdBy`, `authorRole`), users (`UserProfile` s `role`), comments,
  events, notifications inbox.
- **Co chybí:**
  - Žádný existující task nemá `"CONSTRUCTION_MANAGER"` v
    `sharedWithRoles` — CM po prvním loginu vidí 0 dokumentace, sharing
    musí Stáňa/PM přidat ručně.
  - Žádný `users/{uid}` dokument pro 2 budoucí CM — vzniknou ručně po
    prvním Google login + OWNER zapíše roli ve Firestore Console.
  - i18n string `role.CONSTRUCTION_MANAGER` neexistuje.
  - Žádné notifikace pro CM v inboxu — start z čisté hlavy.
- **Kdo vlastní:** OWNER (Stáňa) — všechny content + data + grant
  rozhodnutí.

## 8. Competitors & References

N/A — interní aplikace pro 5 osob, žádné srovnání s konkurencí. Vnitřní
reference patternů:

| Pattern v `CLAUDE.md` | Co matchujeme | Čemu se vyhýbáme |
|---|---|---|
| V17.1 cross-OWNER edit | Cross-CM edit (analog) | Bez `authorRole` snapshot na taskách → re-bridge bug |
| V19 `sharedWithRoles` | Reuse pro CM doc sharing | Per-user `sharedWithUids` — keep role-level |
| V18-S40 changeType/link | Reuse edit-pattern gate | Cross-CM `linkedTaskIds` na nápad — UI musí filtrovat |
| `isCommentSideEffect` rule | Reuse pro CM komentování | Volnější side-effect gate, který by povolil flip statusu mimo edit |

## 9. Risks & Unknowns

1. **Bootstrap user doc** — Likelihood: high / Impact: high (CM nemůže
   vstoupit) / Mitigace: explicit error UI "Tvůj účet ještě není
   nastaven, kontaktuj OWNER" + `useUserRole` hook ošetří `null` role
   + dokumentační poznámka v briefu pro Stáňu, jak založit nového CM.
2. **Notification recipient bugs** — Likelihood: medium / Impact:
   medium (CM dostane push o tasku, který nevidí) / Mitigace: pure-helper
   testy v `notify/` per event type s `CONSTRUCTION_MANAGER` recipient
   case + integration test že `comment_on_thread` skipne CM, když nemá
   read access.
3. **Hard cutover bez warningu** — Likelihood: high / Impact: low (UX
   confusion, ne data loss) / Mitigace: PWA update toast + i18n string
   "Aplikace byla aktualizována — máš nového kolegu Stavbyvedoucího
   v týmu" + pre-launch e-mail manželce a PM.
4. **Plain-text mention nápadu v komentu** — Likelihood: medium / Impact:
   low / Mitigace: known limitation, dokumentováno v briefu, není fix
   v scope.
5. **Scope creep** — Likelihood: high / Impact: medium (uživatel řekl
   "chci všechno" bez priorit) / Mitigace: brief explicitně označuje
   prioritní pořadí slices v § Definition of Done; `brief-to-tasks` je
   rozseká na vertikální slices, každý malý dost na single PR.

## 10. Open Questions

- [ ] **Bootstrap CM user doc:** ručně po prvním login (Stáňa zapíše
      role do `users/{uid}` ve Firestore Console) vs. pre-seed dokument
      přes migrační skript se známým e-mailem? Aktuální preference =
      ruční po loginu, ale potřebujeme ověřit, že Google login
      vytvoří stub `users/{uid}` automaticky (tipuju že ano přes
      stávající `useAuth` hook, ale potřebuju potvrdit při code reviw).
- [ ] **Storage budget alarm:** je nastaven v Firebase Console? Pokud
      ne, kdy nastavit? Out-of-scope, ale otevřená otázka pro ops.
- [ ] **Přesné texty PWA toast a empty states:** koncept v briefu,
      finální texty v `frontend-design` fázi po code review.
- [ ] **`AssigneeSelect` filter:** jen v UI, nebo i v `firestore.rules`
      validation, že napad nemůže mít CM jako assignee? Doporučuji oba
      (defense in depth).
- [ ] **Cross-CM team upper bound:** aktuální assumption = libovolně,
      ale 2 jsou identifikovaní. Pokud firma pošle 3. dodavatele, design
      udrží? Yes (read-scope je rolová, ne počet-omezená).
- [ ] **Nahradit `sharedWithPm` legacy field?** V19 už nahrazeno
      `sharedWithRoles`, ale historické tasky můžou mít legacy. Bridge
      v `fromDocSnap` to handluje, ale potřebuje audit zda CM read gate
      nezpůsobí problém na legacy datech.

## 11. Definition of Done

Reviewer projde položky a zaškrtne yes/no:

- [ ] `UserRole` union obsahuje `CONSTRUCTION_MANAGER` v
      `app/src/types.ts` i `functions/src/notify/types.ts`.
- [ ] `permissionsConfig.ts` má všech 20 akcí s explicitním stavem
      pro CM (yes/no/scoped) a `rulesAt` pointer na konkrétní řádek
      v `firestore.rules`.
- [ ] `permissionsConfig.test.ts` invariants pass: každá rule má
      `description`, `rulesAt`, neprázdné `roles[]`.
- [ ] `firestore.rules` deploy proběhl na dev a prošel manual smoke
      testem se všemi 3 rolemi.
- [ ] CM se přihlásí přes Google a dostane se do `/ukoly` s filtrem
      `assigneeUid === me`. Žádné JS errory, žádné "no role" empty
      stránky.
- [ ] CM **nevidí** žádný task s `type: "napad"` v listu ani v
      detailu (URL `/t/{napadId}` vrátí 404 / "skryto").
- [ ] CM **nevidí** žádný task s `type: "dokumentace"`, kde
      `sharedWithRoles` neobsahuje `"CONSTRUCTION_MANAGER"`.
- [ ] CM **vidí** otázku/úkol, kde je `assigneeUid` nebo `createdBy`
      libovolný CM (cross-CM tým).
- [ ] CM **smí** flipnout svůj úkol `OPEN → DONE` přes komentář s
      `workflowAction`.
- [ ] CM **nesmí** flipnout otázku ani reassignnout úkol — UI
      buttony nejsou viditelné, server rule odmítne.
- [ ] CM **smí** vytvořit otázku, úkol, událost. **Nesmí** vytvořit
      nápad ani dokumentaci — UI volby skryté, server rule odmítne.
- [ ] CM v `TaskDetail.tsx` **nevidí** link chip pro `linkedTaskId`,
      kde target je nápad nebo nesdílená dokumentace.
- [ ] CM **nedostane** push notifikaci ani inbox záznam o tasku, který
      nevidí. Verifikováno přes pure-helper test per event type.
- [ ] OWNER a PM workflow je **identický** s pre-launch (žádná
      regrese). Smoke test: vytvořit nápad, vytvořit otázku, sdílet
      dokumentaci, RSVP event, přiřadit úkol, fliplnout status.
- [ ] `Shell.tsx` pro CM zobrazuje jen `Ukoly`, `Otázky`,
      `Dokumentace`, `Events`. Pro OWNER/PM beze změny.
- [ ] `AssigneeSelect` pro `napad` typ neobsahuje žádného CM uživatele.
- [ ] `cs.json` má `role.CONSTRUCTION_MANAGER = "Stavbyvedoucí"`
      (+ krátká forma) a všechny nové empty states / banners.
- [ ] PWA update toast se zobrazí prvním přihlášením po deploy s
      i18n textem.
- [ ] `npm run docs:permissions` regenerovalo `PERMISSIONS_GENERATED.md`
      a commit obsahuje regenerovaný soubor.
- [ ] `npm test` prochází v `app/` i `app/functions/`.
- [ ] Manželka a PM dostali pre-launch e-mail s krátkým popisem změny.
- [ ] Stáňa má dokumentovaný postup, jak založit 3. CM (Firestore
      Console krok-za-krokem).

---

**Brief je kontrakt mezi designerem a stakeholderem. Pokud je něco nejasné,
vrať se k Open Questions a vyřeš to dřív, než se začne stavět.**
