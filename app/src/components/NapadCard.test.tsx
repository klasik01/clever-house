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

const base: Task = {
  id: "t1",
  type: "otazka",
  title: "Jak zapojit rozvaděč?",
  body: "",
  status: "OPEN",
  assigneeUid: "owner-1",
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z",
  createdBy: "owner-1",
} as Task;

describe("NapadCard (V10)", () => {
  it("renders the title", () => {
    renderWithProviders(<NapadCard task={base} />);
    expect(screen.getByText(/Jak zapojit rozvaděč/)).toBeInTheDocument();
  });

  it("applies ball-on-me border when assigneeUid === current user", () => {
    const { container } = renderWithProviders(<NapadCard task={base} />);
    const link = container.querySelector("a");
    expect(link?.className).toMatch(/border-l-4/);
    expect(link?.className).toMatch(/border-accent/);
  });

  it("no ball-on-me border when assigneeUid is someone else", () => {
    const other = { ...base, assigneeUid: "someone-else" } as Task;
    const { container } = renderWithProviders(<NapadCard task={other} />);
    const link = container.querySelector("a");
    expect(link?.className).not.toMatch(/border-accent/);
  });

  it("applies the danger border when the úkol is overdue", () => {
    const yesterday = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const overdue = { ...base, deadline: yesterday } as Task;
    const { container } = renderWithProviders(<NapadCard task={overdue} />);
    const link = container.querySelector("a");
    expect(link?.className).toMatch(/border-l-4/);
    expect(link?.getAttribute("style") ?? "").toContain("color-status-danger-fg");
  });

  it("no border when type=napad", () => {
    const napad = { ...base, type: "napad", status: "Nápad" } as Task;
    const { container } = renderWithProviders(<NapadCard task={napad} />);
    const link = container.querySelector("a");
    expect(link?.className).not.toMatch(/border-accent/);
  });
});
