import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, type RenderOptions } from "@testing-library/react";
import type { UserProfile } from "@/types";

/**
 * Wrap a JSX tree in the router + provider plumbing every test needs.
 * Pass `route` to pre-load a URL into MemoryRouter.
 */
export function renderWithProviders(
  ui: ReactElement,
  opts: { route?: string } & Omit<RenderOptions, "wrapper"> = {},
) {
  const { route = "/", ...rest } = opts;
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}

/** Minimal fake user profile for useUsers-based tests. */
export const fakeUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  uid: overrides.uid ?? "u1",
  email: overrides.email ?? "alice@example.com",
  role: overrides.role ?? "OWNER",
  displayName: overrides.displayName ?? "Alice",
});
