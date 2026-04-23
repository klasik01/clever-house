# Notifikace — Discovery

> Grill-me session — zdrojový zápis rozhodnutí. Pokud cokoli budeš v budoucnu
> měnit, updatuj i tady + poznamenej důvod.

## Problem Statement

PM nemá zvyk otevírat aplikaci z vlastní vůle. Když mu OWNER přiřadí úkol,
přidá komentář do diskuze nebo ho @zmíní, PM to zjistí až když ho OWNER
ručně upozorní jiným kanálem (SMS, zavolá, řekne osobně). To zpomaluje
odezvu na otázky o dny a OWNER musí plnit práci dispatchera, místo aby se
soustředil na samotnou stavbu. Push notifikace odstraní ten manuální krok
a sníží latenci od eventu k první reakci assignee na cílových ≤ 24 h.

## Primary User

**Project Manager (PM).** Sekundárně OWNER + manželka — dostávají
notifikace symetricky, ale jejich chování appku pravidelně otevírat už
je zaběhané. Cíl a design bude vyhrávat PM.

## Success Metric

**Medianová latence mezi event-created-at a první reakcí assignee ≤ 24 h**,
měřeno 30 dní po launchi nad `comments` kolekcí. Baseline před launchem
(orientačně 2–3 dny) zdokumentovat před nasazením pro before/after.

## Top 3 Risks

1. **FCM token rotation & zombie tokens** — když uživatel smaže app nebo
   zakáže notifikace v iOS, tokeny v DB stárnou. Řešení: 410/404 z FCM
   response → token se automaticky maže v Cloud Function (v1 include).
2. **Permission request dead-end** — pokud uživatel omylem odmítne prompt,
   nelze ho JS otevřít zpět; musí manuálně v iOS Settings → Notifications.
   Mitigation: jasná instrukce v Nastavení app + copy na permission banneru.
3. **Event fatigue → opt-out** — PM při >5 pushů denně může opatrně
   vypnout. Mitigation: per-event toggles hned v v1 + iOS native grouping
   (collapse_id), žádný custom debounce.

---

## Block 1 — Problem & outcome

**Co se teď konkrétně děje špatně?**
PM nemá zvyk otevírat appku z vlastní vůle. OWNER mu musí ručně psát SMS
nebo telefonovat, že se něco stalo. Reakce na otázky / úkoly / @zmínky
trvá dny místo hodin.

**Success metric za 90 dní?**
Rychlejší odezva — reakce na @zmínky, komentáře a přiřazení do 24 h.

**Kolik stojí nedělat to?**
Pokračující manuální dispatching. OWNER plní roli messengera. Riziko
utonutí rozhodnutí "on se na to podívá příští týden".

## Block 2 — Users & jobs-to-be-done

**Primary:** PM — hlavní příjemce, kritické delivery.
**Secondary:** OWNER (Stanislav), manželka — symetrická práva i notifikace.

**Job-to-be-done:** "Když se něco stane a já to mám řešit, chci o tom
vědět bez toho, abych musel appku otevírat. Chci k tomu doskočit jedním
klikem."

**Dnešní workaround:** OWNER manuálně píše SMS / WhatsApp / volá.

## Block 3 — Scope & non-goals

**In scope (v1) — 5 eventů:**
| Event             | Trigger                                                      | Příjemci                                                   |
|-------------------|--------------------------------------------------------------|------------------------------------------------------------|
| `assigned`        | `task.assigneeUid` se změní                                  | Nový assignee (pokud ≠ editor)                             |
| `comment_on_mine` | Nový komentář na task, jehož `createdBy` = recipient          | Task creator                                               |
| `comment_on_thread` | Nový komentář v threadu, kde recipient dříve komentoval     | Všichni předchozí komentující (kromě current authora)      |
| `mention`         | `@mention` v comment body, kde recipient je zmíněn uid        | Zmínění uživatelé                                          |
| `shared_with_pm`  | `task.sharedWithPm` se změní z false → true, type = napad    | PM                                                         |

