import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  // Base path for sub-directory hosting (GitHub Pages). Defaults to / for Netlify / local dev.
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
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
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#5E5D3F",       // olive-700 (accent-default)
        background_color: "#F9F7F3",  // stone-50 (bg-default light)
        lang: "cs-CZ",
        dir: "ltr",
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: "/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.svg",
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
