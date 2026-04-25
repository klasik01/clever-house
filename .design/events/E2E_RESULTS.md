# V18 Events — E2E test na reálném iPhone

Checklist pro ruční ověření že celý Events pipeline (S01–S13) funguje
v real-world iOS PWA setting. Vyplň během testování — každý krok má
pole `Výsledek`, `Screenshot`, `Issue`.

## Pre-flight

Před začátkem testování ověř:

- [ ] **Dev deploy hotový** — `npm run deploy:ope` v `app/deploy/` na
  oba (dev + prod). Frontend pushnutý na `main` → prod / `develop` →
  dev. Scheduler API enabled v GCP konzoli (firebase CLI na to upozorní
  při prvním deploy scheduled CF).
- [ ] **Migrace proběhla** — `2026-04-25-V18.S12-calendar-tokens.mjs`
  backfillnula tokeny pro všechny users. Ověř v Firestore console:
  `/users/{uid}.calendarToken` je neprázdný string.
- [ ] **Třetí test account** — kromě Stáňa + manželka potřebuješ ještě
  třetí účet (např. PM) aby šlo testovat multi-invitee RSVP flow. Stačí
  libovolný Google account přihlášený v appce.
- [ ] **Dvě iPhone zařízení** — ideální (dva people testují zároveň).
  Pokud máš jen jeden, použij iOS Safari + Android Chrome / desktop
  Chrome pro druhý account.

## Test matrix

| iOS verze | Zařízení | Tester | Datum |
|-----------|----------|--------|-------|
| iOS 17.x  |          |        |       |
| iOS 18.x  |          |        |       |

Min. iOS verzí 17 — starší PWA + Push API nepodporují.

---

## 1. Install PWA na iPhone

**Co dělat**:

1. Na iPhonu otevři Safari (ne Chrome — iOS Chrome nepodporuje PWA
   install menu).
2. Naviguj na `https://chytrydum.ope.firebaseapp.com` (prod) nebo dev
   URL.
3. Share button → **Add to Home Screen** → potvrď.
4. Otevři ikonu z Home Screen. App musí běžet v full-screen PWA módu
   (bez Safari URL baru nahoře).
5. Přihlaš se přes Google.
6. Povol notifikace když zobrazí prompt. iOS nastavení: **Settings →
   Chytrý dům → Notifications** ověř že `Allow Notifications` je ON
   a `Lock Screen` + `Banners` jsou ON.

**Acceptance**:

- [ ] App se otevírá bez Safari chromu (PWA mode)
- [ ] Auth Google login funguje
- [ ] Notifikační permission granted

**Poznámky / issues**:

```
(sem vyplň)
```

**Screenshot**: `s14-step1.png`

---

## 2. Settings → Kalendář → Připojit webcal

**Co dělat**:

1. V appce Settings → scroll na **Kalendář** sekci → rozbal.
2. Klik **[Připojit do Apple Calendar]**.
3. iOS zobrazí prompt "Subscribe to Calendar". Potvrď → vybrat
   kalendář nebo nechat default → **Subscribe**.
4. Otevři Apple Calendar app → dole **Calendars** → v sekci "Other"
   uvidíš "Chytrý dům" (nebo Czech variant).

**Acceptance**:

- [ ] Webcal URL otevřela iOS prompt (ne error "can't open")
- [ ] Apple Calendar zobrazuje nový kalendář "Chytrý dům"
- [ ] Refresh interval vidíš v Calendar app settings (měl by být
  15 min default)

**Poznámky / issues**:

```
(známý problém: pokud URL obsahuje diakritiku nebo mezery, iOS může
failnout. Měla by to řešit alphanumerická omezení v PATH_RE v S11.)
```

**Screenshot**: `s14-step2-subscribe.png`, `s14-step2-calendar-list.png`

---

## 3. Vytvoř event + pozvi druhý account

**Co dělat**:

1. Tab **Události** (📅 ikona v headeru) → FAB + → **Nová událost**.
2. Vyplň:
   - Název: "E2E test schůzka"
   - Začátek: zítra 14:00
   - Konec: zítra 15:00
   - Místo: "Stavba"
   - Pozvaní: vyber manželku + třetí account
3. **Uložit**.

**Acceptance**:

- [ ] Event se uloží bez errors
- [ ] Event se objeví v Události listu (oba účty)
- [ ] Inviteeě jsou v /events/{id}.inviteeUids (Firestore console check)

**Poznámky / issues**:

```

```

**Screenshot**: `s14-step3-composer.png`, `s14-step3-list.png`

---

## 4. Push + inbox notifikace invitation (S04)

**Na zařízení manželky**:

1. App v pozadí / zamčený telefon.
2. V momentě když Stáňa klikl Uložit v kroku 3:
   - Banner push notifikace s "Stáňa tě pozval: E2E test schůzka"
   - Inbox badge (červené číslo) na app ikoně
3. Otevři app → bell v headeru má tečku → klik → vidíš notifikaci
   v listu → klik → otevře detail eventu.