**Pravidla deduplikace:**
- **Self-notify filter:** nikdy neposílat pushe, když `actor === recipient`.
- **Jedna notifikace per event per recipient:** pokud uživatel padá do více
  kategorií (founder + mentioned), dostane jednu.
- Priorita při collision: `mention` > `assigned` > `comment_on_mine` >
  `comment_on_thread` > `shared_with_pm`.

**Out of scope (v1):**
- ❌ deadline-related eventy (`deadline_soon`, `overdue`)
- ❌ closure eventy (`closed`, `vystup_added`)
- ❌ per-thread debounce / custom batching (použijeme iOS native
  `collapse_id`)
- ❌ Email / SMS fallback
- ❌ In-app inbox / feed přehled doručených notifikací
- ❌ Badge count na iOS ikoně
- ❌ Quiet hours (iOS DND si řídí uživatel systémově)

**Pokud by se timeline prudce zkrátil**, řezalo by se takto:
1. První vypadne `comment_on_thread` (nejsložitější na backendu — čte
   historii komentářů).
2. Pak `shared_with_pm` (málo frekventovaný, OWNER to stejně řekne PM).
3. Minimal v1 by byl: `assigned` + `mention` + `comment_on_mine`.

## Block 4 — Constraints

**Timeline:** Bez tlaku, "až to půjde".

**Tech stack:**
- **iOS 16.4+ PWA přes home screen** ✓ (všichni na iOS 26+, PWA
  instalováno — ověřeno přímým dotazem).
- **Firebase Cloud Functions** ✓ Blaze plan už enabled (kvůli Storage).
- **FCM (Firebase Cloud Messaging)** pro delivery.
- **Service Worker** existuje přes `vite-plugin-pwa`; rozšíříme o FCM
  listener a notification click handler.
- **React 19.2 + TS + Firebase SDK 10** — žádné nové runtime deps kromě
  `firebase/messaging`.

**Budget:** Marginální — FCM free tier pokryje 3 uživatele × ~50 pushů
denně s rezervou. Cloud Functions invocations <100/den, free tier
1M/měsíc. Reálné náklady < 0.50 USD/měsíc.

**Team:** Solo (Stanislav) + Claude.

**Brand / a11y:** Existující — warm earth palette, Inter sans, Czech
copy. Notifikace musí v Settings respektovat min-tap 44×44, focus ring.

## Block 5 — Content & data

### Firestore schema

```
users/{uid}
  (existuje)
  + notificationPrefs: {
      enabled: true            // master
      events: {
        assigned:            true
        comment_on_mine:     true
        comment_on_thread:   true
        mention:             true
        shared_with_pm:      true
      }
    }

users/{uid}/devices/{deviceId}
  token:       string          // FCM token
  userAgent:   string          // pro debug
  platform:    "ios"|"android"|"desktop"
  createdAt:   ts
  lastSeen:    ts              // bump on every page load
```

Zvlášť `devices` subcollection, protože jeden uživatel může mít iPhone +
desktop (+ občas další). Token je per device per user, ne per user.
Cleanup při 410/404 response maže `devices/{deviceId}` dokument.

### Payload (FCM `notification` + `data`)

**Style 2 — přímý konverzační**, Czech. Max ~140 znaků v těle kvůli iOS
lockscreen budget.

| Event              | Title                                    | Body                                                       |
|--------------------|------------------------------------------|------------------------------------------------------------|
| `assigned`         | `{actor} ti přiřadil úkol`               | `{task.title} — otevři a pojď do toho`                     |
| `comment_on_mine`  | `{actor} komentoval: {task.title}`       | `{comment.body první věta / 120 znaků}…`                   |
| `comment_on_thread`| `{actor} v diskuzi: {task.title}`        | `{comment.body první věta / 120 znaků}…`                   |
| `mention`          | `{actor} tě zmínil: {task.title}`        | `{comment.body první věta / 120 znaků}…`                   |
| `shared_with_pm`   | `Nový sdílený nápad: {task.title}`       | `{task.body první věta / 120 znaků}`                       |

