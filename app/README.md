# Chytrý dům na vsi (Clever house)

Mobile-first PWA záznamník nápadů, otázek a rozhodnutí pro stavbu domu.

## Dev

```bash
# 1. Install deps
npm install

# 2. Setup Firebase credentials
cp .env.example .env.local
# Edit .env.local with values from Firebase Console → Project Settings → Web app

# 3. Run
npm run dev
# LAN test: http://<tvoje-ip>:5173 on mobile
```

## Firebase setup (one-time)

1. Create Firebase project → Add Web app → copy config to `.env.local`.
2. Enable **Authentication** providers:
   - Email/Password
   - Google (optional)
3. Create Firestore database (production mode).
4. Deploy rules:
   ```bash
   npm run rules:deploy
   ```
5. Seed user accounts manually in Firebase console:
   - Auth → Users → Add user (Stanislav + manželka + Projektant).
   - Firestore → `/users/{uid}` docs with `{ email, role: "OWNER" }` for both spouses
     and `role: "PROJECT_MANAGER"` for Projektant. (See `firestore.rules` for field requirements.)

## Local Firestore emulator

```bash
# Terminal A
npm run emulators

# Terminal B
# (point VITE_FIREBASE_* to emulator host if desired)
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

### Netlify (prod)
Push na `main` → Netlify auto-deploy (viz `netlify.toml`). Env vars zadej v Netlify UI → Site settings → Environment.

### GitHub Pages (dev)
Auto-deploy na push do `main` přes GitHub Actions workflow `.github/workflows/deploy-pages.yml`.

**URL:** https://klasik01.github.io/clever-house/

**Setup (jednorázově):**

1. Na GitHubu jdi na repo → **Settings → Pages**:
   - Source: **GitHub Actions**
2. **Settings → Secrets and variables → Actions → New repository secret**, vytvoř 6 secretů:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Ve Firebase Auth → **Settings → Authorized domains** přidej:
   - `klasik01.github.io`
4. Push na `main` — pipeline se spustí, za ~2 min je app na `https://klasik01.github.io/clever-house/`.

**Lokální build pro GH Pages:**

```bash
npm run build:pages   # nastaví VITE_BASE_PATH=/clever-house/
npm run preview       # ověř, že vše funguje pod sub-path
```

**Poznámky:**
- Build vytváří `dist/404.html` jako kopii `dist/index.html` → SPA routing funguje na GH Pages (pro neexistující URL vrací shell, React Router pak rozehraje správnou route).
- Kořenová route na GH Pages je `/clever-house/` (ne `/`) — `<BrowserRouter basename>` to handluje automaticky přes `import.meta.env.BASE_URL`.
- Netlify dostává `VITE_BASE_PATH=""` (default), GH Pages dostává `/clever-house/` — stejný codebase beze změn.

## Stack (aktuální = S02)

- React 18 + Vite 5 + TypeScript (strict)
- React Router 6
- Tailwind 3 (tokenizovaný přes `src/styles/tokens.css`)
- Firebase Auth + Firestore + Storage (později)
- i18n: vlastní `useT()` hook + `src/i18n/cs.json`

## Struktura

```
src/
├── main.tsx, App.tsx
├── routes/
│   ├── Home.tsx              — Zachyt + Nápady (/)
│   ├── Settings.tsx          — /nastaveni (placeholder + odhlášení)
│   └── Auth/Login.tsx        — /auth/prihlaseni
├── components/
│   ├── Shell.tsx             — layout + bottom tabs
│   ├── Composer.tsx          — quick capture textarea
│   └── NapadCard.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useTasks.ts
├── lib/
│   ├── firebase.ts           — SDK init
│   ├── auth.ts               — sign in / out
│   ├── tasks.ts              — Firestore CRUD
│   ├── storage.ts            — localStorage (draft only)
│   └── id.ts
├── i18n/ cs.json, useT.ts
├── styles/ tokens.css, globals.css
└── types.ts
```

## Design artifacts

`../.design/chytry-dum-na-vsi/` — DESIGN_BRIEF, IA, TOKENS, TASKS.

## North-star UX rule

Jedna primární akce na obrazovku. Apple Notes clean + Notion struktura, **bez Notion komplexity**.
