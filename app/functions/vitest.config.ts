import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
    // Pure-logic tests only for now — no Admin SDK mocks. If/when we want
    // to test sendNotification / triggers end-to-end we'll wire a
    // firebase-mock module here.
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // V18 — `npm run test:coverage` v functions/ pokryje pure helpery
      // (catalog, dedupe, prefs, ics, eventLifecycle, rsvpReminder
      // helpers). Triggery (onTaskWrite, onEventWrite) jsou
      // unit-untestable bez Admin SDK mocků — coverage je nezahrnuje.
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts", // jen wiring + global init, žádná logika
        // Triggery (onTaskWrite, onEventWrite, onRsvpWrite, onUserWrite,
        // onCommentCreate, onTaskDeleted) volají Admin SDK přímo — bez
        // robustního mocku jsou unit-untestable. Coverage report by je
        // ukázal jako 0%, což je expected.
        "src/triggers/**",
      ],
      // Pure helpery v scheduled/ a cal/ (eventLifecycle, rsvpReminder,
      // ics, PATH_RE) coverage zahrnuje — i když celé CF wrapper
      // (eventLifecycleTick, calendarSubscription onRequest handler)
      // bude 0% covered. To je expected — ukazuje, kde chybí
      // integration test.
    },
  },
  css: {
    // Functions is Node-only; there's no CSS under src/. But Vite's
    // postcss-load-config walks UP the directory tree and finds
    // app/postcss.config.js (which references tailwindcss). Tailwind isn't
    // installed in functions/node_modules, so loading that config throws
    // `Cannot find module 'tailwindcss'`. Empty plugins array = opt out of
    // any PostCSS lookup entirely.
    postcss: { plugins: [] },
  },
});
