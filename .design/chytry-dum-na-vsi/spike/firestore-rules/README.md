# Firestore Rules spike

## Cíl
Napsat security rules pro **2 role** (OWNER, PROJECT_MANAGER) a ověřit Emulator testy, že:

- OWNER vidí/edituje všechny `tasks` a `categories`.
- PROJECT_MANAGER vidí jen `tasks where type='otazka'`, píše jen pole `projektantAnswer`, `projektantAnswerAt`, `status`.
- Nepřihlášený uživatel nevidí nic.
- Role se čte z `users/{uid}.role` (server-side fact, ne client claim).

## Spuštění

Potřebuješ Firebase CLI globálně (`npm i -g firebase-tools`).

```bash
cd firestore-rules
npm install
# Start emulator (Firestore + Auth)
npx firebase emulators:start --only firestore,auth
# V druhém terminálu:
npm test
```

Test výstup by měl ukázat `✓ PASS` pro 8 scénářů.

## Rules file
Soubor `firestore.rules` je připraven pro copy-paste do produkčního projektu (S02). Obsahuje komentáře + 2 helper funkce.

## Data model (shoda s IA §5)

```
/users/{uid}
  - email
  - role: 'OWNER' | 'PROJECT_MANAGER'
  - displayName

/tasks/{taskId}
  - type: 'napad' | 'otazka'
  - title, body, status
  - categoryId, locationId
  - attachmentIds: [string]
  - linkedTaskId (optional)
  - projektantAnswer (optional, string)
  - projektantAnswerAt (optional, timestamp)
  - createdBy (uid)
  - createdAt, updatedAt

/categories/{categoryId}
  - label
  - createdBy
  - createdAt

/attachments/{attachmentId}
  - taskId
  - kind: 'image' | 'link'
  - url, storagePath, title
```

## Výsledek
Po passing testech: zkopíruj `firestore.rules` do S02 projektu a použij jako startovací. V CI (pokud bude) spouštěj stejné testy.