**Acceptance**:

- [ ] Push notifikace doručena do 5 sekund
- [ ] Inbox badge rozsvícený
- [ ] Deep-link funguje (otevře správný event detail)
- [ ] App ikona má badge číslo (Web Badging API — iOS 17+ PWA)

**Poznámky / issues**:

```
Pokud push nedorazil, zkontroluj:
- Settings → Chytrý dům → Notifications je ON na iPhonu
- Permission granted v appce (Settings → Notifikace collapsible → ...)
- Firestore /users/{uid}/devices/{deviceId} má záznam s tokenem
- Cloud Functions logs (firebase functions:log)
```

**Screenshot**: `s14-step4-lock-screen.png`, `s14-step4-inbox.png`

---

## 5. Manželka RSVP Můžu → Stáňa dostane push (S05)

**Na zařízení manželky**:

1. V detailu eventu → scroll dolů → sekce **Odpověz autorovi**.
2. Klik **[Můžu]**.
3. UI ukáže "Uloženo" flash.

**Na zařízení Stáni**:

1. Push "Manželka potvrdila: E2E test schůzka".
2. Inbox badge ticker.
3. V listu Pozvaní u eventu ✓ ikona u manželky.

**Acceptance**:

- [ ] RSVP uložen (Firestore /events/{id}/rsvps/{manzelka-uid} = yes)
- [ ] Push doručen Stáňovi
- [ ] Detail eventu u Stáni zobrazuje ✓ u manželky
- [ ] Počet "X z Y potvrzeno" v hlavičce Pozvaných je 1 z 2

**Poznámky / issues**:

```

```

**Screenshot**: `s14-step5-rsvp-action.png`, `s14-step5-badge.png`

---

## 6. Edit event (změna času) → push + Apple Calendar update (S07)

**Na zařízení Stáni**:

1. Event detail → tužka ikona (✏️) v headeru → **Upravit událost**.
2. Změň začátek na zítra 15:00, konec 16:00.
3. Ulož.

**Na zařízení manželky**:

1. Push "Stáňa upravil: E2E test schůzka".
2. Inbox má nový item.
3. Otevři detail → čas aktualizován.

**Apple Calendar sync (Stáňa nebo manželka)**:

1. Počkej **až 15 minut** (Apple Calendar refresh interval).
2. Nebo force-refresh: Calendar app → Calendars → tap na "Chytrý dům"
   → pull-to-refresh.
3. Event v Apple Calendar má nový čas.

**Acceptance**:

- [ ] Push update doručen invitees
- [ ] Inbox má samostatný item (ne duplicitní)
- [ ] Apple Calendar do 15 min zobrazí nový čas
- [ ] RSVP manželky zůstal `yes` (edit neinvaliduje předchozí RSVP)

**Poznámky / issues**:

```

```

**Screenshot**: `s14-step6-edit-composer.png`, `s14-step6-calendar-updated.png`

---

## 7. Per-event ICS download (S06)

**Na zařízení Stáni**:

1. Event detail → scroll dolů → tlačítko **[Přidat do kalendáře]**.
2. iOS otevře sheet s download dialogem nebo rovnou Calendar app s
   prompt "Add Event?".
3. Potvrď přidání.

**Acceptance**:

- [ ] ICS soubor se stáhl (nebo Calendar app přímo nabídla prompt)
- [ ] Event se objevil v **hlavním** Apple Calendar (ne Chytrý dům
  subscription!) — jako jednorázová kopie
- [ ] Invitees v ICS jsou visible (Event info → All Invitees)

**Poznámky / issues**:

```
Známý iOS quirk: <a download> může na iPhone chovat divně (otevře
soubor inline místo download prompt). Pokud ano, viditelný je
fallback dialog v UI (S06 R1 mitigation).
```

**Screenshot**: `s14-step7-prompt.png`

---

## 8. Cancel event → push + event zmizí z Apple Calendar (S08, S11)

**Na zařízení Stáni**:

1. Event detail → Ban ikona (🚫) → confirm "Zrušit událost".
2. Event má status CANCELLED, strike-through title, šedá barva.

**Na zařízení manželky**:

1. Push "Stáňa zrušil událost: E2E test schůzka".
2. Inbox má nový item.
3. V detailu event strike-through + šedý.

**Apple Calendar (oba)**:

1. Počkej do 15 min.
2. Event v subscription kalendáři **zmizí** (S11 filtruje CANCELLED
   z feed).
3. Neodstraňuje se ze hlavního Apple Calendaru (step 7 — to je zvlášť).

**Acceptance**:

- [ ] Push cancel doručen invitees
- [ ] UI zobrazuje CANCELLED stav (strike-through)
- [ ] ICS subscription po refresh nemá event
- [ ] Jednorázová ICS kopie (step 7) v hlavním kalendáři zůstává

**Poznámky / issues**:

