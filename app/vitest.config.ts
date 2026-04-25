import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // V18 — `npm run test:coverage` produkuje HTML report v coverage/
      // (otevři coverage/index.html v prohlížeči). lcov je pro CI / IDE
      // pluginy (Coverage Gutters, Codecov).
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/types.ts", // jen interface, žádný runtime kód
      ],
      // Žádné hard thresholdy — projekt je v rozjezdu, většina UI
      // komponent zatím netestovaná. Když to dorovnáme, dáme
      // "thresholds: { lines: 70, statements: 70, ... }".
    },
  },
});
