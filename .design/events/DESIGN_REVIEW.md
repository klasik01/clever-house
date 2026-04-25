# V18 Events — Design review (S17)

Statický audit implementace proti `DESIGN_BRIEF.md`,
`INFORMATION_ARCHITECTURE.md`, `DESIGN_TOKENS.md` a aesthetic
philosophy aplikace (V3.0 Swiss/functional minimalism). Nálezy
rozdělené dle severity. Běží před E2E testingem (S14) — některé
high-severity items se potvrdí nebo vyvrátí při reálném použití na
iPhone.

## Metodika

- Čtení kódu implementačních slices (S01–S15).
- Porovnání proti design dokumentům v `.design/events/`.
- Hledání UX regressions oproti existujícím patterns (TaskDetail,
  SettingsGroup, NotificationList).
- Bez screenshots / Playwright (nepřipojeno v sandboxu).

Severity škála:

- **High** — blokuje ship nebo porušuje aesthetic / accessibility kontrakt.
- **Medium** — funkční, ale UX-degrading nebo inconsistency s app patterns.
- **Low** — polish, ne-blocker. Dělat pokud je čas nebo když bolí.

---

## High severity

### H1. ICS subscription URL bez hostname env override
**Kde**: `app/src/lib/calendarToken.ts:105-111`.

**Problém**: `buildCalendarUrl` skládá hostname jako
`europe-west1-<projectId>.cloudfunctions.net`. Pokud v budoucnu někdo
nastaví Firebase Hosting rewrite `/cal/**` nebo custom domain, URL se
nezmění automaticky. User v `.env` nemá páku jak to přepnout — musel
by měnit kód.

**Fix**: Přidat volitelný `VITE_CAL_HOST_OVERRIDE` env var. Když je
set, `buildCalendarUrl` ho použije místo default hostname. Default
behavior zachovaný.

**Skip důvod, pokud ignorujeme**: V1 nemáme custom doménu, prod ji
pravděpodobně ani nebude mít. Když ji někdy přidáme, můžeme fix udělat
retroaktivně.

---

### H2. Scheduled CF potřebuje Cloud Scheduler API enabled
**Kde**: `app/functions/src/scheduled/{eventLifecycle,rsvpReminder}.ts`
+ S09/S13 slices.

**Problém**: Ve CLAUDE.md ani `.design/events/TASKS.md` není jasná
poznámka že deploy scheduled CF poprvé vyžaduje ručně enablovat
Cloud Scheduler API v GCP konzoli. `firebase deploy` zobrazí jen
hint na stderr a user ho může přehlédnout. Silent fail = žádný
tick se nespustí.

