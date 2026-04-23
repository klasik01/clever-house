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
});
