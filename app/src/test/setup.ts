// Runs before every test file. Registers jest-dom matchers and any app-wide
// test plumbing. Keep this lean — per-test mocks live inside the test files.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
