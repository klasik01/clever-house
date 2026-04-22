import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import NapadCard from "./NapadCard";
import type { Task } from "@/types";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "owner-1" }, loading: false }),
}));
vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({ users: [], byUid: new Map(), loading: false }),
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ status: "ready", profile: { uid: "owner-1", email: "o@x", role: "OWNER", displayName: "Owner" } }),
}));

const base: Task = {
  id: "t1",
  type: "otazka",
  title: "Jak zapojit rozvaděč?",
  body: "",
  status: "ON_CLIENT_SITE",
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z",
  createdBy: "owner-1",
} as Task;

describe("NapadCard", () => {
  it("renders the title", () => {
    renderWithProviders(<NapadCard task={base} />);
    expect(screen.getByText(/Jak zapojit rozvaděč/)).toBeInTheDocument();
  });

  it("applies ball-on-me border (accent) when OWNER + ON_CLIENT_SITE", () => {
    const { container } = renderWithProviders(<NapadCard task={base} />);
    const link = container.querySelector("a");
    expect(link?.className).toMatch(/border-l-4/);
    expect(link?.className).toMatch(/border-accent/);
  });

  it("applies the danger border when the task is overdue", () => {
    const yesterday = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const overdue = { ...base, deadline: yesterday } as Task;
    const { container } = renderWithProviders(<NapadCard task={overdue} />);
    const link = container.querySelector("a");
    expect(link?.className).toMatch(/border-l-4/);
    // Inline style points at the danger token
    expect(link?.getAttribute("style") ?? "").toContain("color-status-danger-fg");
  });

  it("no border when type=napad and nothing special", () => {
    const napad = { ...base, type: "napad", status: "Nápad" } as Task;
    const { container } = renderWithProviders(<NapadCard task={napad} />);
    const link = container.querySelector("a");
    expect(link?.className).not.toMatch(/border-accent/);
  });
});