**`data` payload:**
```
{
  url: "/t/{taskId}#comment-{commentId?}"
  eventType: "assigned" | "comment_on_mine" | ...
  taskId: string
  commentId?: string
}
```

**`collapse_id` (FCM):** `thread-{taskId}` — iOS pak seskupí všechny
pushe z jedné otázky/úkolu do jedné stacky na lockscreenu.

**Icon:** existing app icon z manifestu.
**Badge:** symbolická silueta (lucide style), per iOS guideline.

### Permission request UX — strategie C (hybridní)

- Po přihlášení se v Nastavení zobrazí sekce "Notifikace" s master togglem
  + 5 per-event toggles. Inactive když permission != "granted".
- Nad aplikací po prvním loginu zobrazit **inline banner nahoře**:
  "Chceš dostávat upozornění? Zapnu ti to v Nastavení." → CTA zavolá
  `requestPermission()`. Banner lze zavřít, pak se neukazuje min. 7 dní.
- Pokud permission = "denied", banner se nahradí zobrazit instrukcí "Otevři
  iOS Nastavení → Aplikace → Chytrý dům → Notifikace a zapni".

## Block 6 — Context of use

- iOS iPhone 16.4+ primární (3× uživatelé, iOS 26+).
- Desktop Chrome občasně (jen OWNER).
- Připojení: typicky LTE, dobrá.
- Handoff: push došel → klik → app otevře se otázku/úkol, scroll na
  komentář.

## Block 7 — Tone / brand / aesthetic

- Existuje (V3 design tokens, warm earth, Inter sans, Czech).
- Notifikace copy: **přímý konverzační** — konkrétní osoba, konkrétní
  obsah. Nepomplikované. Češtinou vykání si odpouštíme (projekt je malý +
  rodina).

## Block 8 — Competitors & references

- **Slack** — mention notifikace jsou jedno z prvních věcí, co dělá
  dobře: "Marek: tady je to — jsi to chtěl?".
- **Linear** — clean payload "Assigned to you: Fix X".
- **Asana** — per-project mute + digest. Tohle nepotřebujeme ale je
  dobrý referenční bod.
- **Google Keep / Todoist** — jednoduchost, zaměřený payload.

**Čemu se vyhnout:**
- Trello-style "Board updated" — je to shrnutí, nic konkrétního, ignore.
- Email-style "You have 3 new notifications" — odkazuje zpátky na
  aggregátor, uživatel musí cestovat.

## Block 9 — Risks & unknowns

| # | Riziko                                       | Dopad    | Mitigation                                                |
|---|----------------------------------------------|----------|-----------------------------------------------------------|
| 1 | FCM token expire / rotation                  | Vysoký   | 410/404 handler v CF → `deleteDoc` devices/{deviceId}     |
| 2 | User denied permission & dead-end            | Střední  | Settings sekce s instrukcí otevřít iOS Settings           |
| 3 | Event fatigue → opt-out                      | Střední  | Per-event toggles + iOS collapse_id                        |
| 4 | Service worker not registered / stale        | Střední  | Test checklist před deploy; `skipWaiting` + `clientsClaim` |
| 5 | Dev environment — jak testovat push?         | Nízký    | Firebase CLI `functions:shell` + test FCM send from CLI    |
| 6 | Soukromí — `comment.body` v push payloadu    | Nízký    | iOS lockscreen lze skrýt obsahy v iOS Settings             |

## Open questions / follow-ups

- **Preview hiding na lockscreenu** — pokud by někdo chtěl skrýt obsah
  komentářů z push, řeší se v iOS Settings → Notifications → Show
  Previews → When Unlocked. Nevyžaduje naši práci, ale stojí zmínit
  v onboarding textu.
- **Cleanup policy** — quarterly manuální check že nevznikají
  zombie-tokens / duplicitní registrace? Necháme vidět v provozu.
- **Desktop Chrome** — funguje FCM tam samozřejmě, ale browser
  notifications na desktopu mají svůj sound + banner. Nic navíc nepotřebné.

---

**Sepsáno z grill-me sessionu dne 23. 4. 2026. Další krok:
brief-to-tasks (plán implementačních slices).**
