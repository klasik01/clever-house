# RUNBOOK — Správa stavbyvedoucích (CM) účtů

> Pro: Stáňa (OWNER, admin přes Firestore Console)
> Postup ručního přidání / odebrání / změny role stavbyvedoucího bez
> code change. Přístup: [Firebase Console](https://console.firebase.google.com/)
> projekt `chytry-dum-na-vsi-ope`.

---

## Přidání nového stavbyvedoucího (CM)

### 1. Pošli pozvánku

E-mailem / WhatsAppem (klidně i ústně) řekni novému CM, ať otevře:

```
https://stanislavkasika.github.io/clever-house/
```

a klikne na **"Přihlásit přes Google"**.

⚠️ **Důležité:** musí použít stejnou e-mailovou adresu, která bude
zaregistrovaná v Google Workspace / Gmail. Apple ID, jiný OAuth provider
nebo password sign-up nejsou v této aplikaci povoleny (jen Google).

### 2. CM uvidí "Účet není plně nastaven"

Po prvním přihlášení Firebase Auth vytvoří uid v `auth.users`, ale klient
ti řekne **"Tvůj účet nemá přiřazenou roli. Kontaktuj správce…"**.

To je očekávané. Pokračuj k bodu 3.

### 3. Doplň user dokument ve Firestore

**Cesta:** Firebase Console → Firestore Database → kolekce `users`.

Hledej dokument, který se právě vytvořil. Doc ID = uid z Auth. Snadné
najít přes "Filter" na pole `email` = e-mail nového CM, nebo se podívej
do Auth tabulky pro uid podle e-mailu.

⚠️ Pokud `users/{uid}` dokument neexistuje, znamená to, že auth-side
trigger ještě neproběhl. Počkej 30s a refresh nebo zkontroluj Cloud
Functions logy. V krajním případě vytvoř dokument ručně:

```
Doc ID:  <uid z Auth tabulky>
Fields:
  uid:    "<stejné uid>"          (string)
  email:  "<email nového CM>"     (string)
  role:   "CONSTRUCTION_MANAGER"  (string)
  displayName: "<jméno>"          (string, volitelné)
```

### 4. Edit role

Otevři dokument, klikni **"Add field"**:

```
role:  "CONSTRUCTION_MANAGER"
```

(jako string, žádný array, žádné velké/malé varianty — exact match).

Save.

### 5. CM refreshne aplikaci

Pošli mu zprávu: "Hotovo, refresh appku". Po refresh `useUserRole`
detekuje CM, Shell mu načte tabs (Dokumentace, Úkoly, Events,
Nastavení), tab `Záznamy` zůstává skryt. Default route = `/ukoly`.

### 6. Sdílení relevantních dokumentů (jednorázový setup)

CM uvidí jen dokumentaci, kterou explicitně sdílíš. Pro každý dokument,
který má vidět:

1. Otevři task v aplikaci (jako OWNER).
2. V detail screen najdi sekci "Sdílení".
3. Zaškrtni checkbox **"Stavbyvedoucí (jen pro čtení)"**.
4. Hotovo — CM ho ihned uvidí v `/dokumentace` listu.

> **Tip:** dokument sdílíš per-task. Hromadné sdílení (multi-select) v
> této verzi není.

---

## Odebrání stavbyvedoucího

### Možnost A: Smazat účet

1. Firebase Console → Firestore → `users` → najdi doc → **Delete document**.
2. (volitelně) Firebase Console → Authentication → najdi uid → **Delete user**.

CM se nemůže přihlásit (resp. dostane "Účet není plně nastaven").

⚠️ Tasky, komenty, eventy vytvořené tímto CM **zůstávají** v databázi
s broken `createdBy` uidem. UI zobrazí jako "neznámý uživatel". Stejné
chování jako u smazaného PM — V19 patternem akceptováno.

### Možnost B: Změnit role na PROJECT_MANAGER

(Pokud CM přechází na PM-typed role, např. povýšení.)

1. Firestore → `users/{uid}` → Edit → změň `role: "CONSTRUCTION_MANAGER"`
   na `"PROJECT_MANAGER"`.
2. CM refreshne aplikaci, dostane PM scope.

⚠️ **Pozor:** historické `authorRole` snapshoty na taskách / eventech
zůstávají `"CONSTRUCTION_MANAGER"`. Cross-CM edit pattern bude pro tyhle
historické tasky stále fungovat (ten konkrétní user bude mít už PM role,
ale pattern porovnává `authorRole` field na tasku, ne current role).
Pokud chceš striktně oddělit historii, vyhoď ho úplně (Možnost A).

### Možnost C: Změnit role na OWNER

Žádný built-in pattern — `OWNER` je rodinný účet. Nemělo by se to dělat,
ale je to technicky možné stejnou cestou jako B.

---

## Audit po změně

Po jakékoli změně role projdi tyhle kontroly:

- [ ] **CM perspective:** přihlásíš se jeho účtem (pokud máš heslo) nebo
      ho požádáš o screenshot — vidí jen Dokumentace + Úkoly + Otázky +
      Events. Žádné Záznamy.
- [ ] **Žádná regrese:** přihlas se ze svého OWNER účtu — vše jako dřív
      (Záznamy, Harmonogram, Settings management).
- [ ] **PM perspective:** zeptej se PM, jestli se mu nezměnil pohled na
      data (neměl by — PM rules zůstávají stejné).

---

## Časté problémy

### CM po přihlášení vidí "Tvůj účet ještě není nastaven"

- Cause: chybí `users/{uid}` doc nebo nemá `role` field.
- Fix: Doplnit role per krok 4 výše.

### CM se přihlásí, ale nevidí žádné dokumenty

- Expected: po onboardingu vidí 0 dokumentů, dokud nesdílíš.
- Fix: Otevři každý dokument v `/dokumentace`, sdílej s rolí "Stavbyvedoucí".

### CM dostává push o tasku, který nemá vidět

- Cause: bug v `canReadTaskForRecipient` (V24 server-side gate).
- Fix: Zaslat info Stáňovi, otevřít issue. Mezitím v Settings → Notifikace
      mu vypnout problémový event type.

### CM nedostává push o tasku přiřazeném PM/OWNER

- Cause: může být `sharedWithRoles` mimo nebo `notificationPrefs.events.assigned`
      vypnuto.
- Fix: Zkontrolovat user dokument v Firestore — `notificationPrefs` by
      měl mít `assigned: true` (default). Pokud chybí, default-doplnit.

---

## Kontakt pro escalations

- Stáňa (OWNER): `stanislav.kasika@gmail.com`
- Dev support: vlastní investigace v Cloud Functions logs (Firebase Console
  → Functions → Logs).
