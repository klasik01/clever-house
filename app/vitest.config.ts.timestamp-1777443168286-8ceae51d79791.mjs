// vitest.config.ts
import { defineConfig } from "file:///sessions/kind-laughing-hypatia/mnt/Chytr%C3%BD%20d%C5%AFm%20na%20vsi/app/node_modules/vitest/dist/config.js";
import react from "file:///sessions/kind-laughing-hypatia/mnt/Chytr%C3%BD%20d%C5%AFm%20na%20vsi/app/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve } from "path";
var __vite_injected_original_dirname = "/sessions/kind-laughing-hypatia/mnt/Chytr\xFD d\u016Fm na vsi/app";
var vitest_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "./src")
    }
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
        "src/types.ts"
        // jen interface, žádný runtime kód
      ]
      // Žádné hard thresholdy — projekt je v rozjezdu, většina UI
      // komponent zatím netestovaná. Když to dorovnáme, dáme
      // "thresholds: { lines: 70, statements: 70, ... }".
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9zZXNzaW9ucy9raW5kLWxhdWdoaW5nLWh5cGF0aWEvbW50L0NoeXRyXHUwMEZEIGRcdTAxNkZtIG5hIHZzaS9hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9raW5kLWxhdWdoaW5nLWh5cGF0aWEvbW50L0NoeXRyXHUwMEZEIGRcdTAxNkZtIG5hIHZzaS9hcHAvdml0ZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMva2luZC1sYXVnaGluZy1oeXBhdGlhL21udC9DaHl0ciVDMyVCRCUyMGQlQzUlQUZtJTIwbmElMjB2c2kvYXBwL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZXN0L2NvbmZpZ1wiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgfSxcbiAgfSxcbiAgdGVzdDoge1xuICAgIGVudmlyb25tZW50OiBcImpzZG9tXCIsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBzZXR1cEZpbGVzOiBbXCIuL3NyYy90ZXN0L3NldHVwLnRzXCJdLFxuICAgIGNzczogdHJ1ZSxcbiAgICBpbmNsdWRlOiBbXCJzcmMvKiovKi50ZXN0Lnt0cyx0c3h9XCJdLFxuICAgIGNvdmVyYWdlOiB7XG4gICAgICBwcm92aWRlcjogXCJ2OFwiLFxuICAgICAgcmVwb3J0ZXI6IFtcInRleHRcIiwgXCJodG1sXCIsIFwibGNvdlwiXSxcbiAgICAgIC8vIFYxOCBcdTIwMTQgYG5wbSBydW4gdGVzdDpjb3ZlcmFnZWAgcHJvZHVrdWplIEhUTUwgcmVwb3J0IHYgY292ZXJhZ2UvXG4gICAgICAvLyAob3Rldlx1MDE1OWkgY292ZXJhZ2UvaW5kZXguaHRtbCB2IHByb2hsXHUwMEVEXHUwMTdFZVx1MDEwRGkpLiBsY292IGplIHBybyBDSSAvIElERVxuICAgICAgLy8gcGx1Z2lueSAoQ292ZXJhZ2UgR3V0dGVycywgQ29kZWNvdikuXG4gICAgICBpbmNsdWRlOiBbXCJzcmMvKiovKi57dHMsdHN4fVwiXSxcbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgXCJzcmMvKiovKi50ZXN0Lnt0cyx0c3h9XCIsXG4gICAgICAgIFwic3JjL3Rlc3QvKipcIixcbiAgICAgICAgXCJzcmMvbWFpbi50c3hcIixcbiAgICAgICAgXCJzcmMvdml0ZS1lbnYuZC50c1wiLFxuICAgICAgICBcInNyYy90eXBlcy50c1wiLCAvLyBqZW4gaW50ZXJmYWNlLCBcdTAxN0VcdTAwRTFkblx1MDBGRCBydW50aW1lIGtcdTAwRjNkXG4gICAgICBdLFxuICAgICAgLy8gXHUwMTdEXHUwMEUxZG5cdTAwRTkgaGFyZCB0aHJlc2hvbGR5IFx1MjAxNCBwcm9qZWt0IGplIHYgcm96amV6ZHUsIHZcdTAxMUJ0XHUwMTYxaW5hIFVJXG4gICAgICAvLyBrb21wb25lbnQgemF0XHUwMEVEbSBuZXRlc3RvdmFuXHUwMEUxLiBLZHlcdTAxN0UgdG8gZG9yb3ZuXHUwMEUxbWUsIGRcdTAwRTFtZVxuICAgICAgLy8gXCJ0aHJlc2hvbGRzOiB7IGxpbmVzOiA3MCwgc3RhdGVtZW50czogNzAsIC4uLiB9XCIuXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpWCxTQUFTLG9CQUFvQjtBQUM5WSxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBRnhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sd0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ2pDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osYUFBYTtBQUFBLElBQ2IsU0FBUztBQUFBLElBQ1QsWUFBWSxDQUFDLHFCQUFxQjtBQUFBLElBQ2xDLEtBQUs7QUFBQSxJQUNMLFNBQVMsQ0FBQyx3QkFBd0I7QUFBQSxJQUNsQyxVQUFVO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixVQUFVLENBQUMsUUFBUSxRQUFRLE1BQU07QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUlqQyxTQUFTLENBQUMsbUJBQW1CO0FBQUEsTUFDN0IsU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUE7QUFBQSxNQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
