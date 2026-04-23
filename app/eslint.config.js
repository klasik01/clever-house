// ESLint 9 flat config. Scope: TypeScript + React 19 + hooks + Fast Refresh.
// Kept deliberately lean — pragmatic for a solo codebase. We rely on tsc for
// the hard type rules; ESLint catches the logic / React-specific issues tsc
// doesn't see (e.g. missing hook deps, non-component exports that break HMR).

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  // Don't lint build output, node_modules, or config files themselves.
  //
  // Cloud Functions live in `functions/` as a separate CommonJS package
  // with its own tsconfig + test setup. Linting it from here fails
  // because the compiled `lib/` output uses `require()` / `exports`,
  // which the root config (ESM + strict) rejects. Functions has its own
  // `npm run typecheck` — that's plenty.
  {
    ignores: [
      "dist",
      "node_modules",
      "coverage",
      "public",
      "functions",
      "functions/**",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
      "vite.config.*",
      "vitest.config.*",
      "tailwind.config.*",
      "postcss.config.*",
      "eslint.config.*",
    ],
  },

  // Base recommended rules for JS + TS.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // App source — TSX files.
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Hooks — non-negotiable. Bad hook calls are runtime bugs; missing
      // deps are stale closures. Keep rules-of-hooks at error; exhaustive-deps
      // at warn because some patterns (refs, intentionally stale) are fine.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Fast Refresh — flag non-component exports from component modules.
      // This is what would have caught the `LinkedList` HMR bug if it had
      // fired; `allowConstantExport` relaxes the rule for pure constants
      // (e.g. statusColors / ALL_STATUSES).
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          // Component files can also export these named helpers without
          // breaking Fast Refresh — they're co-located with related
          // components and used widely enough that extracting into new
          // files is more churn than value.
          allowExportNames: [
            "ALL_STATUSES",   // StatusBadge — enum-like constant array
            "statusColors",   // StatusBadge — helper used across routes
            "statusIcon",     // StatusBadge — helper used across routes
            "avatarSeed",     // AvatarCircle — hash helper
            "useToast",       // Toast — hook co-located with provider
            "linkBrand",      // LinkFavicon — detect helper (hostname → brand)
          ],
        },
      ],

      // Unused imports / vars — warn, not error. Underscore prefix opts out
      // (e.g. `function _ignored(e) {}`).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // The base rule would double-fire with the TS one; turn it off here.
      "no-unused-vars": "off",

      // We deliberately use console.error + console.debug in lib handlers.
      // Warn on plain console.log to keep the noise out of production.
      "no-console": ["warn", { allow: ["warn", "error", "debug", "info"] }],

      // TS `any` — warn, don't error. Our surface is small enough that
      // ad-hoc escape hatches are sometimes pragmatic (Firestore docs,
      // test mocks).
      "@typescript-eslint/no-explicit-any": "warn",

      // Empty catch blocks — fine when intentional (we log elsewhere).
      "no-empty": ["warn", { allowEmptyCatch: true }],

      // Prefer const — style, not a bug-finder.
      "prefer-const": "warn",
    },
  },

  // Tests — relax rules that don't apply (refresh boundary, console noise).
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
