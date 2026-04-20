# Chytrý dům na vsi (Clever house)

Mobile-first PWA záznamník nápadů, otázek a rozhodnutí pro stavbu domu.

## Dev

```bash
npm install
npm run dev
# Otevři na telefonu přes LAN: http://<tvoje-ip>:5173
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

Push na `main` → Netlify auto-deploy (viz `netlify.toml`).

## Stack (aktuální = S01)

- React 18 + Vite 5 + TypeScript (strict)
- Tailwind 3 (mapované na CSS tokens — viz `src/styles/tokens.css`)
- localStorage pro persistenci (Firestore přichází v S02)
- i18n přes `useT()` hook + `src/i18n/cs.json`

## Struktura

```
src/
├── main.tsx           — entry, mount
├── App.tsx            — top-level layout (Shell)
├── routes/Home.tsx    — Zachyt + Nápady view (`/` v budoucnu)
├── components/        — Composer, Shell, NapadCard, ...
├── lib/               — storage, id
├── i18n/              — CZ stringy + useT hook
├── styles/
│   ├── tokens.css     — Design tokens (light + dark)
│   └── globals.css    — Base styles
└── types.ts           — Task, Category, Location types
```

## Design artifacts

Najdeš v `../.design/chytry-dum-na-vsi/`:
- DESIGN_BRIEF.md, INFORMATION_ARCHITECTURE.md, DESIGN_TOKENS.md, TASKS.md

## North-star UX rule

Jedna primární akce na obrazovku. Apple Notes clean + Notion struktura, **bez Notion komplexity**.