**Fix**: Přidat explicit checklist item do `FIREBASE.md` ("Při prvním
deploy scheduled CF: enable Cloud Scheduler API v console.cloud.google.com
→ APIs → Enable"). Ideálně i do `.design/events/E2E_RESULTS.md`
pre-flight sekce — je tam už, ale méně důrazně.

**Skip důvod**: Pokud dev + prod už mají enabled (S09 deploy to pustil),
je to jen dokumentační — ne user-facing bug.

---

### H3. `linkedTaskId` picker nabízí jen moje/assignuté — ne sdílené
**Kde**: `app/src/routes/EventComposer.tsx` — `myTasks` memo.

**Problém**: Filtr `createdBy === user.uid || assigneeUid === user.uid`
vynechá tasky kde jsem jen komentoval nebo @mentioned. Když chci
propojit event s taskem kde jsem participant ale ne author/assignee,
nevidím ho v picker. Praktický příklad: PM vytvoří úkol "Zkontrolovat
rozvody" přiřazený Stáňovi, manželka vytvoří event "Schůzka s PM"
kterou by ráda propojila s úkolem — nevidí ho protože není autor ani
assignee.

**Fix (single line)**: Rozšířit filtr o `(task.mentionedUids ?? []).includes(uid)`
nebo o "jakýkoliv task" (rules pustí read všem signedIn, takže žádná
security implikace).

**Skip důvod**: V1 workflow Stáňa/manželka dominantně vytváří tasky sami.
Může být follow-up fix když se objeví konkrétní pain point.

---

## Medium severity

### M1. CalendarSection v Settings není discoverable
**Kde**: `app/src/routes/Settings.tsx` — collapsible Kalendář sekce,
`defaultOpen={false}`.

**Problém**: User co nikdy nečet `E2E_RESULTS.md` nebo CLAUDE.md neví,
že appka podporuje Apple Calendar subscription. Nic v UI neukazuje
"sem jsi ještě neklikl". Feature discovery = zero.

**Fix options**:
- (a) V prvním spuštění `defaultOpen={true}` dokud user sekci nezavře
  manuálně (track v localStorage).
- (b) Přidat krátkou "tip" kartu na `/events` empty state: "💡 Propojit
  s Apple Calendar → Settings → Kalendář".
- (c) Pulse ring nebo badge na sekci v Settings když je poprvé
  visited.

**Doporučení**: (b) — jasný touch-point, non-intrusive. Jedno-věta
hint v `/events` empty state.

---

### M2. Banner "N událostí čeká na potvrzení" není clickable
**Kde**: `app/src/routes/Events.tsx` — `awaitingMineCount` banner.

**Problém**: Banner je čistě informativní `<div role="note">`. User
musí scroll-najít AWAITING events v listu. Drobnost, ale expectation
je "klik vede k akci".

**Fix**: Přepnout na `<button>` co scroll-loads na první AWAITING
item v listu, nebo filter toggle "jen čekající". Alternativně aspoň
visual affordance (chevron right) co naznačí klikatelnost.

**Skip**: Dostupnost/souvislost je low (užší seznam events), ale UX
affordance je to samé work.

---

### M3. ICS multi-event DTSTAMP = now → opakovaná refresh invaliduje ETags
**Kde**: `app/functions/src/cal/ics.ts` — `renderVevent` `DTSTAMP`.

**Problém**: Každý fetch webcal subscription generuje nový ICS s
`DTSTAMP` = server now. Apple Calendar vidí "změněný file" vždy a
nemůže kešovat přes ETag. Billing impakt: jeden user × 4 fetch/hour
× 30 dní = 2880 CF invocations/měsíc. OK pro <10 users na Spark
(free tier 2M/měsíc), ale při 50+ users začne ukrajovat.

**Fix**: Cache ICS response na 15 min (Cache-Control: max-age=900).
Apple Calendar default refresh interval je 15 min, takže `max-age=900`
efektivně zero overhead. Nebo setnout DTSTAMP na event updatedAt
(stabilní mezi refresh) místo now.

**Doporučení**: Druhá varianta — `DTSTAMP` = deterministic hash ze
všech eventů. Stable ICS → Apple respektuje 304 Not Modified.

---

### M4. RSVP reminder se pošle jen invitees ale ne autorovi
**Kde**: `app/functions/src/scheduled/rsvpReminder.ts`.

**Problém**: Pokud autor eventu také pozval sám sebe (edge case UI to
neumožňuje, ale rules ano), reminder se mu neposlal díky `uid !== createdBy`
filtru. Bez toho filtru by bylo OK — send self-filter v sendNotification
by to odfiltroval. Filter duplikuje logiku.

**Fix**: Odstranit `uid !== eventData.createdBy` z `pending` filtru;
nechat self-filter v `sendNotification` odmítnout. Jednoduší.

**Skip**: Žádný user-facing dopad. Low-importance code duplication.

---

### M5. Scheduled CF jobs nemají lock — dvě instance můžou běžet paralelně
**Kde**: `eventLifecycleTick` a `rsvpReminderTick`.

**Problém**: Firebase Scheduler zaručuje "at-least-once" delivery,
ne "exactly-once". Při retries po timeoutu můžeme mít dvě instance
paralelně. V našem případě:
- `eventLifecycleTick` batch update — race na `status` field, ale
  operace idempotentní (flip UPCOMING→AWAITING je safe).
- `rsvpReminderTick` — pošle reminder 2× pokud timing padne špatně.
  Dedupe přes `reminderSentAt` je race-vulnerable (obě instance vidí
  null, obě pošlou, jeden vyhraje write).

**Fix (drahé)**: Transaction `runTransaction(db, ...)` pro `reminderSentAt`
set — druhá instance by po přečtení viděla `reminderSentAt` nastavený
a skipla. Zvyšuje latenci.

**Fix (levné)**: Nech jak je. V praxi Scheduler rate limit zaručuje
že další tick nezačne než předchozí doběhne, a pro náš scale (<10
events/tick) retry overlap je extrémně nepravděpodobný.

**Doporučení**: Skip pro V1, dokumentovat jako known risk.

---

## Low severity

### L1. `Events.tsx` — placeholder FAB v S01 byl nahrazen, ale zachován starý komentář
**Kde**: `app/src/routes/Events.tsx` — komentář u FAB:
`"FAB — composer route /events/new přijde v S02. Zatím je button
disabled placeholder..."`.

**Problém**: Komentář je stale — FAB už vede na `/events/new` a není
disabled. Drobnost ale matoucí pro příští čtenáře.

**Fix**: Smazat zastaralou poznámku, nahradit `"FAB do composer
/events/new."`.

---

### L2. Inkonzistentní ikonní velikost v top baru EventDetail
**Kde**: `app/src/routes/EventDetail.tsx` — action buttons top bar.

**Problém**: `ArrowLeft size={20}`, `Pencil size={18}`, `Ban size={18}`,
`Trash2 size={20}`. Dvě velikosti promíchané. TaskDetail pattern má
všechny `size={20}`.

**Fix**: Sjednotit na `size={20}` (nebo `18` pokud chceme menší — ale
konzistentně).

---

### L3. Kalendář sekce v Settings — copy URL button uvnitř details expanduje
**Kde**: `app/src/routes/Settings.tsx` — `CalendarSection` component.

**Problém**: Oba buttons (Kopírovat, Resetovat) jsou uvnitř collapsed
"Podrobnosti" sekce. Autor eventu co chce jen rychle zkopírovat URL
musí udělat 3 kliky: Settings → Kalendář → Podrobnosti → Kopírovat.

**Fix**: Copy button vyexponovat vedle primary CTA "Připojit do Apple
Calendar". Reset nechat v Details (destruktivní, má tam ochranu přes
kliky).