```
Pokud po 15+ min event v subscription kalendáři zůstává, zkontroluj
v Apple Calendar Settings → Accounts → Subscriptions → "Chytrý dům"
→ fetch "Every 15 minutes" (default).
```

**Screenshot**: `s14-step8-cancelled.png`, `s14-step8-calendar-empty.png`

---

## 9. Event po termínu → AWAITING_CONFIRMATION + Proběhlo (S09, S10)

**Setup**:

1. Vytvoř nový event `E2E retro test` s koncem **za 1 hodinu**.
2. Počkej hodinu (nebo ručně v Firestore změň `endAt` na minulost).
3. Počkej na scheduled CF tick (každou hodinu, worst case 1h+).

**Na zařízení Stáni**:

1. Otevři Události → event má červenou tečku u data.
2. Nahoře listu červená banner "1 událostí čeká na potvrzení".
3. Klik na event → detail → sekce **Potvrzení**:
   - `[Proběhlo]` (zelené)
   - `[Neproběhlo / zrušilo se]`
4. Klik **[Proběhlo]**.
5. Event status = HAPPENED, zelený badge "Proběhlo".
6. Banner v listu zmizel.
7. Event se přesunul do Historie filter.

**Acceptance**:

- [ ] Scheduled CF flipnul UPCOMING → AWAITING_CONFIRMATION
- [ ] Červená tečka + banner se objevily
- [ ] Proběhlo button flipnul AWAITING → HAPPENED
- [ ] Žádný push nebyl poslán (retro je audit-only)
- [ ] Event v Historii (filter="past")

**Poznámky / issues**:

```
Scheduled CF tik nastaven na "every 1 hours" v Europe/Prague TZ.
Pro rychlý test můžeš:
- Přepnout endAt v Firestore Console manuálně na minulost + počkat
  max 60 min (další tik)
- Nebo dočasně změnit schedule na "every 2 minutes" pro debug, pak
  vrátit.
```

**Screenshot**: `s14-step9-awaiting.png`, `s14-step9-happened.png`

---

## Bonus: RSVP reminder 24h před (S13)

**Setup**:

1. Vytvoř event se začátkem **za 24 hodin** (zítra přesně stejný čas).
2. Nech manželku **nepotvrdit** (žádné Můžu/Nemůžu).
3. Počkej na scheduled CF tick.

**Acceptance**:

- [ ] Manželka dostala push "Připomenutí: {event}" mezi T-25h a T-23h
- [ ] Event má `reminderSentAt` nastaven (Firestore Console check)
- [ ] Další scheduled CF tik nepošle druhý reminder (dedupe)

**Poznámky**:

```
S13 má 2h okno [now+23h, now+25h]. Scheduled CF běží hodinově v
Europe/Prague TZ, takže event trefí jeden tik.
```

---

## Bonus: Webcal token reset (S12)

**Setup**:

1. Subscribe webcal v Apple Calendar (step 2).
2. V Settings → Kalendář → Podrobnosti → **[Resetovat kalendářový token]**.
3. Confirm modal → OK.

**Acceptance**:

- [ ] Apple Calendar po refresh dostane 401 na staré URL → subscription
  přestane aktualizovat (může zobrazit error "unable to fetch")
- [ ] V Settings se zobrazí nová URL
- [ ] Self-push "Kalendář token resetován" dorazí na všechna zařízení
  (inbox + push)
- [ ] Subscribe nové URL v Apple Calendar → funguje jako step 2

**Poznámky**:

```
Stará subscription v Apple Calendar se automaticky neodstraní —
uživatel si ji musí manuálně smazat v Calendar Settings → Accounts
→ Subscriptions → swipe delete. Nová URL se přidává jako nová
subscription.
```

---

## Celkový verdikt

| Kategorie | Status | Poznámka |
|-----------|--------|----------|
| PWA install | | |
| Push notifikace | | |
| Inbox | | |
| Webcal subscription | | |
| Apple Calendar sync | | |
| RSVP flow | | |
| Edit/Cancel flow | | |
| Retro confirm | | |
| Reminder | | |

## Workarounds / follow-ups

Seznam issues objevených při testování co potřebují fix — nové slices
v backlogu:

- [ ] `{issue 1}` — priorita ?, příslušný slice S??
- [ ] `{issue 2}`

## iOS-specifické quirky (pro budoucí reference)

- iOS 17+ — Web Push API funguje jen v PWA installed na Home Screen
  (ne Safari tab). Permission prompt musí být user-initiated.
- iOS 18 — Web Badging API je stabilní, app ikona správně zobrazuje
  count.
- `webcal://` scheme otevře prompt jen v Safari / Calendar app. Pokud
  user klikne v jiné appce (FB Messenger apod.), může přejít do
  Safari jako `https://` fallback.
- Apple Calendar fetch interval pro subscription je default 15 min,
  user může změnit. Minimum je 5 min (iOS omezení — nelze kratší).
- ICS download přes `<a download>` může iOS otevřít inline místo
  prompt — mitigováno v S06 fallback dialogem.
