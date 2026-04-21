# V3 — Discovery

_Přepsáno z grill-me interview, 2026-04-20._

## Problem Statement

V3 mění otázku z **jednokroho Q&A** („OWNER pošle → PM odpoví → konec") na **ticket s vláknem diskusí**: explicitní assignee (kdo je na tahu), priorita, deadline, a threaded komentáře s přílohami. Zároveň přidává stránku **Přehled** pro analytiku „uvízlých" otázek — tak, aby ani OWNER ani PM netápal, na kom zasekne rozhodnutí.

Vedlejší: kategorie jako multi-badge, přepínač lokace/kategorie v listech, reset filtrů.

## Primary User

OWNER i PM rovnocenně. OWNER je tvůrce a arbiter rozhodnutí; PM je resolver. Oba mají dnes srovnatelnou třecí plochu v omezeném flow.

## Success Metric

**M2 — uvízlé otázky.** V daný moment **max 3 otázky ve stavu „Čekám" starší než 5 dní**. Čteno na stránce `/prehled` v samotné aplikaci.

## Top 3 Risks

1. **UI overload (B v Q9.1).** Komentáře + reakce + mention + priorita + deadline + assignee + multi-kategorie × 1 obrazovka → pro OWNER mentální zátěž. Mitigace: design-review pass po slice A; progressive disclosure (skryté emoji reakce dokud je nevyhledáváš, collapsed komentáře).
2. **Polo-mention bez notifikací.** `@mention` v V3, push/email až v V4 → tagnutý se to dozví jen když otevře app. User s tím výslovně souhlasí, ale je to technicky polo-feature; V4 musí dodat notifikace nebo mention ztratí důvěru.
3. **PM adoption friction.** User kontroluje app „párkrát denně", očekává že PM bude podobně aktivní. Pokud PM zůstane na WhatsAppu / emailu, komentáře zmrznou a cycle time poroste. Mitigace: `/prehled` stránka zviditelňuje lag → OWNER má data na konverzaci s PM.

---

## Block 1 — Problem & outcome

**Q:** Co rozbíjí dnešní workflow?
**A:** OWNER napsal otázku, PM chtěl doplnění, ale neměl kde reagovat a neměl jak to vrátit → otázka visela, nikdo na ní nepracoval. _(Upraveno: PM **má** tlačítko „Potřebuji doplnit" — OWNER si toho nevšiml. Skutečný pain: OWNER nemá kam pod otázkou odpovědět a vrátit zpět.)_

**Q:** Pro koho primárně řešíš?
**A:** Oba (OWNER + PM) rovnocenně.

**Q:** Jak poznám „dobré za 90 dní"?
**A:** **M2 — max 3 otázky ve stavu „Čekám" déle než 5 dní** — v danou chvíli. Čteno na nové stránce `/prehled`.

**Q:** Cena nicnedělání?
**A:** Ztráta času, otázky viští a nehýbou se. V4 doplní notifikace (out-of-scope V3).

---

## Block 2 — Users & jobs-to-be-done

**Q:** Co konkrétně v dnešním flow chybí?
**A:** (1) Není vidět **kdo je teď na tahu** (já/PM). (2) OWNER nemůže reagovat pod otázkou komentářem a vrátit PM; místo toho si musí upravit body otázky, což je špatný workaround.

**Q:** Kdo může mluvit do diskuze?
**A:**
- **Read** otázku: jakýkoli přihlášený uživatel workspace
- **Komentář**: jakýkoli přihlášený uživatel workspace
- **Edit otázky** (title, body, assignee, priority, deadline, attachments, delete, convert): jen autor (`task.createdBy === user.uid`)
- **UI identity**: vygenerovaný avatar (deterministický z UID) + displayName z Firebase Auth
- **Invite nových lidí**: OUT pro V3 (přidávají se dnes ručně přes Firebase console)

**Q:** JTBD
**A:**
- **OWNER otevírá app:** chci vidět, na čem jsem blokovaný, na čem čeká PM, co je urgentní.
- **PM otevírá app:** chci svůj todo-list otázek seřazený podle priority/deadline a pracovat na nich.

**Q:** Stávající workaround?
**A:** Žádný — app ještě není v produkci, tohle bude primární nástroj.

---

## Block 3 — Scope & priorita

### Vrstvy (user potvrdil A → B → C)

- **Vrstva A — jádro diskusního flow (V3.0):**
  - A1. **Komentáře** (thread pod otázkou i pod nápadem, per-komentář obrázky + odkazy, autor může editovat/mazat, ostatní přihlášení mohou psát)
  - A2. **Assignee / kdo je na tahu** — pole na otázce + ovladač „hodit zpět na OWNER / na PM"; vizualizace na kartě v listu
- **Vrstva B — triage (V3.1):**
  - B1. **Priorita** P1/P2/P3 (barevný badge)
  - B2. **Deadline** (datum + indikátor „po termínu")
  - B3. **Stránka Přehled** `/prehled`: „Čeká na mě", „Čeká na PM", „Po deadline", „Uvízlé ≥5 dní", čísla k M2
  - B4. **Kategorie jako multi-badge** (N:M místo 1:1)
- **Vrstva C — drobná UX navigace (V3.2):**
  - C1. **Lokace/Kategorie přepínač** v listech + detail
  - C2. **Mazání/reset filtrů** v listech

### Rozhodnutí

- **Priorita + deadline + assignee:** **jen na otázce** (ne nápadu, podle seznamu features i Q5.5)
- **Komentáře:** **na otázce i nápadu** (Q5.1 = B)
- **@mention** — IN, autocomplete z workspace uživatelů (email)
- **Edit/delete vlastního komentáře** — IN (hard delete + smaže obrázky ze Storage)
- **Emoji reakce** — IN

### Out-of-scope V3 (→ V4)

- Push notifikace
- Email notifikace
- Invite flow

### Flag

`@mention` bez push/email = polo-feature. User akceptoval.

### Druhotné dopady

- PM bude mírně naštvaný že má víc práce (komentáře, kontrola) → akceptovatelné, OWNER je zákazník
- OWNER kontroluje app 2-3× denně, což je dost pro polo-mention

---

## Block 4 — Constraints

- **Deadline:** žádný tvrdý, soft ship-when-ready
- **Developer capacity:** 8h/den (full-time-ekvivalent)
- **Stack:** Firebase Auth + Firestore + Storage (free tier), beze změn oproti V2
- **Storage concern:** odmítnutý, user „mám spoustu místa"
- **A11y / brand:** WCAG AA baseline, warm earth tokeny (olive RAL 6013, Stone beige, dub), Apple-HIG inspired, CZ-only — vše zachovat

---

## Block 5 — Content & data

### Q5.1 — Komentáře na čem?
Na otázce i nápadu.

### Q5.2 — Limity per komentář
- **Max 3 obrázky**
- **Max 10 odkazů**
- **Text bez limitu**

### Q5.3 — Delete komentáře
**Hard delete** + cascade odstranění obrázků ze Firebase Storage (žádný plevel v S3 accountu).

### Q5.4 — @mention autocomplete
**Uživatelé workspace** (lookup přes email, displayName).

### Q5.5 — Migrace (schválené)

| Pole | Existující **nápad** | Existující **otázka** |
|---|---|---|
| `priority` | — | default `"P2"` |
| `deadline` | — | `null` |
| `assigneeUid` | — | UID PM (z workspace config) |
| `categoryIds` | `[existing categoryId]` nebo `[]` | totéž |
| `commentCount` | `0` | `0` |

Nápady prioritu/deadline/assignee **nemají**.

### Q5.6 — Komentář schema (potvrzený)

```
tasks/{taskId}/comments/{commentId}
  authorUid: string
  body: string                        // markdown
  createdAt: serverTimestamp
  editedAt?: serverTimestamp
  attachmentImages?: ImageAttachment[] // max 3
  attachmentLinks?: string[]           // max 10
  mentionedUids?: string[]
  reactions?: { [emoji: string]: string[] }  // emoji → uid[]
```

Subcollection pod tasks (ne top-level) — lépe pro security rules i queries.

---

## Block 6 — Context of use

- **Mobile 90%** / desktop 10%
- **Offline komentář:** (b) zablokovat, hláška „nejsi online, zkus později"
- **Offline obrázek:** (d) odmítnout s hláškou „připoj se ke WiFi pro nahrání"
- **PWA manifest + navigateFallback** pro GitHub Pages — **zachovat stávající**

---

## Block 7 — Tone & aesthetic

- V2 estetika zachována v plném rozsahu
- **Priority barvy:** P1 = červená, P2 = olive/neutrální, P3 = šedá — OK
- **Deadline indicator:** countdown „za 3 dny" / „po termínu 2 dny" s barevnou eskalací — OK
- **Avatar circles:** initials + gradient per UID — OK

---

## Block 8 — Competitors & references

- **Nejbližší reference:** **Jira**
- **Co dělá výborně:** psaní komentářů, zmiňování lidí, kterých se to týká
- **Co dělá špatně (čemu se vyhnout):** _[UNANSWERED]_ — user neřekl, neexistuje explicitní „vyhnout se tomu" anti-pattern. **Riziko:** pokud Jira neposkytla „nepodobej se na to", přejímáme její patterns nekriticky, což může přetáhnout složitost na malou aplikaci.

---

## Block 9 — Risks & unknowns

### Q9.1 Největší riziko selhání
**(b) UX overload** — „bojím se že se to pak přeplácne a nebude to intuitivní pro uživatele".

Implicitně také riziko (c) PM adoption (user uznal že PM může brzdit), ale neoznačil jako primární.

### Q9.2 Nejnejistější věc
_[UNANSWERED]_ — „zatím nevím". Doporučuji po prvním A shipu ping si to znovu: jakmile máš komentáře + assignee v rukou, objeví se konkrétní pain. Pak přehodnotit scope B/C podle reálné zkušenosti.

---

## Open questions (pro design-brief a TASKS)

1. `/prehled` stránka — kde v navigaci? Nová položka v tab baru (místo něčeho) nebo submenu v „Více"?
2. Assignee UI — dropdown se seznamem členů workspace? Jak zachovat stávající „jen 2 role OWNER/PM" vs. „jakýkoli přihlášený může být assignee" — kdo může být cílem přiřazení?
3. `/prehled` metrika — jen aktuální stav (live), nebo i time-series („uvízlé otázky za poslední týden")?
4. Reset filtrů — 1 tlačítko „Reset" nebo per-filter X?
5. Avatar gradient — deterministický z UID hash nebo z emailu hash? Který UI seed?
6. Migrace `categoryId` → `categoryIds[]` — breaking schema (0 prod data) nebo bridge read helper jako u V2 multi-images?

Tyhle patří do `DESIGN_BRIEF.md` / `INFORMATION_ARCHITECTURE.md` / `TASKS.md`.
