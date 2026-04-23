import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
    // Pure-logic tests only for now — no Admin SDK mocks. If/when we want
    // to test sendNotification / triggers end-to-end we'll wire a
    // firebase-mock module here.
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
