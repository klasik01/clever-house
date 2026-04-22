import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { readFileSync } from "node:fs";

// Pull the package.json version once at config load and expose it to the app
// via `import.meta.env.VITE_APP_VERSION`. Avoids importing package.json into
// the runtime bundle.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8"));

export default defineConfig({
  // Base path for sub-directory hosting (GitHub Pages). Defaults to / for Netlify / local dev.
  base: process.env.VITE_BASE_PATH || "/",
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
  },
  plugins: [
    // V12.2 — emit dist/version.json so the running app can poll for new
    // deploys and force-reload when it detects a version mismatch.
    {
      name: "emit-version-json",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ version: pkg.version, built: new Date().toISOString() }) + "\n",
        });
      },
    },
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // PWA plugin must know the deploy base so service worker scope + start_url
      // resolve correctly on sub-path hosts (GitHub Pages /clever-house/).
      base: process.env.VITE_BASE_PATH || "/",
      workbox: {
        // Navigate fallback must be scoped to the base path or SPA deep links 404.
        navigateFallback: (process.env.VITE_BASE_PATH || "/") + "index.html",
        globPatterns: ["**/*.{js,css,html,svg,woff2,woff,ttf,png}"],
        // Never precache Firebase Storage / Firestore — always fresh from network
        navigateFallbackDenylist: [
          /^\/__\/.*/,  // Firebase hosting internals
          /firebaseio\.com/,
          /googleapis\.com/,
          /firebasestorage\.googleapis\.com/,
        ],
        runtimeCaching: [
          {
            // Firebase Storage images — stale-while-revalidate for snappy thumbnails
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "firebase-storage-images",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30d
              },
            },
          },
          {
            // Inter font — cache forever
            urlPattern: /\/fonts\/.*\.woff2?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      includeAssets: ["favicon.svg", "icon-192.svg", "icon-512.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Chytrý dům na vsi",
        short_name: "Chytrý dům",
        description:
          "Záznamník nápadů, otázek a rozhodnutí pro stavbu domu.",
        start_url: ".",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#5E5D3F",       // olive-700 (accent-default)
        background_color: "#F9F7F3",  // stone-50 (bg-default light)
        lang: "cs-CZ",
        dir: "ltr",
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: "icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icon-maskable-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