---

### L4. `event_calendar_token_reset` notifikace má deepLink `/nastaveni#kalendar` ale router hash není handled
**Kde**: `app/functions/src/notify/catalog.ts` + client routing.

**Problém**: Deep-link `/nastaveni#kalendar` — user tapne notifikaci,
app se otevře na `/nastaveni` a v URL bar je `#kalendar`, ale
SettingsGroup collapsible zůstane zavřená. Hash se nečte. UX: user je
sice na správné stránce, ale sekci musí ručně rozbalit.

**Fix**: V `Settings.tsx` přidat `useEffect` co čte `location.hash`
a pokud `"#kalendar"`, setne CalendarSection `defaultOpen={true}`.

---

### L5. Invitee list v detail zobrazuje avatary bez online/presence indikátoru
**Kde**: `app/src/routes/EventDetail.tsx` — `InviteesList`.

**Problém**: RSVP indicator ✓/✗/? je jasný, ale chybí kdo z invitees
je právě online (jak jinde v app TaskDetail má presence dot). Konzistence.

**Fix**: Opt-in — je to nice-to-have. `usePresence` hook by to řešil.

**Skip**: Ne-blocker. Presence dot v TaskDetail je historicky zavedený,
ale pro Events ne-kritický.

---

### L6. Mobile viewport — EventComposer datetime-local pickers se přetékají
**Kde**: `app/src/routes/EventComposer.tsx` — 2 `<input type="datetime-local">`
vedle sebe v gridu.

**Problém**: Na viewport <380px (iPhone SE) se pickers mačkají, datum +
čas v jednom poli nemá dost místa. iOS nativní picker to sice otevře
full-screen, ale inline display je ořezaný.

**Fix**: Stack vertikálně na `< sm` breakpointu (Tailwind). `grid-cols-1
sm:grid-cols-2`.

**Potvrzení**: Čeká na E2E test (S14 step 3).

---

## Aesthetic alignment

Projekt drží V3.0 Swiss/functional minimalismus:
- Typography: system-ui, no custom font. ✓
- Colors: přes CSS custom props (`--color-ink`, `--color-accent` atd.). ✓
- Borders: `ring-1 ring-line` ne `border-line`. ✓ (konzistentní v Event
  komponentách).
- Shadows: žádné velké, jen hover `hover:bg-bg-subtle`. ✓
- Spacing: `px-4 py-3` row rhythm, `mt-6` section gap. ✓

Drobnosti:
- Většina Event stran zachovává max-width `max-w-xl` — stejné jako
  tasky, čitelné na desktop.
- `StatusBadge` tokens (`--color-status-danger-fg`, `--color-priority-p1-bg`)
  jsou reused — žádný hardcoded hex.

## Accessibility

- `aria-label` na icon-only buttons: ✓
- `aria-expanded` na collapsible: ✓
- `role="alert"` na errorech: ✓
- `role="note"` na informační banner: ✓
- `<a href="webcal://...">` — native link, accessibility OK
- `datetime-local` inputy — nativní pickers podporují screen reader

Gaps:
- `aria-labelledby` na section headings — často chybí `id` na `<h2>`.
  Medium impact pro screen reader. Přidat opportunistickyjakmile
  narazíme na issue.
- Copy button v Settings Kalendář nemá `aria-live` pro "Zkopírováno"
  stav. Uživatel screen readeru neví že se action povedla.

## Follow-up slices

Pro severity ≥ medium vytvořit issue / slice v backlogu:

- **S17-FU-1** (H3) — linkedTask picker: rozšířit filtr o participant role
  (komentoval/mentioned)
- **S17-FU-2** (M1) — `/events` empty state tip → Settings Kalendář
- **S17-FU-3** (M2) — Awaiting banner clickable → filter AWAITING
- **S17-FU-4** (M3) — ICS response cache nebo stable DTSTAMP
- **S17-FU-5** (L4) — Settings route čte `location.hash` pro
  CalendarSection auto-expand

High severity H1/H2 jsou env-level (docs fix), H3 je deferrable. M4/M5
jsou known-risk dokumentace.

---

## Rekapitulace

| Severity | Count |
|----------|-------|
| High     | 3 (2 env/docs, 1 nice-to-have) |
| Medium   | 5 (3 follow-up, 2 skip) |
| Low      | 6 (polish backlog) |

Žádný blocker pro ship Phase 1 + 2. Phase 4 follow-ups planned do
V19 backlogu.
